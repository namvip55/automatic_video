#!/usr/bin/env node
/**
 * news-cli.ts
 *
 * CLI entry point for News Mode — standalone, no agent needed.
 *
 * Usage:
 *   npm run news -- <url>                    # Scrape URL → generate script → render
 *   npm run news -- <url> --theme cyber       # With theme override
 *   npm run news -- <url> --channel "My"     # With channel name
 *   npm run news -- <url> --script-only       # Only generate script.json, don't render
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import { fetchUrlContent } from "./content/url-fetcher.js";
import { generateNewsScript } from "./content/news-script-generator.js";
import { runPipeline } from "./pipeline.js";
import { log } from "./utils/logger.js";
import { toSlug as slugify, getNextSequencePrefix } from "./utils/slug.js";

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));

  if (!url) {
    console.error("Usage: npm run news -- <url> [--theme <theme>] [--channel <name>] [--script-only]");
    console.error("");
    console.error("Options:");
    console.error("  --theme <theme>    Color theme: classic|gold|emerald|sunset|cyber (default: classic)");
    console.error("  --channel <name>   Channel name for branding");
    console.error("  --script-only      Only generate script.json, don't render video");
    process.exit(2);
  }

  // Parse flags
  const themeIdx = args.indexOf("--theme");
  const theme = themeIdx >= 0 ? args[themeIdx + 1] : undefined;
  const channelIdx = args.indexOf("--channel");
  const channel = channelIdx >= 0 ? args[channelIdx + 1] : undefined;
  const scriptOnly = args.includes("--script-only");

  try {
    // ── Step 1: Fetch URL content ──────────────────────────────────────────
    log.info("📰 News Video Generator");
    log.info(`URL: ${url}`);
    log.info("");
    log.info("📥 Fetching content...");
    const content = await fetchUrlContent(url);
    log.ok(`Title: ${content.title}`);
    log.ok(`Domain: ${content.domain}`);
    log.info(`  Text: ${content.text.length} chars`);
    if (content.ogImage) {
      log.ok(`og:image found`);
    } else {
      log.warn(`No og:image — will use gradient fallback`);
    }
    log.info("");

    // ── Step 2: Generate script.json via LLM ────────────────────────────────
    log.info("🤖 Generating script.json via LLM...");
    const script = await generateNewsScript(content, { theme, channel });
    log.ok(`Script generated — ${script.scenes.length} scenes, title: "${script.metadata.title}"`);

    // ── Step 3: Create output directory ──────────────────────────────────────
    const slug = slugify(content.title);
    const seqNum = getNextSequencePrefix();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
    const outputDir = join("output", `${seqNum}_${slug}-${timestamp}`);
    await mkdir(outputDir, { recursive: true });

    const scriptPath = join(outputDir, "script.json");
    await writeFile(scriptPath, JSON.stringify(script, null, 2));
    log.ok(`Script saved: ${scriptPath}`);

    if (scriptOnly) {
      log.info("--script-only: skipping render");
      return;
    }

    // ── Step 4: Run pipeline ─────────────────────────────────────────────────
    log.info("");
    log.info("🎬 Starting pipeline...");
    await runPipeline(scriptPath);
  } catch (e) {
    log.error("News pipeline failed", e);
    process.exit(1);
  }
}

main();
