/**
 * manga-scraper.ts
 *
 * Scrape manga chapter pages from supported sites.
 * Input: URL of a manga chapter page.
 * Output: MangaChapter object with metadata + ordered list of page image URLs.
 *
 * Supported sites (pattern-based parsing):
 *   - comi.mobi (wp-manga)
 *   - damconuong.lol / damconuong.cx
 *   - Generic fallback: any page with sequential <img> tags pointing to a CDN
 */

export interface MangaChapter {
  /** Manga title (e.g. "Công Dân Người Thú") */
  title: string;
  /** Chapter name (e.g. "Chap 1: Tokyo, Thành Phố Công Dân") */
  chapter: string;
  /** Numeric chapter number (1-based) */
  chapterNumber: number;
  /** Ordered array of page image URLs */
  pages: string[];
  /** Total chapters available (0 if unknown) */
  totalChapters: number;
  /** Source domain (e.g. "comi.mobi") */
  source: string;
  /** Cover / og:image URL (if available) */
  coverImage: string | null;
  /** Tags / genres */
  tags: string[];
  /** All chapter URLs (for multi-chapter scraping) */
  chapterList: ChapterLink[];
}

export interface ChapterLink {
  name: string;
  url: string;
}

// ── Known CDN domains for manga image URLs ────────────────────────────────
const MANGA_CDN_PATTERNS = [
  /cdn\.comico\.la/,
  /dcnvn\d*\.mbpro\.vip/,
  /img\.wattpad\.com/,
  /i\d*\.nhentai\.net/,
  /uploads\.mangadex\.org/,
  /cdn\.manga/,
  /storage.*manga/i,
  /img.*manga/i,
  /assets.*manga/i,
  /static3t\.com/i, // truyenqq
  /\.jpg$/i,
  /\.png$/i,
  /\.webp$/i,
];

// ── Image URL filters (exclude non-manga images) ─────────────────────────
const EXCLUDED_PATTERNS = [
  /favicon/i,
  /logo/i,
  /avatar/i,
  /icon/i,
  /banner/i,
  /ads?[_-]/i,
  /advertisement/i,
  /google/i,
  /facebook/i,
  /twitter/i,
  /wattpad\.com\/cover/,     // Wattpad cover thumbnails
  /75x106/,                  // Thumbnail sizes
  /80-k/,                    // Wattpad small thumbnails
  /useravatar/,
  /dflazy/,                  // Lazy load placeholder
  /ezgif/,                   // Animated GIF ads
  /blogger\.googleusercontent/,
  /s\.shopee\.vn/i,          // Shopee affiliate links
  /media\/images/i,          // Generic ad banners / UI images
  // Common lazy-load placeholders
  /data:image/,
  /placeholder/,
  /blank\.gif/,
];

/**
 * Parse a markdown-like string to extract manga page images.
 *
 * Supports markdown images, raw image URLs, and lazy-load data-src/data-original attributes.
 * We filter for manga-specific CDN URLs and exclude UI elements.
 */
export function parseMarkdownForImages(markdown: string): string[] {
  const images: string[] = [];

  // 1. Standard markdown image syntax: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(markdown)) !== null) {
    const url = match[2].trim();
    if (isValidMangaImage(url)) {
      images.push(url);
    }
  }

  // 2. Look for raw URLs that might be images but not in markdown syntax
  const rawUrlRegex = /(https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?)/gi;
  while ((match = rawUrlRegex.exec(markdown)) !== null) {
    const url = match[1];
    if (isValidMangaImage(url)) {
      images.push(url);
    }
  }

  // 3. Handle data-src / data-original patterns inside HTML tags
  const dataSrcRegex = /data-(?:src|original|lazy|cdn-src)=["'](https?:\/\/[^"']+)["']/gi;
  while ((match = dataSrcRegex.exec(markdown)) !== null) {
    const url = match[1];
    if (isValidMangaImage(url)) {
      images.push(url);
    }
  }

  return deduplicateUrls(images);
}

