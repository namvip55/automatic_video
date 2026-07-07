import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { generateNewsScript } from "./news-script-generator.js";
import { resetLlmClient } from "./llm-client.js";

describe("news-script-generator", () => {
  beforeEach(() => {
    nock.cleanAll();
    resetLlmClient();
    process.env.LLM_API_KEY = "test-key";
    process.env.LLM_MODEL = "gpt-4o";
  });

  afterEach(() => {
    nock.cleanAll();
    resetLlmClient();
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  it("generates a valid script JSON from news content", async () => {
    const mockScript = {
      version: "1.0",
      metadata: {
        title: "Test News Video",
        source: {
          url: "https://example.com/news",
          domain: "example.com",
          image: "https://example.com/cover.jpg",
        },
        channel: "My channel",
        theme: "classic",
        mode: "news",
      },
      voice: {
        provider: "lucylab",
        voiceId: "${VIETNAMESE_VOICEID}",
        speed: 1.0,
      },
      scenes: [
        {
          id: "hook",
          type: "hook",
          voiceText: "Xin chào quý vị độc giả.",
          templateData: {
            template: "hook",
            headline: "Tin tức đặc biệt",
          },
        },
        {
          id: "scene-1",
          type: "body",
          voiceText: "Nép si lon ra mắt sản phẩm mới.",
          templateData: {
            template: "callout",
            statement: "Nép si lon giới thiệu sản phẩm.",
          },
          visual: {
            videoKeyword: "launch product",
          },
        },
        {
          id: "outro",
          type: "outro",
          voiceText: "Cảm ơn các bạn.",
          templateData: {
            template: "outro",
            ctaTop: "Đăng ký ngay",
            channelName: "My channel",
            source: "example.com",
          },
        },
      ],
    };

    nock("https://api.openai.com")
      .post("/v1/chat/completions")
      .reply(200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify(mockScript),
            },
          },
        ],
      });

    const content = {
      title: "Tin tức test",
      text: "Nội dung bài viết...",
      url: "https://example.com/news",
      domain: "example.com",
      ogImage: "https://example.com/cover.jpg",
    };

    const script = await generateNewsScript(content, {
      theme: "classic",
      channel: "My channel",
    });

    expect(script.version).toBe("1.0");
    expect(script.metadata.title).toBe("Test News Video");
    expect(script.scenes.length).toBe(3);
    expect(script.scenes[0].id).toBe("hook");
    expect(script.scenes[1].voiceText).toContain("Nép si lon");
  });
});
