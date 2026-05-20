/**
 * image-downloader.ts
 *
 * Download manga page images from URLs to local filesystem.
 * Features:
 *   - Parallel downloads with concurrency limit
 *   - Retry logic (2 retries per image)
 *   - Custom headers (referer) to bypass hotlink protection
 *   - Progress tracking
 */

import axios from "axios";
import { writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { existsSync } from "node:fs";
import pLimit from "p-limit";
import { log } from "../utils/logger.js";

export interface DownloadResult {
  /** Page number (1-based) */
  pageNumber: number;
  /** Local file path */
  localPath: string;
  /** Whether download succeeded */
  success: boolean;
  /** Error reason if failed */
  reason?: string;
}

export interface DownloadOptions {
  /** Directory to save images into */
  outputDir: string;
  /** Max concurrent downloads (default: 5) */
  concurrency?: number;
  /** Max retries per image (default: 2) */
  maxRetries?: number;
  /** Referer header for hotlink protection bypass */
  referer?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Known referer requirements per CDN domain.
 * Some manga CDNs block requests without a matching Referer header.
 */
const CDN_REFERER_MAP: Record<string, string> = {
  "cdn.comico.la": "https://comi.mobi/",
  "dcnvn": "https://damconuong.lol/",
  "mbpro.vip": "https://damconuong.lol/",
  "static3t.com": "https://truyenqq.com.vn/",
};

/**
 * Get appropriate referer for a given image URL.
 */
function getReferer(imageUrl: string, fallback?: string): string {
  for (const [cdn, referer] of Object.entries(CDN_REFERER_MAP)) {
    if (imageUrl.includes(cdn)) return referer;
  }
  return fallback ?? "";
}

/**
 * Download a single image with retry logic.
 */
async function downloadImage(
  url: string,
  outPath: string,
  referer: string,
  timeout: number,
  maxRetries: number,
): Promise<{ success: boolean; reason?: string }> {
  let lastError = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await axios.get<ArrayBuffer>(url, {
        responseType: "arraybuffer",
        timeout,
        validateStatus: (s) => s < 400,
        headers: {
          Referer: referer,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      const ct = String(resp.headers["content-type"] ?? "");
      if (!ct.startsWith("image/")) {
        lastError = `non-image content-type: ${ct}`;
        continue;
      }

      const data = Buffer.from(resp.data);
      if (data.length < 1024) {
        lastError = `suspiciously small image (${data.length} bytes)`;
        continue;
      }

      await writeFile(outPath, data);
      return { success: true };
    } catch (e: any) {
      const status = e.response?.status;
      lastError = status ? `http ${status}` : String(e.message ?? e);

      // Don't retry on 4xx client errors (except 429 rate limit)
      if (status && status >= 400 && status < 500 && status !== 429) {
        break;
      }

      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  return { success: false, reason: lastError };
}

/**
 * Determine file extension from URL.
 */
function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) return ext;
  } catch {
    // Ignore URL parse errors
  }
  return ".jpg"; // Default
}

/**
 * Download all manga page images to a local directory.
 *
 * @param pageUrls - Ordered array of page image URLs
 * @param options  - Download configuration
 * @returns Array of DownloadResult (one per page, in order)
 */
export async function downloadMangaPages(
  pageUrls: string[],
  options: DownloadOptions,
): Promise<DownloadResult[]> {
  const {
    outputDir,
    concurrency = 5,
    maxRetries = 2,
    referer,
    timeout = 30000,
  } = options;

  // Create output directory
  await mkdir(outputDir, { recursive: true });

  const limit = pLimit(concurrency);
  let done = 0;
  const total = pageUrls.length;

  const tasks = pageUrls.map((url, index) =>
    limit(async (): Promise<DownloadResult> => {
      const pageNum = index + 1;
      const ext = getExtension(url);
      const filename = `page-${String(pageNum).padStart(3, "0")}${ext}`;
      const localPath = join(outputDir, filename);

      // Skip if already downloaded
      if (existsSync(localPath)) {
        done++;
        log.progress(done, total, "Download");
        return { pageNumber: pageNum, localPath, success: true };
      }

      const effectiveReferer = getReferer(url, referer);
      const result = await downloadImage(url, localPath, effectiveReferer, timeout, maxRetries);

      done++;
      log.progress(done, total, "Download");

      if (!result.success) {
        log.warn(`  page ${pageNum}: download failed (${result.reason})`);
      }

      return {
        pageNumber: pageNum,
        localPath,
        success: result.success,
        reason: result.reason,
      };
    }),
  );

  return Promise.all(tasks);
}

/**
 * Filter download results to only successful pages.
 * Returns ordered local file paths.
 */
export function getSuccessfulPages(results: DownloadResult[]): string[] {
  return results
    .filter((r) => r.success)
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((r) => r.localPath);
}
