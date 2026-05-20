// One-off script: re-render the existing composition without re-running TTS.
// Uses already-generated per-scene voice files in <outputDir>/voice/.
//
// Usage: npx tsx rerender.ts <outputDir>

import { readFile, writeFile, copyFile, unlink, rename } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { ScriptSchema } from "./src/render/script-schema.js";
import { loadConfig } from "./src/config.js";
import { getDurationSec, concatWithSilence, mixSfxOntoVoice, type SfxMixSpec } from "./src/assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "./src/assets/sfx-selector.js";
import { existsSync } from "node:fs";
import { composeHtml } from "./src/render/html-composer.js";
import { renderWithHyperframes } from "./src/render/hyperframes-runner.js";
import { buildMergedSubtitleFile, burnSubtitlesIntoVideo } from "./src/assets/subtitle-burner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "src", "render", "templates");
const SFX_DIR = join(__dirname, "assets", "sfx");
const SCENE_GAP_SEC = 0.3;

const HYPERFRAMES_CONFIG = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: { blocks: "compositions", components: "compositions/components", assets: "assets" },
};

async function main() {
  const outputDir = process.argv[2];
  if (!outputDir) {
    console.error("Usage: npx tsx rerender.ts <outputDir>");
    process.exit(2);
  }

  const cfg = loadConfig();
  console.log(`Re-rendering: ${outputDir}`);

  // Load script.json
  const raw = JSON.parse(await readFile(join(outputDir, "script.json"), "utf8"));
  if (raw.voice?.voiceId === "${VIETNAMESE_VOICEID}" || raw.voice?.voiceId === "${VOICE_ID}") {
    raw.voice.voiceId = cfg.ttsProvider === "lucylab" ? cfg.lucylabVoiceId! : cfg.elevenlabsVoiceId!;
  }
  const script = ScriptSchema.parse(raw);

  // Probe per-scene durations from existing voice files
  const sceneAudio = await Promise.all(
    script.scenes.map(async (s) => {
      const path = join(outputDir, "voice", `scene-${s.id}.mp3`);
      const dur = await getDurationSec(path);
      console.log(`  scene ${s.id}: ${dur.toFixed(2)}s`);
      return { id: s.id, path, durationSec: dur };
    })
  );

  // Re-concat voice (in case audio-tools fix changed encoding)
  const voiceRawMp3 = join(outputDir, "voice-raw.mp3");
  const voiceMp3 = join(outputDir, "voice.mp3");
  await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3);

  // Compute scene start times + collect SFX
  let cursor = 0;
  const sceneStarts: Record<string, number> = {};
  for (const a of sceneAudio) {
    sceneStarts[a.id] = cursor;
    cursor += a.durationSec + SCENE_GAP_SEC;
  }
  // Smart SFX selection — same 3-tier logic as pipeline
  const sfxIndex = indexSfxLibrary(SFX_DIR);
  const sfxList: SfxMixSpec[] = [];
  for (const scene of script.scenes) {
    const startSec = sceneStarts[scene.id];
    if (scene.sfx) {
      if (scene.sfx.name === "none") continue;
      const sfxPath = join(SFX_DIR, `${scene.sfx.name}.mp3`);
      if (existsSync(sfxPath)) {
        sfxList.push({ path: sfxPath, startSec: startSec + scene.sfx.startOffsetSec, volume: scene.sfx.volume });
        console.log(`  scene ${scene.id}: SFX override -> ${scene.sfx.name}`);
      }
      continue;
    }
    const picked = pickSfxForScene({
      voiceText: scene.voiceText,
      templateName: scene.templateData.template,
      sceneId: scene.id,
      index: sfxIndex,
    });
    if (!picked) continue;
    const sfxPath = join(SFX_DIR, picked.relPath);
    const playback = defaultPlayback(picked);
    sfxList.push({ path: sfxPath, startSec: startSec + playback.offsetSec, volume: playback.volume });
    const why = picked.source === "semantic" ? `semantic "${picked.matchedKeyword}"` : picked.source;
    console.log(`  scene ${scene.id}: SFX -> ${picked.relPath} (${why})`);
  }
  console.log(`mixing ${sfxList.length} SFX into voice.mp3`);
  await mixSfxOntoVoice(voiceRawMp3, sfxList, voiceMp3);

  const totalDur = await getDurationSec(voiceMp3);
  console.log(`voice.mp3 total: ${totalDur.toFixed(2)}s`);

  // Determine bg image
  const bgImagePath = join(outputDir, "images", "bg.jpg");
  const fs = await import("node:fs");
  const bgImageRelPath = fs.existsSync(bgImagePath) ? "images/bg.jpg" : null;
  console.log(`bgImage: ${bgImageRelPath ?? "(none — gradient fallback)"}`);

  // Collect existing Pexels video paths and image paths for re-render
  const videoPaths: Record<string, string> = {};
  const pexelsImagePaths: Record<string, string> = {};
  for (const scene of script.scenes) {
    const videoFile = join(outputDir, "videos", `scene-${scene.id}.mp4`);
    if (existsSync(videoFile)) {
      videoPaths[scene.id] = videoFile;
    }
    // Check for pexels images (jpg/png/webp)
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const imgFile = join(outputDir, "images", "pexels", `scene-${scene.id}.${ext}`);
      if (existsSync(imgFile)) {
        pexelsImagePaths[scene.id] = imgFile;
        break;
      }
    }
  }
  console.log(`  videoPaths: ${Object.keys(videoPaths).length} scene(s)`);
  console.log(`  pexelsImagePaths: ${Object.keys(pexelsImagePaths).length} scene(s)`);

  // Compose HTML
  const html = composeHtml({
    script,
    sceneAudio: sceneAudio.map((a) => ({ id: a.id, durationSec: a.durationSec })),
    gapSec: SCENE_GAP_SEC,
    bgImageRelPath,
    audioRelPath: "voice.mp3",
    outroHoldSec: 3,
    videoPaths,
    pexelsImagePaths,
  });
  await writeFile(join(outputDir, "index.html"), html);
  await writeFile(join(outputDir, "hyperframes.json"), JSON.stringify(HYPERFRAMES_CONFIG, null, 2));
  await writeFile(join(outputDir, "meta.json"), JSON.stringify({
    id: basename(outputDir),
    name: script.metadata.title,
    createdAt: new Date().toISOString(),
  }, null, 2));
  await copyFile(join(TPL_DIR, "styles.css"),    join(outputDir, "styles.css"));
  await copyFile(join(TPL_DIR, "animations.js"), join(outputDir, "animations.js"));

  // Render
  const videoPath = join(outputDir, "video.mp4");
  await renderWithHyperframes({ compositionDir: outputDir, outputPath: videoPath });

  // Composite Pexels videos via ffmpeg (same logic as pipeline.ts)
  const footageScenes = script.scenes
    .filter(s => videoPaths[s.id])
    .map(s => ({
      id: s.id,
      path: videoPaths[s.id],
      start: sceneStarts[s.id],
      dur: (sceneAudio.find(a => a.id === s.id)!.durationSec + SCENE_GAP_SEC),
    }));

  if (footageScenes.length > 0) {
    console.log(`Compositing ${footageScenes.length} Pexels video(s) via ffmpeg...`);
    const tmpPath = join(outputDir, "video-tmp.mp4");
    const inputs = ["-i", videoPath];
    footageScenes.forEach(bv => { inputs.push("-i", bv.path); });
    const esc = (n: number) => n.toFixed(2);
    const f: string[] = [];
    f.push("[0:v]chromakey=0xFF00FF:similarity=0.3:blend=0.05[ui]");
    footageScenes.forEach((bv, idx) => {
      const vi = idx + 1;
      f.push(
        "[" + vi + ":v]scale=1080:1920:force_original_aspect_ratio=increase," +
        "crop=1080:1920:0:ih/2-960," +
        "trim=0:" + esc(bv.dur) + ",setpts=PTS-STARTPTS+" + esc(bv.start) + "/TB[vin" + idx + "]"
      );
    });
    f.push("[0:v]scale=1080:1920,geq=0:0:0[black]");
    if (footageScenes.length === 1) {
      const bv = footageScenes[0];
      f.push("[black][vin0]overlay=enable='between(t," + esc(bv.start) + "," + esc(bv.start + bv.dur) + ")'[footage]");
    } else {
      footageScenes.forEach((bv, idx) => {
        if (idx === 0) {
          f.push("[black][vin0]overlay=enable='between(t," + esc(bv.start) + "," + esc(bv.start + bv.dur) + ")'[fmid0]");
        } else if (idx < footageScenes.length - 1) {
          f.push("[fmid" + (idx - 1) + "][vin" + idx + "]overlay=enable='between(t," + esc(bv.start) + "," + esc(bv.start + bv.dur) + ")'[fmid" + idx + "]");
        } else {
          f.push("[fmid" + (idx - 1) + "][vin" + idx + "]overlay=enable='between(t," + esc(bv.start) + "," + esc(bv.start + bv.dur) + ")'[footage]");
        }
      });
    }
    // Apply vignette darkening to footage layer (since HTML overlay is skipped for video scenes)
    f.push("[footage]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.35:t=fill[footage_dark]");
    f.push("[footage_dark][ui]overlay=format=auto[out]");
    const filterGraph = f.join("; ");
    console.log(`  ffmpeg filter: ${filterGraph}`);
    await new Promise<void>((resolve, reject) => {
      const args = [
        ...inputs,
        "-filter_complex", filterGraph,
        "-map", "[out]",
        "-map", "0:a",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-c:a", "aac",
        "-shortest",
        "-y",
        tmpPath,
      ];
      const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      proc.stderr.on("data", (data) => { stderr += data.toString(); });
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg failed (code ${code}):\n${stderr.slice(-500)}`));
      });
      proc.on("error", reject);
    });
    await unlink(videoPath);
    await rename(tmpPath, videoPath);
    console.log(`Video composited with ${footageScenes.length} Pexels footage(s)`);
  }

  const subtitleBuild = await buildMergedSubtitleFile({
    scenes: script.scenes.map((scene) => ({
      sceneId: scene.id,
      sceneStartSec: sceneStarts[scene.id],
      sceneDurationSec: sceneAudio.find((a) => a.id === scene.id)?.durationSec ?? 0,
      voiceText: scene.voiceText,
      srtPath: join(outputDir, "voice", `scene-${scene.id}.srt`),
    })),
    outSrtPath: join(outputDir, "subtitles.srt"),
  });

  if (!subtitleBuild.outPath) {
    console.log("No subtitle cues generated — skipping burn-in");
  } else {
    console.log(`subtitles: ${subtitleBuild.cueCount} cues (${subtitleBuild.usedSrt} from SRT, ${subtitleBuild.estimated} estimated, ${subtitleBuild.skipped} skipped)`);
    await burnSubtitlesIntoVideo({ videoPath, subtitlePath: subtitleBuild.outPath });
    console.log("Subtitles burned into video.mp4");
  }

  console.log(`\nDone: ${videoPath}`);
}

main().catch((e) => { console.error("Re-render failed:", e); process.exit(1); });
