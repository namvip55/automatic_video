/**
 * script-generator.ts
 *
 * Auto-generate a script.json for the video pipeline from MangaChapter data.
 *
 * Fixed for Manga Mode (Readability Optimized):
 *   - 1 Page = 1 Scene.
 *   - Each scene has a fixed duration of ~5 seconds (via TTS fallback or pipeline).
 *   - Video chunking: maximum 10 pages per video to ensure Shorts pacing.
 */

import type { MangaChapter } from "./manga-scraper.js";

export interface MangaScriptOptions {
  /** Channel name for branding (default: "Truyện Tranh TV") */
  channelName?: string;
  /** Fixed duration per page in seconds (default: 5) */
  pageDisplaySec?: number;
  /** BGM genre keyword (default: "default") */
  bgmGenre?: string;
  /** BGM volume 0-1 (default: 0.2) */
  bgmVolume?: number;
  /** Theme (default: "cyber") */
  theme?: "classic" | "gold" | "emerald" | "sunset" | "cyber";
  /** Skip TTS (manga mode - no voice narration, just BGM) */
  skipTts?: boolean;
  /** Prefix for image paths (default: "pages") */
  imagePathPrefix?: string;
  /** Extracted OCR texts for each page */
  ocrTexts?: string[];
}

const KEN_BURNS_EFFECTS = ["zoom-in", "zoom-out", "pan-left", "pan-right"] as const;
type KenBurnsEffect = (typeof KEN_BURNS_EFFECTS)[number];

function getKenBurns(index: number): KenBurnsEffect {
  return KEN_BURNS_EFFECTS[index % KEN_BURNS_EFFECTS.length];
}

/**
 * Generate script.json content for manga video pipeline (chunked).
 * Uses a padded voiceText to force TTS to run for ~5 seconds per page.
 */
export function generateMangaScript(
  chapter: MangaChapter,
  localPagePaths: string[],
  options: MangaScriptOptions = {},
): Record<string, any> {
  const {
    channelName = "Truyện Tranh TV",
    bgmGenre = "default",
    bgmVolume = 0.2,
    theme = "cyber",
    skipTts = true,
    imagePathPrefix = "pages",
    ocrTexts = [],
    pageDisplaySec = 5,
  } = options;

  // If we have OCR texts, we definitely want TTS
  const finalSkipTts = ocrTexts.length > 0 ? false : skipTts;

  const totalPages = localPagePaths.length;

  // ── Build scenes ────────────────────────────────────────────────────────
  const scenes: Record<string, any>[] = [];

  // Scene 0: Hook
  scenes.push({
    id: "hook",
    type: "hook",
    // intro voice text
    voiceText: `${chapter.title || "Truyện Tranh"}. ${chapter.chapter}.`,
    visual: {
      bgSrc: localPagePaths[0] ? `${imagePathPrefix}/${getFilename(localPagePaths[0])}` : "$source.image",
    },
    templateData: {
      template: "hook",
      headline: truncate(chapter.title || "Truyện Tranh", 40),
      subhead: truncate(chapter.chapter || "Chapter", 40),
      kenBurns: "zoom-in",
    },
  });

  // Body scenes: exactly 1 page per scene
  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1; // 1-based
    const pagePath = localPagePaths[i];
    const relPath = `${imagePathPrefix}/${getFilename(pagePath)}`;

    // Use OCR text if available, otherwise silent dot
    const voiceText = ocrTexts[i] || ".";

    const scene: Record<string, any> = {
      id: `manga-${i}`,
      type: "body",
      voiceText: voiceText,
      visual: {
        bgSrc: relPath,
      },
      templateData: {
        template: "manga-panel",
        pageNumber: pageNum,
        totalPages: chapter.pages.length || totalPages, // use full chapter total
        mangaTitle: truncate(chapter.title || "Truyện Tranh", 60),
        chapterTitle: truncate(chapter.chapter || "Chapter", 80),
        kenBurns: getKenBurns(i),
        pageSrc: relPath,
      },
      kenBurns: getKenBurns(i),
    };

    // If no OCR text (silent mode), use fallback duration
    if (voiceText.trim() === "." || voiceText.trim() === "") {
      scene.targetDuration = pageDisplaySec;
    }

    scenes.push(scene);
  }

  // Outro scene
  const nextChapter = chapter.chapterList.find(
    (c) =>
      c.name.toLowerCase().includes(`chap ${chapter.chapterNumber + 1}`) ||
      c.name.toLowerCase().includes(`chapter ${chapter.chapterNumber + 1}`) ||
      c.name.toLowerCase().includes(`chương ${chapter.chapterNumber + 1}`),
  );
  const ctaText = nextChapter
    ? `Đọc tiếp ${nextChapter.name}`
    : "Follow để đọc tiếp";

  scenes.push({
    id: "outro",
    type: "outro",
    voiceText: "Cảm ơn bạn đã theo dõi. Hãy theo dõi Nép si lon để xem các video thú vị nhé.",
    visual: { background: { type: "gradient" } },
    templateData: {
      template: "outro",
      ctaTop: truncate(ctaText, 30),
      channelName: truncate(channelName, 30),
      source: chapter.source,
    },
  });

  // ── Build root script ─────────────────────────────────────────────────
  return {
    version: "1.0",
    metadata: {
      title: `${chapter.title} - ${chapter.chapter}`,
      source: {
        url: "",  // Will be set by caller
        domain: chapter.source,
        image: chapter.coverImage,
      },
      channel: channelName,
      theme,
      mode: "manga",
    },
    voice: {
      provider: "lucylab",
      voiceId: "${VIETNAMESE_VOICEID}",
      speed: 1.0,
    },
    bgm: {
      src: bgmGenre,
      volume: bgmVolume,
      fadeInSec: 2,
      fadeOutSec: 3,
    },
    scenes,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getFilename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/**
 * Convert small numbers to Vietnamese words (for voiceText TTS).
 * Only used for page numbers (1-999).
 */
function numberToVietnamese(n: number): string {
  if (n <= 0 || n > 999) return String(n);

  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi",
    "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];

  if (n < 10) return units[n];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return tens[t];
    if (u === 1 && t > 1) return `${tens[t]} mốt`;
    if (u === 5 && t > 1) return `${tens[t]} lăm`;
    return `${tens[t]} ${units[u]}`;
  }
  // 100-999
  const h = Math.floor(n / 100);
  const remainder = n % 100;
  if (remainder === 0) return `${units[h]} trăm`;
  if (remainder < 10) return `${units[h]} trăm lẻ ${units[remainder]}`;
  return `${units[h]} trăm ${numberToVietnamese(remainder)}`;
}