function isValidMangaImage(url: string): boolean {
  // Skip excluded patterns (ads, avatars, icons, etc.)
  if (EXCLUDED_PATTERNS.some((p) => p.test(url))) return false;

  // Accept if URL matches known CDN patterns
  const isMangaCdn = MANGA_CDN_PATTERNS.some((p) => p.test(url));
  return isMangaCdn;
}

/**
 * Extract manga metadata from markdown-like page content.
 */
export function extractMetadata(
  markdown: string,
  metadata: Record<string, any>,
  url: string,
): Partial<MangaChapter> {
  const domain = new URL(url).hostname;
  const result: Partial<MangaChapter> = {
    source: domain,
    coverImage: metadata?.ogImage ?? metadata?.["og:image"] ?? null,
    tags: [],
    chapterList: [],
  };

  // ── Site-specific parsing ─────────────────────────────────────────────
  if (domain.includes("comi.mobi")) {
    return { ...result, ...parseComiMobi(markdown, metadata) };
  }
  if (domain.includes("damconuong")) {
    return { ...result, ...parseDamCoNuong(markdown, metadata) };
  }
  if (domain.includes("truyenqq")) {
    return { ...result, ...parseTruyenQq(markdown, metadata) };
  }

  // ── Generic parsing ───────────────────────────────────────────────────
  return { ...result, ...parseGeneric(markdown, metadata) };
}

/**
 * Parse comi.mobi (wp-manga) specific structure.
 */
function parseComiMobi(
  markdown: string,
  metadata: Record<string, any>,
): Partial<MangaChapter> {
  const result: Partial<MangaChapter> = {};

  // Title from og:title or markdown heading
  let ogTitle = metadata?.ogTitle ?? metadata?.["og:title"] ?? metadata?.title ?? "";

  if (!ogTitle) {
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      ogTitle = headingMatch[1].trim();
    }
  }

  const titleParts = ogTitle.split("-").map((p: string) => p.trim());

  if (titleParts.length >= 2) {
    result.title = titleParts[0];
    result.chapter = titleParts[1];
  } else {
    result.title = ogTitle;
    result.chapter = "Chapter 1";
  }

  // Extract chapter number
  const chapNumMatch = result.chapter?.match(/[Cc]hap(?:ter)?\s*(\d+)/);
  result.chapterNumber = chapNumMatch ? parseInt(chapNumMatch[1], 10) : 1;

  // Parse chapter list from markdown links
  const chapterLinks = parseChapterLinks(markdown, "comi.mobi");
  result.chapterList = chapterLinks;
  result.totalChapters = chapterLinks.length;

  // Tags from metadata
  if (metadata?.description) {
    const tagMatch = metadata.description.match(/Thẻ:\s*(.+)/);
    if (tagMatch) {
      result.tags = tagMatch[1].split(",").map((t: string) => t.trim());
    }
  }

  return result;
}

/**
 * Parse damconuong.lol specific structure.
 */
function parseDamCoNuong(
  markdown: string,
  metadata: Record<string, any>,
): Partial<MangaChapter> {
  const result: Partial<MangaChapter> = {};

  // Title from og:title or breadcrumb
  const ogTitle = metadata?.ogTitle ?? metadata?.["og:title"] ?? metadata?.title ?? "";

  // Try breadcrumb pattern: "Ngày Xửa Ngày Xưa Chương 1"
  const breadcrumbMatch = ogTitle.match(/^(.+?)\s+Chương\s+(\d+)/);
  if (breadcrumbMatch) {
    result.title = breadcrumbMatch[1].trim();
    result.chapterNumber = parseInt(breadcrumbMatch[2], 10);
    result.chapter = `Chương ${result.chapterNumber}`;
  } else {
    result.title = ogTitle;
    result.chapter = "Chapter 1";
    result.chapterNumber = 1;
  }

  // Chapter list
  const chapterLinks = parseChapterLinks(markdown, "damconuong");
  result.chapterList = chapterLinks;
  result.totalChapters = chapterLinks.length;

  return result;
}

