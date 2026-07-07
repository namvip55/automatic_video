/**
 * check-llm.ts
 *
 * Simple LLM connectivity check: sends a "hello" prompt and verifies response.
 * Run: npm run check:llm
 *
 * Reads LLM_API_KEY, LLM_BASE_URL, LLM_MODEL from .env.local (or env).
 */

import "dotenv/config";
import OpenAI from "openai";

async function main() {
  const apiKey = process.env.LLM_API_KEY;
  const baseURL = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL ?? "gpt-4o";

  if (!apiKey) {
    console.error("❌ Missing LLM_API_KEY. Set it in .env.local");
    process.exit(1);
  }

  console.log("🔍 Checking LLM connectivity...");
  console.log(`   Base URL : ${baseURL ?? "(default OpenAI)"}`);
  console.log(`   Model    : ${model}`);

  const client = new OpenAI({ apiKey, baseURL: baseURL || undefined });

  try {
    const start = Date.now();
    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: "user", content: "Hello, just reply 'OK' if you receive this message. Only reply with the word OK, nothing else." },
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const elapsed = Date.now() - start;
    const content = resp.choices[0]?.message?.content ?? "";

    console.log(`✅ LLM responded in ${elapsed}ms`);
    console.log(`   Response: "${content.trim()}"`);

    if (resp.usage) {
      console.log(`   Tokens: prompt=${resp.usage.prompt_tokens}, completion=${resp.usage.completion_tokens}, total=${resp.usage.total_tokens}`);
    }
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; code?: string };
    console.error(`❌ LLM check failed`);
    console.error(`   Status : ${e.status ?? "N/A"}`);
    console.error(`   Code   : ${e.code ?? "N/A"}`);
    console.error(`   Message: ${e.message ?? String(err)}`);
    process.exit(1);
  }
}

main();
