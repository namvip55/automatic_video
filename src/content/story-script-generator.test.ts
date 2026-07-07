import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { generateStoryScript } from "./story-script-generator.js";
import { resetLlmClient } from "./llm-client.js";

describe("story-script-generator", () => {
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

  it("generates story script from topic", async () => {
    const mockScript = {
      version: "1.0",
      metadata: {
        title: "Câu chuyện anh hùng",
        source: {
          url: "",
          domain: "story",
          image: null,
        },
        channel: "Auto Story",
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
          voiceText: "Ngày xửa ngày xưa có một ngôi làng cổ kính.",
          templateData: {
            template: "hook",
            headline: "Câu chuyện anh hùng",
          },
        },
        {
          id: "scene-1",
          type: "body",
          voiceText: "Có một anh hùng xuất hiện để cứu thế giới.",
          templateData: {
            template: "callout",
            statement: "Chiến binh dũng cảm",
          },
          visual: {
            videoKeyword: "hero warrior",
          },
        },
        {
          id: "outro",
          type: "outro",
          voiceText: "Cảm ơn các bạn đã theo dõi.",
          templateData: {
            template: "outro",
            ctaTop: "Đăng ký kênh",
            channelName: "Auto Story",
            source: "story",
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

    const result = await generateStoryScript("Câu chuyện anh hùng");
    expect(result.version).toBe("1.0");
    expect(result.scenes).toHaveLength(3);
    expect(result.scenes[0].voiceText).toContain("Ngày xửa");
  });

  it("throws error when LLM returns invalid JSON", async () => {
    nock("https://api.openai.com")
      .post("/v1/chat/completions")
      .reply(200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: "This is not JSON",
            },
          },
        ],
      });

    await expect(generateStoryScript("Invalid topic")).rejects.toThrow();
  });

  it("throws error when LLM API fails", async () => {
    nock("https://api.openai.com").post("/v1/chat/completions").reply(500, "Server Error");

    await expect(generateStoryScript("Failed topic")).rejects.toThrow();
  });
});
