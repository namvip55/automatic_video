#!/usr/bin/env node
/**
 * story-cli.ts
 *
 * CLI entry point for Story Mode — standalone, no agent needed.
 *
 * Usage:
 *   npm run story -- "chủ đề truyện"              # Generate story from topic → render
 *   npm run story -- "chủ đề" --theme cyber         # With theme override
 *   npm run story -- "chủ đề" --channel "My"       # With channel name
 *   npm run story -- --file story.txt               # From file content
 *   npm run story -- "chủ đề" --script-only          # Only generate script.json
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { join } from "node:path";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { generateStoryScript } from "./content/story-script-generator.js";
import { runPipeline } from "./pipeline.js";
import { log } from "./utils/logger.js";
import { toSlug as slugify, getNextSequencePrefix } from "./utils/slug.js";

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  const themeIdx = args.indexOf("--theme");
  const channelIdx = args.indexOf("--channel");
  const scriptOnly = args.includes("--script-only");

  // Get topic/content from args or file
  let topicOrContent: string | undefined;

  if (fileIdx >= 0) {
    const filePath = args[fileIdx + 1];
    if (!filePath) {
      console.error("Error: --file requires a path argument");
      process.exit(2);
    }
    topicOrContent = await readFile(filePath, "utf8");
  } else {
    const positionalArgs = args.filter((a) => !a.startsWith("--"));
    topicOrContent = positionalArgs.join(" ");
  }

  if (!topicOrContent) {
    console.error("Usage: npm run story -- \"chủ đề\" [--theme <theme>] [--channel <name>] [--script-only]");
    console.error("       npm run story -- --file <path/to/story.txt>");
    console.error("");
    console.error("Options:");
    console.error("  --file <path>       Read story content from file (.txt or .md)");
    console.error("  --theme <theme>     Color theme: classic|gold|emerald|sunset|cyber (default: classic)");
    console.error("  --channel <name>    Channel name for branding");
    console.error("  --script-only       Only generate script.json, don't render video");
    process.exit(2);
  }

  const theme = themeIdx >= 0 ? args[themeIdx + 1] : undefined;
  const channel = channelIdx >= 0 ? args[channelIdx + 1] : undefined;

  try {
    // ── Step 1: Generate story script via LLM ───────────────────────────────
    log.info("📖 Story Video Generator");
    const preview = topicOrContent.length > 100 ? topicOrContent.slice(0, 100) + "..." : topicOrContent;
    log.info(`Input: ${preview}`);
    log.info("");
    log.info("🤖 Generating story script via LLM...");
    const script = await generateStoryScript(topicOrContent, { theme, channel });
    log.ok(`Script generated — ${script.scenes.length} scenes, title: "${script.metadata.title}"`);

    // ── Step 2: Create output directory ──────────────────────────────────────
    const slug = slugify(script.metadata.title);
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

    // ── Step 3: Run pipeline ─────────────────────────────────────────────────
    log.info("");
    log.info("🎬 Starting pipeline...");
    await runPipeline(scriptPath);
  } catch (e) {
    log.error("Story pipeline failed", e);
    process.exit(1);
  }
}

main();
