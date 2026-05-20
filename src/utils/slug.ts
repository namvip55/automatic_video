import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export function toSlug(input: string): string {
  if (!input || !input.trim()) return "untitled";

  const noDiacritics = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

  let slug = noDiacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > 40) {
    slug = slug.substring(0, 40).replace(/-+[^-]*$/, "");
    if (!slug) {
      slug = noDiacritics
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .substring(0, 40);
    }
    slug = slug.replace(/^-+|-+$/g, "");
  }

  return slug || "untitled";
}

/**
 * Scans the output directory and returns the next 3-digit sequence prefix.
 * e.g. "001", "002", etc.
 */
export function getNextSequencePrefix(outputBaseDir: string = "output"): string {
  if (!existsSync(outputBaseDir)) {
    return "001";
  }

  const items = readdirSync(outputBaseDir, { withFileTypes: true });
  const dirs = items
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  let maxSeq = 0;
  for (const dir of dirs) {
    const match = dir.match(/^(\d{3})_/);
    if (match) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  return (maxSeq + 1).toString().padStart(3, "0");
}
