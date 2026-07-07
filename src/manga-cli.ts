#!/usr/bin/env node
/**
 * manga-cli.ts
 *
 * CLI entry point for manga-to-video pipeline.
 *
 * Usage:
 *   npm run manga -- <url>                    # Scrape + generate + render
 *   npm run manga -- <url> --scrape-only      # Only scrape + download images
 *   npm run manga -- <script.json>            # Run pipeline from existing script
 *
 * The CLI:
 *   1. Detects input type (URL vs file)
 *   2. Scrapes manga chapter from URL (direct HTML parse)
 *   3. Downloads page images to output dir
 *   4. Generates script.json
 *   5. Runs the video pipeline
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { join, basename } from "node:path";
import { readFile, writeFile, mkdir, cp, stat } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { scrapeMangaChapter, isMangaUrl } from "./manga/manga-scraper.js";
import { downloadMangaPages, getSuccessfulPages } from "./manga/image-downloader.js";
import { generateMangaScript } from "./manga/script-generator.js";
import { ocrMangaPages, filterOcrTextsWithLlm } from "./content/manga-ocr.js";
import { runPipeline } from "./pipeline.js";
import { log } from "./utils/logger.js";

async function main() {
  const args = process.argv.slice(2);
  let input = args.find((a) => !a.startsWith("--"));
  const scrapeOnly = args.includes("--scrape-only");
  
  // Parse --part flag: --part N or --part=N
  const partArg = args.find((a) => a.startsWith("--part"));
  let partNum: number | null = null;
  if (partArg) {
    const match = partArg.match(/^--part(?:=(\d+))?$/);
    if (match) {
      if (match[1]) {
        partNum = parseInt(match[1], 10);
      } else {
        // --part N format (space-separated)
        const idx = args.indexOf(partArg);
        if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
          partNum = parseInt(args[idx + 1], 10);
        }
      }
    }
    if (!partNum || isNaN(partNum)) {
      console.error("Error: --part flag requires a number (e.g., --part 1 or --part=1)");
      process.exit(2);
    }
  }

  if (!input) {
    console.error("Usage: npm run manga -- <url|script.json|directory>");
    console.error("");
    console.error("  <url>           Manga chapter URL (auto-detected)");
    console.error("  <script.json>   Path to existing script.json");
    console.error("  <directory>     Path to local manga page images");
    console.error("");
    console.error("Options:");
    console.error("  --scrape-only   Only scrape + download images, don't render video");
    console.error("  --part N        Process only part N (1-indexed). Required when multiple parts exist.");
    console.error("  --full          Generate a single long video instead of chunks (local mode only)");
    process.exit(2);
  }

  // Sanitize input by removing literal quotes if passed by the shell
  input = input.replace(/^["']|["']$/g, "");

  try {
    // If input is a directory, treat as local manga pages
    if (existsSync(input) && (await stat(input)).isDirectory()) {
      const isFullMovie = args.includes("--full");
      log.info(`Running pipeline for local images in: ${input} (Mode: ${isFullMovie ? "Full Movie" : "Chunked"})`);
      await runLocalMangaPipeline(input, scrapeOnly, isFullMovie);
      return;
    }

    // If input is a JSON file, run pipeline directly
    if (input.endsWith(".json")) {
      log.info(`Running pipeline from: ${input}`);
      await runPipeline(input);
      return;
    }

    // Otherwise, treat as URL
    if (!input.startsWith("http") && !input.endsWith(".md")) {
      console.error(`Error: "${input}" is not a valid URL, .json file, or .md file`);
      process.exit(2);
    }

    if (input.endsWith(".md")) {
      const markdown = await readFile(input, "utf8");
      await runMangaPipelineWithMarkdown(markdown, input, scrapeOnly);
    } else {
      await runMangaPipeline(input, scrapeOnly);
    }
  } catch (e) {
    log.error("Manga pipeline failed", e);
    process.exit(1);
  }
}

async function runLocalMangaPipeline(dir: string, scrapeOnly: boolean, isFullMovie: boolean) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".jpg") || f.endsWith(".png") || f.endsWith(".webp"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

  if (files.length === 0) {
    console.error(`No images found in ${dir}`);
    process.exit(1);
  }

  const pagePaths = files.map((f) => join(dir, f));
  const chapter = {
    title: basename(dir),
    chapter: "Local Chapter",
    chapterNumber: 1,
    source: "local",
    coverImage: "",
    pages: [],
    totalChapters: 0, tags: [], chapterList: [],
  };

  const slug = generateSlug(chapter.title, 1);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 13);
  const seqNum = await getNextSequenceNumber("output");
  const outputDir = join("output", `${seqNum}_${slug}-${timestamp}`);
  await mkdir(outputDir, { recursive: true });

  // Create pages folder and copy images
  const pagesDir = join(outputDir, "pages");
  await mkdir(pagesDir, { recursive: true });
  for (const file of files) {
    await cp(join(dir, file), join(pagesDir, file));
  }

  // OCR manga pages via LLM vision
  log.info("🔍 OCR manga pages (Vietnamese)...");
  const ocrPagePaths = pagePaths.map((p) => join(pagesDir, basename(p)));
  let ocrTexts: string[] = [];
  try {
    ocrTexts = await ocrMangaPages(ocrPagePaths, { concurrency: 3 });
    const filledCount = ocrTexts.filter((t) => t.trim() && t.trim() !== ".").length;
    log.ok(`OCR complete: ${filledCount}/${ocrPagePaths.length} pages have text`);
  } catch (e: any) {
    log.warn(`OCR failed (${e.message}) — continuing without voice narration`);
  }

  if (isFullMovie) {
    const hasOcrText = ocrTexts.some((t) => t.trim() && t.trim() !== ".");
    const script = generateMangaScript(chapter, pagePaths, {
      channelName: "Truyện Tranh TV",
      theme: "cyber",
      skipTts: !hasOcrText,
      imagePathPrefix: "pages",
      ocrTexts,
    });
    const scriptPath = join(outputDir, "script.json");
    await writeFile(scriptPath, JSON.stringify(script, null, 2));
    await runPipeline(scriptPath);
  } else {
    // Chunked mode
    const CHUNK_SIZE = 10;
    for (let i = 0; i < pagePaths.length; i += CHUNK_SIZE) {
      const partNum = Math.floor(i / CHUNK_SIZE) + 1;
      const chunk = pagePaths.slice(i, i + CHUNK_SIZE);
      const chunkOcrTexts = ocrTexts.slice(i, i + CHUNK_SIZE);
      const hasOcrText = chunkOcrTexts.some((t) => t.trim() && t.trim() !== ".");
      const partDir = join(outputDir, `part-${partNum}`);
      await mkdir(partDir, { recursive: true });

      const script = generateMangaScript(
        { ...chapter, chapter: `Phần ${partNum}` },
        chunk,
        {
          channelName: "Truyện Tranh TV",
          theme: "cyber",
          skipTts: !hasOcrText,
          imagePathPrefix: "pages",
          ocrTexts: chunkOcrTexts,
        }
      );
      const scriptPath = join(partDir, "script.json");
      await writeFile(scriptPath, JSON.stringify(script, null, 2));
      // Copy pages to partDir
      const partPagesDir = join(partDir, "pages");
      await cp(pagesDir, partPagesDir, { recursive: true });
      await runPipeline(scriptPath);
    }
  }
}

async function runMangaPipelineWithMarkdown(markdown: string, source: string, scrapeOnly: boolean) {
  // If source is a file path, we want to treat it as a generic source or use domain if possible
  const url = source.endsWith(".md") ? `https://${basename(source)}` : source;
  const chapter = scrapeMangaChapter(markdown, {}, url);
  log.info(`  Title: ${chapter.title}`);
  log.info(`  Chapter: ${chapter.chapter} (#${chapter.chapterNumber})`);
  log.info(`  Pages found: ${chapter.pages.length}`);
  log.info(`  Source: ${chapter.source}`);

  await processChapter(chapter, url, scrapeOnly);
}

async function runMangaPipeline(url: string, scrapeOnly: boolean) {
  log.info(`🎬 Manga-to-Video Pipeline`);
  log.info(`URL: ${url}`);
  log.info("");

  // ── Step 1: Scrape URL ────────────────────────────────────────────────
  log.info("📖 Step 1: Scraping manga chapter...");

  let markdown: string | null = null;

  markdown = await fetchPageMarkdown(url);

  if (!markdown) {
    console.error("Failed to fetch page content (e.g. 403 Forbidden). Try saving page content to a local file and run manga mode from that file.");
    process.exit(1);
  }

  const chapter = scrapeMangaChapter(markdown, {}, url);
  log.info(`  Title: ${chapter.title}`);
  log.info(`  Chapter: ${chapter.chapter} (#${chapter.chapterNumber})`);
  log.info(`  Pages found: ${chapter.pages.length}`);
  log.info(`  Source: ${chapter.source}`);

  if (chapter.pages.length === 0) {
    console.error("No manga pages found. The URL may not be supported.");
    process.exit(1);
  }

  await processChapter(chapter, url, scrapeOnly);
}

async function processChapter(chapter: any, url: string, scrapeOnly: boolean) {
  // ── Step 2: Create output directory ───────────────────────────────────
  const slug = generateSlug(chapter.title, chapter.chapterNumber);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 13);
  const seqNum = await getNextSequenceNumber("output");
  const outputDirName = `${seqNum}_${slug}-${timestamp}`;
  const outputDir = join("output", outputDirName);
  await mkdir(outputDir, { recursive: true });
  log.info(`  Output: ${outputDir}`);

  // ── Step 3: Download images ───────────────────────────────────────────
  log.info("📥 Step 2: Downloading manga pages...");
  const pagesDir = join(outputDir, "pages");
  const results = await downloadMangaPages(chapter.pages, {
    outputDir: pagesDir,
    concurrency: 5,
    referer: `https://${chapter.source}/`,
  });

  const successfulPages = getSuccessfulPages(results);
  const failCount = results.filter((r) => !r.success).length;
  log.info(`  Downloaded: ${successfulPages.length}/${chapter.pages.length} pages`);
  if (failCount > 0) {
    log.warn(`  Failed: ${failCount} pages`);
  }

  if (successfulPages.length === 0) {
    console.error("No pages downloaded successfully. Check CDN access.");
    process.exit(1);
  }

  if (scrapeOnly) {
    log.info("");
    log.info(`✅ Scrape complete. Images saved to: ${pagesDir}`);
    return;
  }

  // ── Step 3.5: OCR manga pages via LLM vision ───────────────────────────
  log.info("🔍 Step 3: OCR manga pages (Vietnamese)...");
  const ocrPagePaths = successfulPages.map((p) => join(pagesDir, basename(p)));
  let ocrTexts: string[] = [];
  try {
    ocrTexts = await ocrMangaPages(ocrPagePaths, { concurrency: 3 });
    const filledCount = ocrTexts.filter((t) => t.trim() && t.trim() !== ".").length;
    log.ok(`OCR complete: ${filledCount}/${ocrPagePaths.length} pages have text`);
  } catch (e: any) {
    log.warn(`OCR failed (${e.message}) — continuing without voice narration`);
  }

  // ── Step 4: Generate script.json ──────────────────────────────────────
  log.info("📝 Step 4: Generating script.json (Chunked mode)...");

  const CHUNK_SIZE = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < successfulPages.length; i += CHUNK_SIZE) {
    chunks.push(successfulPages.slice(i, i + CHUNK_SIZE));
  }

  log.info(`  Total chunks: ${chunks.length} (${CHUNK_SIZE} pages each)`);

  for (let i = 0; i < chunks.length; i++) {
    const partNum = i + 1;
    const chunk = chunks[i];
    const chunkOcrTexts = ocrTexts.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + chunk.length);
    const hasOcrText = chunkOcrTexts.some((t) => t.trim() && t.trim() !== ".");

    const partDir = chunks.length > 1 ? join(outputDir, `part-${partNum}`) : outputDir;
    if (chunks.length > 1) {
      await mkdir(partDir, { recursive: true });
    }

    const partChapter = {
      ...chapter,
      chapter: chunks.length > 1 ? `${chapter.chapter} (Phần ${partNum})` : chapter.chapter,
    };

    const script = generateMangaScript(partChapter, chunk, {
      channelName: "Truyện Tranh TV",
      theme: "cyber",
      skipTts: !hasOcrText, // Enable TTS only if OCR text is available
      imagePathPrefix: "pages",
      ocrTexts: chunkOcrTexts,
    });

    script.metadata.source.url = url;

    const scriptPath = join(partDir, "script.json");
    await writeFile(scriptPath, JSON.stringify(script, null, 2));

    // Copy pages folder to partDir so Hyperframes can find images at "pages/..."
    const partPagesDir = join(partDir, "pages");
    if (!existsSync(partPagesDir)) {
      log.info(`  [Part ${partNum}] Copying pages to: ${partPagesDir}`);
      await cp(pagesDir, partPagesDir, { recursive: true });
    }

    log.info(`  [Part ${partNum}] Script: ${scriptPath} (${script.scenes.length} scenes, TTS: ${hasOcrText ? "ON" : "OFF"})`);

    // ── Step 5: Run video pipeline ────────────────────────────────────────
    log.info(`🎬 [Part ${partNum}] Running video pipeline...`);
    try {
      await runPipeline(scriptPath);
    } catch (err) {
      log.error(`  [Part ${partNum}] Failed:`, err);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Fetch page as pseudo-markdown with direct HTTP and image extraction.
 * Handles lazy-loaded data-src/data-original image attributes.
 */
