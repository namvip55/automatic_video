import axios from "axios";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface FetchResult {
  success: boolean;
  path?: string;
  reason?: string;
}

export async function fetchImage(url: string | null, outPath: string): Promise<FetchResult> {
  if (!url) return { success: false, reason: "no url provided (null)" };

  try {
    const resp = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      validateStatus: (s) => s < 400,
    });

    const ct = String(resp.headers["content-type"] ?? "");
    if (!ct.startsWith("image/")) {
      return { success: false, reason: `non-image content-type: ${ct}` };
    }

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, Buffer.from(resp.data));
    return { success: true, path: outPath };
  } catch (e: any) {
    const status = e.response?.status;
    return { success: false, reason: status ? `http ${status}` : String(e.message ?? e) };
  }
}

/**
 * Search Pexels Photos API for a keyword and download the best matching image.
 * Prefers landscape/portrait orientation=portrait for 9:16 video.
 * Falls back gracefully if API key is missing or quota exceeded.
 */
export async function fetchPexelsImage(
  keyword: string,
  outPath: string,
  pexelsApiKey: string | undefined,
): Promise<FetchResult> {
  if (!pexelsApiKey) {
    return { success: false, reason: "PEXELS_API_KEY not configured" };
  }

  try {
    // Search Pexels Photos endpoint
    const searchResp = await axios.get<any>("https://api.pexels.com/v1/search", {
      params: {
        query: keyword,
        per_page: 5,
        orientation: "portrait",
      },
      headers: { Authorization: pexelsApiKey },
      timeout: 15000,
    });

    const photos: any[] = searchResp.data?.photos ?? [];
    if (photos.length === 0) {
      return { success: false, reason: `no Pexels photos found for keyword: "${keyword}"` };
    }

    // Pick best photo: prefer tall (portrait) aspect ratio for 9:16 frame
    const best = photos.reduce((a, b) => {
      const aRatio = a.height / a.width;
      const bRatio = b.height / b.width;
      return bRatio > aRatio ? b : a;
    });

    // Use "large2x" (1880px wide) or "large" as fallback
    const imageUrl: string = best.src?.large2x ?? best.src?.large ?? best.src?.original;
    if (!imageUrl) {
      return { success: false, reason: "Pexels photo has no usable src URL" };
    }

    return fetchImage(imageUrl, outPath);
  } catch (e: any) {
    const status = e.response?.status;
    if (status === 429) return { success: false, reason: "Pexels rate limit exceeded (429)" };
    if (status === 401) return { success: false, reason: "Pexels API key invalid (401)" };
    return { success: false, reason: status ? `http ${status}` : String(e.message ?? e) };
  }
}
