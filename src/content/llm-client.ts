/**
 * llm-client.ts
 *
 * LLM client wrapper using OpenAI-compatible API.
 * Supports text completion and vision (image) queries for manga OCR.
 *
 * Uses the `openai` npm package already in dependencies.
 * Supports custom base URL via LLM_BASE_URL env var (for proxies or
 * OpenAI-compatible endpoints like Azure, Together, Groq, etc.).
 */

import OpenAI from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing LLM_API_KEY. Copy .env.example to .env.local and fill in your API key."
    );
  }

  _client = new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL ?? undefined,
  });

  return _client;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Call LLM with text messages and return the text response.
 */
export async function chatCompletion(
  messages: LlmMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const client = getClient();
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  const resp = await client.chat.completions.create({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens,
  });

  return resp.choices[0]?.message?.content ?? "";
}

/**
 * Convenience: text-only generation with system + user prompt.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    options
  );
}

/**
 * Vision completion: send an image (base64) + text prompt to the LLM.
 * Used for manga OCR.
 */
export async function visionCompletion(
  systemPrompt: string,
  imageBase64: string,
  imageMimeType: string,
  userPrompt: string
): Promise<string> {
  const client = getClient();
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: userPrompt,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageMimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });

  return resp.choices[0]?.message?.content ?? "";
}

/** Reset cached client (for testing). */
export function resetLlmClient(): void {
  _client = null;
}