async function fetchPageMarkdown(url: string): Promise<string | null> {
  try {
    const { default: axios } = await import("axios");
    const resp = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    // Convert HTML to pseudo-markdown by extracting img tags
    const html: string = resp.data;
    const imgRegex = /<img[^>]+>/gi;
    const lines: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = imgRegex.exec(html)) !== null) {
      const imgTag = match[0];

      // Try to get data-src or data-original first (lazy load)
      let src = "";
      const dataSrcMatch = imgTag.match(/data-(?:src|original|lazy|cdn-src)=["']([^"']+)["']/i);
      if (dataSrcMatch) {
        src = dataSrcMatch[1];
      } else {
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
        if (srcMatch) src = srcMatch[1];
      }

      if (src) {
        lines.push(`![page](${src})`);
      }
    }

    // Also extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      lines.unshift(`# ${titleMatch[1].trim()}`);
    }

    return lines.join("\n");
  } catch (e: any) {
    log.warn(`Failed to fetch URL: ${e.message}`);
    return null;
  }
}

function generateSlug(title: string, chapterNum: number): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // Remove diacritics
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    + `-chap-${chapterNum}`;
}

async function getNextSequenceNumber(outputDir: string): Promise<string> {
  if (!existsSync(outputDir)) return "001";
  try {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(outputDir);
    let maxNum = 0;
    for (const entry of entries) {
      const match = entry.match(/^(\d{3})_/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return String(maxNum + 1).padStart(3, "0");
  } catch {
    return "001";
  }
}

main();
