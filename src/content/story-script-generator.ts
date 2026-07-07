/**
 * story-script-generator.ts
 *
 * Auto-generate a valid script.json for Story Mode from a topic or text.
 * Replaces the Claude Code agent's story composition role.
 *
 * Story Mode uses video backgrounds (Pexels videoKeyword) — no static images.
 * Allowed templates: hook, callout, kinetic-text, outro.
 * Banned templates: comparison, stat-hero, feature-list (news board look).
 */

import { generateText } from "./llm-client.js";
import { ScriptSchema, type Script } from "../render/script-schema.js";
import { extractJson } from "./helpers.js";

export interface StoryScriptOptions {
  theme?: string;
  channel?: string;
}

/**
 * Generate a story video Script from a topic or user-provided text.
 *
 * @param topicOrContent - A topic to compose a story from, or full story text
 */
export async function generateStoryScript(
  topicOrContent: string,
  options: StoryScriptOptions = {}
): Promise<Script> {
  const { theme = "classic", channel = "Auto Story" } = options;

  const systemPrompt = buildStorySystemPrompt();
  const userPrompt = buildStoryUserPrompt(topicOrContent, theme, channel);

  let jsonText = await generateText(systemPrompt, userPrompt, {
    temperature: 0.8,
    maxTokens: 4000,
  });

  jsonText = extractJson(jsonText);

  try {
    const raw = JSON.parse(jsonText);
    return ScriptSchema.parse(raw);
  } catch (e: any) {
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

function buildStorySystemPrompt(): string {
  return `Bạn là người kể chuyện video Việt Nam. Nhiệm vụ: Tạo script JSON cho video kể chuyện (Story Mode) dọc 9:16.

## QUY TẮC BẮT BUỘC

### Cấu trúc JSON
\`\`\`json
{
  "version": "1.0",
  "metadata": {
    "title": "tiêu đề truyện",
    "source": { "url": "generated://story", "domain": "story", "image": null },
    "channel": "tên kênh",
    "theme": "classic|gold|emerald|sunset|cyber",
    "mode": "news"
  },
  "voice": { "provider": "lucylab", "voiceId": "\${VIETNAMESE_VOICEID}", "speed": 1.0 },
  "scenes": [ ... ]
}
\`\`\`

### Mode
- metadata.mode: "news" (để tương thích pipeline)
- metadata.source.domain: "story"
- metadata.source.url: "generated://story"

### Templates được dùng
hook, callout, kinetic-text, outro

### Templates CẤM (Story Mode)
- KHÔNG dùng comparison, stat-hero, feature-list (các template này tạo cảm giác bảng/bản tin)

### Giới hạn schema
- hook: headline tối đa 40 ký tự, subhead tối đa 40 ký tự
- callout: statement tối đa 80, tag tối đa 20
- kinetic-text: 1-6 chunk (mỗi chunk tối đa 30)
- outro: ctaTop tối đa 30, channelName tối đa 30, source tối đa 40

### VIDEO NỀN BẮT BUỘC
- MỖI scene body PHẢI có visual.videoKeyword bằng tiếng Anh
- KHÔNG dùng visual.imageKeyword

### Bộ videoKeyword gợi ý (chọn đa dạng, không lặp liên tiếp)
Đông người: "crowded city street", "busy street crowd", "people walking downtown", "urban crowd rush hour", "neon downtown crowd", "subway platform rush"
Thể thao: "basketball game", "soccer match", "runner training", "extreme sports", "boxing training", "stadium crowd energy"
Thiên nhiên: "majestic mountains", "dramatic ocean waves", "epic waterfall", "aerial nature landscape", "glacier valley aerial", "canyon sunrise drone"
Vũ trụ: "galaxy starscape", "milky way night sky", "deep space nebula", "cosmic universe background"
Trời mưa: "rainy city night", "moody rain window", "raindrops on glass", "lonely walk in rain"
Thời gian: "day to night timelapse", "sunset to city lights", "golden hour to night", "twilight urban timelapse"

### Quy tắc chọn keyword
- Mỗi scene chọn keyword khác nhau, không lặp nguyên cụm
- Sau 1 scene urban/sports → ưu tiên đổi sang nature/cosmic/weather
- Nếu scene liền kề trùng mood → đổi nhóm keyword

### Voice text
- Tiếng Việt, câu ngắn, dễ nghe, giàu hình ảnh
- Giọng kể chậm, êm
- Phonetic: 5.5 → "năm chấm năm", AI → "ây ai", Nepsilon → "Nép si lon"

### Output
Chỉ trả về JSON, không markdown, không giải thích.`;
}

function buildStoryUserPrompt(
  topicOrContent: string,
  theme: string,
  channel: string
): string {
  const isTopic = topicOrContent.length < 200;
  const instruction = isTopic
    ? `Sáng tác một câu chuyện ngắn hài hước/cảm xúc/dễ nghe từ chủ đề sau. Chia thành nhiều scene body theo nhịp kể.`
    : `Dùng nội dung truyện sau để tạo script. Chia thành nhiều scene body theo nhịp kể.`;

  return `${instruction}

${isTopic ? "Chủ đề:" : "Nội dung:"}
${topicOrContent}

Yêu cầu:
- theme: "${theme}"
- channel: "${channel}"
- metadata.source.domain: "story"
- metadata.source.url: "generated://story"
- Scene hook giới thiệu ngắn câu chuyện
- 4-12 scene body với callout hoặc kinetic-text, mỗi scene có visual.videoKeyword khác nhau
- Scene outro kết thúc`;
}
