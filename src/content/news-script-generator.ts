/**
 * news-script-generator.ts
 *
 * Auto-generate a valid script.json for News Mode from fetched content.
 * Replaces the Claude Code agent's script-writing role.
 *
 * Encodes all SKILL.md rules (schema constraints, phonetic conversions,
 * template picking, Pexels keyword rules) into an LLM prompt.
 */

import { generateText } from "./llm-client.js";
import { ScriptSchema, type Script } from "../render/script-schema.js";
import type { FetchedContent } from "./url-fetcher.js";
import { extractJson } from "./helpers.js";

export interface NewsScriptOptions {
  theme?: string;
  channel?: string;
}

/**
 * Generate a news video Script from fetched URL content.
 *
 * Flow:
 *   1. LLM generates JSON following schema constraints
 *   2. Parse + Zod validate
 *   3. If validation fails, retry once with error feedback
 */
export async function generateNewsScript(
  content: FetchedContent,
  options: NewsScriptOptions = {}
): Promise<Script> {
  const { theme = "classic", channel = "Auto News" } = options;

  const systemPrompt = buildNewsSystemPrompt();
  const userPrompt = buildNewsUserPrompt(content, theme, channel);

  // First attempt
  let jsonText = await generateText(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 4000,
  });

  jsonText = extractJson(jsonText);

  try {
    const raw = JSON.parse(jsonText);
    return ScriptSchema.parse(raw);
  } catch (e: any) {
    // Retry once with error feedback
    const retryPrompt = `${userPrompt}\n\nLần trước bị lỗi:\n${e.message}\n\nHãy sửa và tạo lại JSON hợp lệ.`;
    jsonText = await generateText(systemPrompt, retryPrompt, {
      temperature: 0.5,
      maxTokens: 4000,
    });
    jsonText = extractJson(jsonText);
    const raw = JSON.parse(jsonText);
    return ScriptSchema.parse(raw);
  }
}

// ── System Prompt ─────────────────────────────────────────────────────────────

function buildNewsSystemPrompt(): string {
  return `Bạn là biên tập viên video tin tức Việt Nam. Nhiệm vụ: Tạo script JSON cho video tin tức dọc 9:16.

## QUY TẮC BẮT BUỘC

### Cấu trúc JSON
\`\`\`json
{
  "version": "1.0",
  "metadata": {
    "title": "tiêu đề ngắn",
    "source": { "url": "...", "domain": "...", "image": null },
    "channel": "tên kênh",
    "theme": "classic|gold|emerald|sunset|cyber",
    "mode": "news"
  },
  "voice": { "provider": "lucylab", "voiceId": "\${VIETNAMESE_VOICEID}", "speed": 1.0 },
  "scenes": [ ... ]
}
\`\`\`

### Scenes (3-150 scenes)
- Scene đầu: type = "hook"
- Scene cuối: type = "outro"
- Scene giữa: type = "body"

### Templates được dùng
hook, comparison, stat-hero, feature-list, callout, kinetic-text, outro

### Giới hạn schema
- hook: headline tối đa 40 ký tự, subhead tối đa 40 ký tự
- comparison: left/right có label (tối đa 30), value (tối đa 20), color "cyan"|"purple"
- stat-hero: value tối đa 20, label tối đa 40, context tối đa 50
- feature-list: title tối đa 40, 1-4 bullet (mỗi bullet tối đa 50)
- callout: statement tối đa 80, tag tối đa 20
- kinetic-text: 1-6 chunk (mỗi chunk tối đa 30)
- outro: ctaTop tối đa 30, channelName tối đa 30, source tối đa 40

### Phonetic BẮT BUỘC trong voiceText
- 5.5 → "năm chấm năm"
- AI → "ây ai"
- GPT → "G P T"
- Nepsilon → "Nép si lon"
- Viết số bằng chữ trong voiceText (text hiển thị giữ nguyên dạng số)

### Pexels keywords
- Dùng visual.videoKeyword và/hoặc visual.imageKeyword BẰNG TIẾNG ANH
- Ưu tiên videoKeyword cho cảnh body để có video nền động
- Ví dụ: "city skyline night", "technology circuit board", "business meeting"

### Voice text
- Tiếng Việt rõ, ngắn câu, dễ nghe
- Mỗi scene voiceText tối thiểu 1 ký tự
- Không giới hạn thời lượng

### Output
Chỉ trả về JSON, không markdown, không giải thích.`;
}

function buildNewsUserPrompt(
  content: FetchedContent,
  theme: string,
  channel: string
): string {
  // Truncate content to avoid exceeding token limits
  const maxContent = 6000;
  const text =
    content.text.length > maxContent
      ? content.text.slice(0, maxContent) + "..."
      : content.text;

  return `Tạo script JSON cho video tin tức từ nội dung sau:

Title: ${content.title}
URL: ${content.url}
Domain: ${content.domain}
${content.ogImage ? `ogImage: ${content.ogImage}` : ""}

Nội dung:
${text}

Yêu cầu:
- theme: "${theme}"
- channel: "${channel}"
- metadata.source.url: "${content.url}"
- metadata.source.domain: "${content.domain}"
${content.ogImage ? `- metadata.source.image: "${content.ogImage}"` : ""}
- Scene hook dùng headline là tiêu đề chính của tin
- Chọn template phù hợp nội dung (comparison cho vs, stat-hero cho số liệu, feature-list cho tính năng)
- Mỗi scene body phải có visual.videoKeyword tiếng Anh`;
}
