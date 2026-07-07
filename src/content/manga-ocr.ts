/**
 * manga-ocr.ts
 *
 * OCR manga page images using OCR.Space API.
 * Replaces the previous LLM vision-based OCR approach.
 *
 * Strategy:
 *   - Read each page image as buffer
 *   - Send to OCR.Space API via multipart/form-data POST
 *   - Use language=vnm (Vietnamese) + OCREngine=2 (required for Vietnamese)
 *   - Return "." for pages with no text (silent reading scene)
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import axios from "axios";
import FormData from "form-data";
import type { MangaChapter } from "../manga/manga-scraper.js";
import { generateMangaScript } from "../manga/script-generator.js";
import pLimit from "p-limit";

export interface OcrOptions {
  concurrency?: number;
}

interface OcrSpaceResponse {
  ParsedResults?: Array<{
    ParsedText: string;
    FileParseExitCode: number;
    ErrorMessage?: string;
    ErrorDetails?: string;
  }>;
  OCRExitCode: number;
  IsErroredOnProcessing: boolean;
  ErrorMessage?: string[];
  ProcessingTimeInMilliseconds?: string;
}

/**
 * Get OCR config from environment variables.
 * Reads directly from process.env to avoid triggering full config validation.
 */
function getOcrConfig() {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OCR_SPACE_API_KEY. Copy .env.example to .env.local and fill in your OCR.Space API key."
    );
  }

  return {
    apiKey,
    baseUrl: process.env.OCR_SPACE_BASE_URL ?? "https://api.ocr.space",
    engine: parseInt(process.env.OCR_SPACE_ENGINE ?? "2", 10),
  };
}

/**
 * OCR a single manga page image using OCR.Space API.
 * Returns the extracted Vietnamese text, or "." if no text found.
 */
async function ocrPage(imagePath: string): Promise<string> {
  const cfg = getOcrConfig();
  const imageBuffer = await readFile(imagePath);
  const filename = basename(imagePath);

  const formData = new FormData();
  formData.append("file", imageBuffer, filename);
  formData.append("language", "vnm");
  formData.append("isOverlayRequired", "false");
  formData.append("OCREngine", String(cfg.engine));

  try {
    const resp = await axios.post<OcrSpaceResponse>(
      `${cfg.baseUrl}/parse/image`,
      formData,
      {
        headers: {
          apikey: cfg.apiKey,
          ...formData.getHeaders(),
        },
      }
    );

    const data = resp.data;
    if (data.IsErroredOnProcessing) {
      throw new Error(data.ErrorMessage?.join("; ") ?? "OCR.Space processing error");
    }

    const parsedText = data.ParsedResults?.[0]?.ParsedText ?? "";
    // OCR.Space returns \r\n line endings, normalize to \n and trim
    const text = parsedText.replace(/\r\n/g, "\n").trim();
    return text || ".";
  } catch (error: any) {
    // If OCR fails, return silent marker
    return ".";
  }
}

/**
 * OCR all manga pages in parallel with concurrency limit.
 *
 * @param pagePaths - Array of local image file paths
 * @returns Array of OCR text strings (1:1 mapping with pagePaths). "." for empty pages.
 */
export async function ocrMangaPages(
  pagePaths: string[],
  options: OcrOptions = {}
): Promise<string[]> {
  const { concurrency = 3 } = options;
  const limit = pLimit(concurrency);

  const tasks = pagePaths.map((path) =>
    limit(async () => {
      return ocrPage(path);
    })
  );

  return Promise.all(tasks);
}

/**
 * Filter OCR texts using LLM to remove junk (page numbers, logos, artifacts).
 * Keeps only dialogue and story narration text.
 *
 * @param ocrTexts - Raw OCR texts from ocrMangaPages()
 * @returns Filtered OCR texts (cleaned dialogue/narration only)
 */
export async function filterOcrTextsWithLlm(ocrTexts: string[]): Promise<string[]> {
  const { generateText } = await import("./llm-client.js");
  const limit = pLimit(2); // Process 2 pages at a time to avoid rate limits

  const systemPrompt = `Bạn là bộ lọc văn bản OCR cho truyện tranh tiếng Việt.

NHIỆM VỤ: Lọc và giữ lại CHỈ các văn bản là đối thoại nhân vật hoặc lời tường thuật câu chuyện.

LOẠI BỎ:
- Số trang (vd: "Trang 5", "Page 12", "5")
- Thông tin xuất bản (vd: "NXB Kim Đồng", "Copyright 2024")
- Tiêu đề chương (vd: "Chương 1: Khởi đầu")
- Logo, watermark, URL
- Hiệu ứng âm thanh KHÔNG phải hội thoại (vd: "BOOM", "CRASH", "*tiếng gió*")
- Văn bản rác, garbled text (vd: "xJ3@k", "|||", "...")
- Văn bản không liên quan đến cốt truyện

GIỮ LẠI:
- Hội thoại nhân vật (trong bong bóng chat)
- Lời tường thuật câu chuyện
- Suy nghĩ nội tâm nhân vật

QUY TẮC:
- Nếu toàn bộ text là rác → trả về chuỗi rỗng ""
- Nếu có text hợp lệ → chỉ trả về text đã lọc, KHÔNG giải thích
- Giữ nguyên ngắt dòng và format của text hợp lệ
- Không thêm bất kỳ text nào không có trong input

VÍ DỤ:
Input: "Trang 12\\n\\nNgươi là ai?\\n\\nTa là kiếm sĩ lưu lạc.\\n\\nNXB Kim Đồng"
Output: "Ngươi là ai?\\n\\nTa là kiếm sĩ lưu lạc."

Input: "BOOM\\n*tiếng gió*\\n|||xJ3"
Output: ""`;

  const filterPromises = ocrTexts.map((text, idx) =>
    limit(async () => {
      // Skip empty or placeholder text
      if (!text.trim() || text.trim() === ".") {
        return text;
      }

      const userPrompt = `Văn bản OCR từ trang truyện:\n\n${text}`;

      try {
        const filtered = await generateText(systemPrompt, userPrompt);
        const cleanedText = filtered.trim();
        // Return "." if filtered text is empty (all junk removed)
        return cleanedText || ".";
      } catch (error: any) {
        console.warn(`[OCR Filter] Failed for page ${idx + 1}: ${error.message}`);
        // Return original text if filtering fails
        return text;
      }
    })
  );

  return Promise.all(filterPromises);
}

/**
 * Generate a manga script with OCR text integrated.
 * Combines OCR with the existing generateMangaScript function.
 */
export async function generateMangaScriptWithOcr(
  chapter: MangaChapter,
  localPagePaths: string[],
  options: {
    channelName?: string;
    theme?: "classic" | "gold" | "emerald" | "sunset" | "cyber";
    bgmGenre?: string;
    bgmVolume?: number;
    imagePathPrefix?: string;
    concurrency?: number;
  } = {}
): Promise<{ script: Record<string, any>; ocrTexts: string[] }> {
  const ocrTexts = await ocrMangaPages(localPagePaths, {
    concurrency: options.concurrency ?? 3,
  });

  const script = generateMangaScript(chapter, localPagePaths, {
    channelName: options.channelName,
    theme: options.theme,
    bgmGenre: options.bgmGenre,
    bgmVolume: options.bgmVolume,
    skipTts: false, // Enable TTS since we have OCR text now
    imagePathPrefix: options.imagePathPrefix ?? "pages",
    ocrTexts,
  });

  return { script, ocrTexts };
}
