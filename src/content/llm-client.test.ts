import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { chatCompletion, generateText, visionCompletion, resetLlmClient } from "./llm-client.js";

describe("llm-client", () => {
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
    delete process.env.LLM_BASE_URL;
  });

  it("sends chat completion request to OpenAI and returns response", async () => {
    nock("https://api.openai.com")
      .post("/v1/chat/completions", (body: any) => {
        return (
          body.model === "gpt-4o" &&
          body.messages.length === 1 &&
          body.messages[0].role === "user" &&
          body.messages[0].content === "Hello"
        );
      })
      .matchHeader("authorization", "Bearer test-key")
      .reply(200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Hi there!",
            },
          },
        ],
      });

    const resp = await chatCompletion([{ role: "user", content: "Hello" }]);
    expect(resp).toBe("Hi there!");
  });

  it("handles custom base URL", async () => {
    process.env.LLM_BASE_URL = "https://custom-api.com/v1";
    resetLlmClient();

    nock("https://custom-api.com")
      .post("/v1/chat/completions")
      .reply(200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Custom response",
            },
          },
        ],
      });

    const resp = await generateText("System", "User");
    expect(resp).toBe("Custom response");
  });

  it("sends image with visionCompletion", async () => {
    nock("https://api.openai.com")
      .post("/v1/chat/completions", (body: any) => {
        const userMsg = body.messages.find((m: any) => m.role === "user");
        return (
          body.model === "gpt-4o" &&
          Array.isArray(userMsg.content) &&
          userMsg.content[1].image_url.url === "data:image/png;base64,abcdef"
        );
      })
      .reply(200, {
        choices: [
          {
            message: {
              role: "assistant",
              content: "OCR Text",
            },
          },
        ],
      });

    const resp = await visionCompletion(
      "Read it",
      "abcdef",
      "image/png",
      "Please read"
    );
    expect(resp).toBe("OCR Text");
  });
});
