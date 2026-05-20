import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile, unlink, rename } from "node:fs/promises";

export interface SceneSubtitleInput {
  sceneId: string;
  sceneStartSec: number;
  sceneDurationSec: number;
  voiceText: string;
  srtPath: string;
}

export interface SubtitleBuildResult {
  cueCount: number;
  usedSrt: number;
  estimated: number;
  skipped: number;
  outPath: string | null;
}

interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
}

function parseSrtTimeMs(raw: string): number {
  const m = raw.trim().match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);
  if (!m) throw new Error(`Invalid SRT time: ${raw}`);
  const [, hh, mm, ss, ms] = m;
  return Number(hh) * 3_600_000 + Number(mm) * 60_000 + Number(ss) * 1_000 + Number(ms);
}

function formatSrtTimeMs(totalMs: number): string {
  const clamped = Math.max(0, Math.round(totalMs));
  const hh = Math.floor(clamped / 3_600_000);
  const mm = Math.floor((clamped % 3_600_000) / 60_000);
  const ss = Math.floor((clamped % 60_000) / 1_000);
  const ms = clamped % 1_000;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const pad3 = (n: number) => String(n).padStart(3, "0");
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)},${pad3(ms)}`;
}

function splitVoiceText(text: string): string[] {
  return text
    .split(/[.!?;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitSubtitleText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let current = "";
  for (const word of normalized.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    const shouldSplit = current && (next.length > 38 || /[,;:!?…]$/.test(current));
    if (shouldSplit) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitCue(cue: SubtitleCue): SubtitleCue[] {
  const chunks = splitSubtitleText(cue.text);
  if (chunks.length <= 1) return chunks.length === 1 ? [{ ...cue, text: chunks[0] }] : [];

  const totalWeight = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const totalDur = cue.endMs - cue.startMs;
  const out: SubtitleCue[] = [];
  let cursor = cue.startMs;

  chunks.forEach((chunk, idx) => {
    const isLast = idx === chunks.length - 1;
    const dur = isLast ? cue.endMs - cursor : Math.max(350, Math.round(totalDur * (chunk.length / totalWeight)));
    const endMs = isLast ? cue.endMs : Math.min(cue.endMs, cursor + dur);
    if (endMs > cursor) out.push({ startMs: cursor, endMs, text: chunk });
    cursor = endMs;
  });

  return out;
}

function splitCues(cues: SubtitleCue[]): SubtitleCue[] {
  return cues.flatMap(splitCue);
}

function parseSrtCues(content: string): SubtitleCue[] {
  const blocks = content
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    const timeLineIdx = lines.findIndex((l) => l.includes("-->") );
    if (timeLineIdx < 0) continue;

    const timeLine = lines[timeLineIdx];
    const parts = timeLine.split("-->");
    if (parts.length !== 2) continue;

    const startMs = parseSrtTimeMs(parts[0].trim());
    const endMs = parseSrtTimeMs(parts[1].trim());
    if (endMs <= startMs) continue;

    const text = lines.slice(timeLineIdx + 1).join("\n").trim();
    if (!text) continue;

    cues.push({ startMs, endMs, text });
  }

  return cues;
}

function estimateSceneCues(scene: SceneSubtitleInput): SubtitleCue[] {
  const rawText = scene.voiceText.trim();
  if (!rawText || rawText === ".") return [];

  const segments = splitVoiceText(rawText);
  const parts = segments.length > 0 ? segments : [rawText];

  const sceneStartMs = Math.round(scene.sceneStartSec * 1000);
  const sceneDurMs = Math.max(300, Math.round(scene.sceneDurationSec * 1000));
  const partDur = Math.max(250, Math.floor(sceneDurMs / parts.length));

  const cues: SubtitleCue[] = [];
  for (let i = 0; i < parts.length; i++) {
    const startMs = sceneStartMs + i * partDur;
    const isLast = i === parts.length - 1;
    const endMs = isLast ? sceneStartMs + sceneDurMs : startMs + partDur;
    const text = parts[i].trim();
    if (!text) continue;
    cues.push({ startMs, endMs: Math.max(endMs, startMs + 200), text });
  }

  return splitCues(cues);
}

function toSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue, idx) => {
      const n = idx + 1;
      const text = cue.text.replace(/\s+/g, " ").trim();
      return `${n}\n${formatSrtTimeMs(cue.startMs)} --> ${formatSrtTimeMs(cue.endMs)}\n${text}`;
    })
    .join("\n\n") + "\n";
}

export async function buildMergedSubtitleFile(args: {
  scenes: SceneSubtitleInput[];
  outSrtPath: string;
}): Promise<SubtitleBuildResult> {
  const { scenes, outSrtPath } = args;

  const allCues: SubtitleCue[] = [];
  let usedSrt = 0;
  let estimated = 0;
  let skipped = 0;

  for (const scene of scenes) {
    const voiceText = scene.voiceText.trim();
    if (!voiceText || voiceText === ".") {
      skipped++;
      continue;
    }

    let sceneCues: SubtitleCue[] = [];
    let usedSrtForScene = false;

    if (existsSync(scene.srtPath)) {
      try {
        const raw = await readFile(scene.srtPath, "utf8");
        const trimmed = raw.trim();
        if (trimmed && !trimmed.startsWith("[")) {
          const localCues = parseSrtCues(trimmed);
          if (localCues.length > 0) {
            const offsetMs = Math.round(scene.sceneStartSec * 1000);
            sceneCues = localCues.map((c) => ({
              startMs: c.startMs + offsetMs,
              endMs: c.endMs + offsetMs,
              text: c.text,
            }));
            usedSrtForScene = true;
          }
        }
      } catch {
        // Fall back to estimation below
      }
    }

    if (!usedSrtForScene) {
      sceneCues = estimateSceneCues(scene);
      if (sceneCues.length > 0) {
        estimated++;
      } else {
        skipped++;
      }
    } else {
      usedSrt++;
    }

    allCues.push(...splitCues(sceneCues));
  }

  allCues.sort((a, b) => a.startMs - b.startMs);
  if (allCues.length === 0) {
    return { cueCount: 0, usedSrt, estimated, skipped, outPath: null };
  }

  await writeFile(outSrtPath, toSrt(allCues), "utf8");
  return {
    cueCount: allCues.length,
    usedSrt,
    estimated,
    skipped,
    outPath: outSrtPath,
  };
}

export async function burnSubtitlesIntoVideo(args: {
  videoPath: string;
  subtitlePath: string;
}): Promise<boolean> {
  const { videoPath, subtitlePath } = args;
  if (!existsSync(videoPath) || !existsSync(subtitlePath)) return false;

  const tmpPath = videoPath.endsWith(".mp4")
    ? videoPath.replace(/\.mp4$/i, "-sub-tmp.mp4")
    : `${videoPath}-sub-tmp.mp4`;

  const subtitleFilterPath = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
  const style = [
    "FontName=Arial",
    "FontSize=10",
    "PrimaryColour=&H00FFFFFF",
    "OutlineColour=&H00000000",
    "BorderStyle=1",
    "Outline=0.8",
    "Shadow=0",
    "Alignment=2",
    "MarginL=20",
    "MarginR=20",
    "MarginV=90",
  ].join(",");

  const vf = `subtitles='${subtitleFilterPath}':force_style='${style}'`;

  await new Promise<void>((resolve, reject) => {
    const argsFfmpeg = [
      "-i", videoPath,
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "20",
      "-c:a", "copy",
      "-y",
      tmpPath,
    ];

    const proc = spawn("ffmpeg", argsFfmpeg, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg subtitle burn failed (code ${code}):\n${stderr.slice(-500)}`));
    });
    proc.on("error", reject);
  });

  await unlink(videoPath);
  await rename(tmpPath, videoPath);
  return true;
}
