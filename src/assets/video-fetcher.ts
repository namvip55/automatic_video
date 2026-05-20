import axios from "axios";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { log } from "../utils/logger.js";

export interface VideoFetchResult {
  success: boolean;
  path?: string;
  reason?: string;
}

/**
 * Fetches a portrait stock video from Pexels based on keywords.
 * Returns the local path to the downloaded .mp4 file.
 */
export async function fetchStockVideo(
  query: string,
  outPath: string,
  apiKey: string | undefined
): Promise<VideoFetchResult> {
  if (!apiKey) return { success: false, reason: "PEXELS_API_KEY not set" };
  if (!query) return { success: false, reason: "no query provided" };

  try {
    log.info(`  Searching Pexels for: "${query}"...`);
    const searchUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=10&orientation=portrait`;

    const searchResp = await axios.get(searchUrl, {
      headers: { Authorization: apiKey },
      timeout: 10000,
    });

    const videos = searchResp.data.videos as any[];
    if (!videos || videos.length === 0) {
      return { success: false, reason: `no videos found for "${query}"` };
    }

    // Score videos: prefer longer duration (more dynamic content) and match motion keywords
    const motionKeywords = ['moving', 'running', 'spinning', 'blinking', 'scrolling', 'typing', 'walking', 'flowing', 'panning', 'zoom', 'action', 'active', 'dynamic'];
    const queryWords = query.toLowerCase().split(/[\s,]+/);

    const scored = videos.map(v => {
      let score = 0;
      const title = (v.title || '').toLowerCase();
      const duration = v.duration || 10;

      // Prefer videos with duration between 10-30s (good length, likely has motion)
      if (duration >= 10 && duration <= 30) score += 3;
      else if (duration > 30) score += 1;

      // Bonus for motion keywords in title
      for (const kw of motionKeywords) {
        if (title.includes(kw)) score += 2;
      }

      // Match query words in title
      for (const qw of queryWords) {
        if (qw.length > 3 && title.includes(qw)) score += 1;
      }

      return { video: v, score, duration };
    });

    scored.sort((a, b) => b.score - a.score);
    const video = scored[0].video;

    log.info(`  Selected video: "${video.title}" (duration: ${video.duration}s, score: ${scored[0].score})`);

    // Pick the best file. We want portrait, preferably HD.
    const files = video.video_files as any[];
    const bestFile = files.find(f => f.width >= 720 && f.width < f.height) || files[0];

    if (!bestFile) return { success: false, reason: "no suitable video file found" };

    log.info(`  Downloading video: ${bestFile.width}x${bestFile.height}...`);
    const videoResp = await axios.get<ArrayBuffer>(bestFile.link, {
      responseType: "arraybuffer",
      timeout: 60000,
    });

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, Buffer.from(videoResp.data));

    return { success: true, path: outPath };
  } catch (e: any) {
    const status = e.response?.status;
    const msg = e.response?.data?.error || e.message;
    return { success: false, reason: status ? `Pexels API error ${status}: ${msg}` : String(msg) };
  }
}
