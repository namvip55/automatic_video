/**
 * bgm-mixer.ts
 *
 * Mix background music (BGM) into the final video.
 * Supports: loop, fade in/out, volume control.
 *
 * Uses ffmpeg for audio mixing.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BGM_DIR = join(__dirname, "..", "..", "assets", "bgm");

export interface BgmConfig {
  /** BGM genre keyword or filename (without extension) */
  src: string;
  /** Volume 0-1 (default 0.2) */
  volume: number;
  /** Fade in duration in seconds (default 2) */
  fadeInSec: number;
  /** Fade out duration in seconds (default 3) */
  fadeOutSec: number;
}

/**
 * Available BGM genres. Maps genre keyword to filename.
 */
const BGM_GENRES: Record<string, string> = {
  default: "default.mp3",
  comedy: "comedy.mp3",
  action: "action.mp3",
  romance: "romance.mp3",
  mystery: "mystery.mp3",
  chill: "chill.mp3",
  epic: "epic.mp3",
  lofi: "lofi.mp3",
};

/**
 * Resolve BGM file path from genre keyword or filename.
 */
export function resolveBgmPath(src: string): string | null {
  // Direct filename
  const directPath = join(BGM_DIR, src);
  if (existsSync(directPath)) return directPath;

  // With .mp3 extension
  const withExt = join(BGM_DIR, `${src}.mp3`);
  if (existsSync(withExt)) return withExt;

  // Genre keyword
  const genreFile = BGM_GENRES[src.toLowerCase()];
  if (genreFile) {
    const genrePath = join(BGM_DIR, genreFile);
    if (existsSync(genrePath)) return genrePath;
  }

  // Fallback to default
  const defaultPath = join(BGM_DIR, "default.mp3");
  if (existsSync(defaultPath)) return defaultPath;

  return null;
}

/**
 * Mix BGM into the final video file.
 *
 * @param videoPath  - Path to the video file (will be overwritten with BGM mixed version)
 * @param bgmConfig  - BGM configuration
 * @param totalDuration - Total video duration in seconds (for fade out calculation)
 */
export async function mixBgmIntoVideo(
  videoPath: string,
  bgmConfig: BgmConfig,
  totalDuration: number,
): Promise<void> {
  const bgmPath = resolveBgmPath(bgmConfig.src);
  if (!bgmPath) {
    log.warn(`BGM file not found for "${bgmConfig.src}" — skipping BGM mix`);
    return;
  }

  log.info(`  BGM: ${bgmPath} (vol=${bgmConfig.volume}, fadeIn=${bgmConfig.fadeInSec}s, fadeOut=${bgmConfig.fadeOutSec}s)`);

  const tmpPath = videoPath.replace(/\.mp4$/, "-bgm-tmp.mp4");
  const fadeOutStart = Math.max(0, totalDuration - bgmConfig.fadeOutSec);

  // ffmpeg filter: loop BGM, apply fade in/out, mix with existing audio
  const bgmFilter = [
    // Loop BGM to cover full video duration, then trim
    `[1:a]aloop=loop=-1:size=2e+09,atrim=0:${totalDuration.toFixed(2)}`,
    // Apply fade in and fade out
    `afade=t=in:d=${bgmConfig.fadeInSec}`,
    `afade=t=out:st=${fadeOutStart.toFixed(2)}:d=${bgmConfig.fadeOutSec}`,
    // Set volume
    `volume=${bgmConfig.volume}[bgm]`,
  ].join(",");

  const filterComplex = [
    bgmFilter,
    // Mix original audio with BGM
    `[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[mixed]`,
  ].join("; ");

  const args = [
    "-i", videoPath,
    "-i", bgmPath,
    "-filter_complex", filterComplex,
    "-map", "0:v",
    "-map", "[mixed]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    "-y",
    tmpPath,
  ];

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg BGM mix failed (code ${code}):\n${stderr.slice(-500)}`));
    });
    proc.on("error", reject);
  });

  // Replace original with BGM-mixed version
  const { unlink, rename } = await import("node:fs/promises");
  await unlink(videoPath);
  await rename(tmpPath, videoPath);
  log.ok(`BGM mixed into video`);
}
