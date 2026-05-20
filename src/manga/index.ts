/**
 * manga/index.ts
 *
 * Main entry point for manga-to-video pipeline.
 * Orchestrates: scrape → download → generate script → run pipeline.
 */

export { scrapeMangaChapter, isMangaUrl, parseMarkdownForImages, extractMetadata } from "./manga-scraper.js";
export type { MangaChapter, ChapterLink } from "./manga-scraper.js";
export { downloadMangaPages, getSuccessfulPages } from "./image-downloader.js";
export type { DownloadResult, DownloadOptions } from "./image-downloader.js";
export { generateMangaScript } from "./script-generator.js";
export type { MangaScriptOptions } from "./script-generator.js";