function parseTruyenQq(
  markdown: string,
  metadata: Record<string, any>,
): Partial<MangaChapter> {
  const result: Partial<MangaChapter> = {};

  // Title from og:title or markdown heading
  let ogTitle = metadata?.ogTitle ?? metadata?.["og:title"] ?? metadata?.title ?? "";

  if (!ogTitle) {
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      ogTitle = headingMatch[1].trim();
    }
  }

  const titleParts = ogTitle.split("-").map((p: string) => p.trim());

  if (titleParts.length >= 2) {
    result.title = titleParts[0];
    result.chapter = titleParts[1];
  } else {
    // "Bộ Thiên Ca : Chapter 1"
    const splitColon = ogTitle.split(":").map((p: string) => p.trim());
    if (splitColon.length >= 2) {
      result.title = splitColon[0];
      result.chapter = splitColon[1];
    } else {
      result.title = ogTitle;
      result.chapter = "Chapter 1";
    }
  }

  // Extract chapter number
  const chapNumMatch = result.chapter?.match(/[Cc]hap(?:ter)?\s*(\d+)/);
  result.chapterNumber = chapNumMatch ? parseInt(chapNumMatch[1], 10) : 1;

  // Parse chapter list from markdown links
  const chapterLinks = parseChapterLinks(markdown, "truyenqq");
  result.chapterList = chapterLinks;
  result.totalChapters = chapterLinks.length;

  return result;
}

/**
 * Generic parser for unknown sites.
 */
function parseGeneric(
  markdown: string,
  metadata: Record<string, any>,
): Partial<MangaChapter> {
  const result: Partial<MangaChapter> = {};

  let title = metadata?.ogTitle ?? metadata?.["og:title"] ?? metadata?.title ?? "";

  if (!title) {
    const headingMatch = markdown.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      title = "Unknown Manga";
    }
  }

  result.title = title;
  result.chapter = "Chapter 1";

  // Try to extract chapter number from title or URL
  const chapMatch = title.match(/[Cc]hap(?:ter)?\s*(\d+)/);
  result.chapterNumber = chapMatch ? parseInt(chapMatch[1], 10) : 1;

  result.totalChapters = 0;
  result.chapterList = [];

  return result;
}

/**
 * Parse chapter navigation links from markdown.
 */
function parseChapterLinks(markdown: string, siteHint: string): ChapterLink[] {
  const linkRegex = /\[([^\]]*(?:[Cc]hap(?:ter)?[^\]]*|[Cc]hương[^\]]*))]\(([^)]+)\)/gi;
  const links: ChapterLink[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const name = match[1].trim();
    const url = match[2].trim();

    // Skip duplicates
    if (seen.has(url)) continue;
    seen.add(url);

    // Validate URL belongs to the site
    if (siteHint && !url.includes(siteHint)) continue;

    links.push({ name, url });
  }

  return links;
}

/**
 * Remove duplicate URLs while preserving order.
 */
function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

/**
 * Main scrape function: given markdown-like page content, metadata, and URL,
 * return a complete MangaChapter object with pages[] ready for download.
 */
export function scrapeMangaChapter(
  markdown: string,
  metadata: Record<string, any>,
  url: string,
): MangaChapter {
  const pages = parseMarkdownForImages(markdown);
  const meta = extractMetadata(markdown, metadata, url);

  return {
    title: meta.title ?? "Unknown Manga",
    chapter: meta.chapter ?? "Chapter 1",
    chapterNumber: meta.chapterNumber ?? 1,
    pages,
    totalChapters: meta.totalChapters ?? 0,
    source: meta.source ?? new URL(url).hostname,
    coverImage: meta.coverImage ?? null,
    tags: meta.tags ?? [],
    chapterList: meta.chapterList ?? [],
  };
}

/**
 * Detect if a URL is likely a manga/comic page.
 * Used by CLI to auto-detect manga mode.
 */
export function isMangaUrl(url: string): boolean {
  const mangaPatterns = [
    /comi\.mobi/i,
    /damconuong/i,
    /nhentai/i,
    /mangadex/i,
    /manga/i,
    /truyen/i,
    /chapter/i,
    /chap-/i,
    /webtoon/i,
    /hentaivn/i,
    /truyenqq/i,
    /nettruyen/i,
    /blogtruyen/i,
  ];
  return mangaPatterns.some((p) => p.test(url));
}
