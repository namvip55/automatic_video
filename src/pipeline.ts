import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { ScriptSchema, type Script } from "./render/script-schema.js";
import { loadConfig } from "./config.js";
import { createTtsClient } from "./tts/tts-client.js";
import { fetchImage, fetchPexelsImage } from "./assets/image-fetcher.js";
import { fetchStockVideo } from "./assets/video-fetcher.js";
import { getDurationSec, concatWithSilence, mixSfxOntoVoice, type SfxMixSpec } from "./assets/audio-tools.js";
import { indexSfxLibrary, pickSfxForScene, defaultPlayback } from "./assets/sfx-selector.js";
import { mixBgmIntoVideo } from "./assets/bgm-mixer.js";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { composeHtml } from "./render/html-composer.js";
import { renderWithHyperframes } from "./render/hyperframes-runner.js";
import { buildMergedSubtitleFile, burnSubtitlesIntoVideo } from "./assets/subtitle-burner.js";
import { log } from "./utils/logger.js";

const TOTAL_STEPS = 8;
const SCENE_GAP_SEC = 0.5;
const OUTRO_HOLD_SEC = 3;
const SCENE_WHITE_FADE_SEC = 0.14;

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "render", "templates");
const SFX_DIR = join(__dirname, "..", "assets", "sfx");

const HYPERFRAMES_CONFIG = {
  $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
  registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  paths: {
    blocks: "compositions",
    components: "compositions/components",
    assets: "assets",
  },
};

export async function runPipeline(scriptPath: string): Promise<void> {
  const cfg = loadConfig();
  const outputDir = dirname(scriptPath);
  log.init(TOTAL_STEPS);
  log.info(`Output: ${outputDir}  |  TTS: ${cfg.ttsProvider}`);

  // ── STEP 1: Load env + validate script.json ─────────────────────────────
  log.step(1, TOTAL_STEPS, "Load env + validate script.json");
  const scriptText = (await readFile(scriptPath, "utf8")).replace(/^﻿/, "");
  const raw = JSON.parse(scriptText);
  if (raw.voice?.voiceId === "${VIETNAMESE_VOICEID}") {
    raw.voice.voiceId = cfg.ttsProvider === "lucylab" ? cfg.lucylabVoiceId! : cfg.elevenlabsVoiceId!;
  } else if (raw.voice?.voiceId === "${ELEVENLABS_VOICE_ID}") {
    raw.voice.voiceId = cfg.elevenlabsVoiceId!;
  }
  const script: Script = ScriptSchema.parse(raw);
  log.ok(`Script valid — ${script.scenes.length} scenes, title: "${script.metadata.title}"`);

  // ── STEP 2: Fetch og:image + generate TTS audio (parallel) ───────────
  log.step(2, TOTAL_STEPS, "Fetch og:image + generate TTS audio");
  const imgPath = join(outputDir, "images", "bg.jpg");
  const imgPromise = fetchImage(script.metadata.source.image, imgPath);

  const ttsClient = createTtsClient(cfg);
  const limit = pLimit(cfg.ttsConcurrency);
  const voiceDir = join(outputDir, "voice");
  await mkdir(voiceDir, { recursive: true });

  let doneTts = 0;
  const totalTts = script.scenes.length;

  const sceneAudioPromises = script.scenes.map((scene) =>
    limit(async () => {
      const out = join(voiceDir, `scene-${scene.id}.mp3`);
      const srtOut = join(voiceDir, `scene-${scene.id}.srt`);
      let dur: number;

      if (existsSync(out)) {
        dur = await getDurationSec(out);
        log.info(`  scene ${scene.id}: REUSE existing mp3 (${dur.toFixed(2)}s) — delete to force re-TTS`);
      } else {
        log.info(`  scene ${scene.id} (${scene.voiceText.length} chars)...`);

        // Handle explicit silence request (Manga mode)
        if (scene.voiceText.trim() === ".") {
          log.info(`  scene ${scene.id}: generating empty silence for reading mode`);
          const { spawn } = await import("node:child_process");
          await new Promise<void>((resolve, reject) => {
            const proc = spawn("ffmpeg", [
              "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
              "-t", "0.5", "-c:a", "libmp3lame", "-b:a", "192k", out
            ]);
            proc.on("close", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg silence generation failed")));
          });
          await writeFile(srtOut, JSON.stringify([])); // Empty SRT
          dur = 0.5;
        } else {
          await ttsClient.generate(scene.voiceText, out, srtOut);
          dur = await getDurationSec(out);
        }
      }

      // If targetDuration is specified, pad/trim the audio
      if (scene.targetDuration && Math.abs(dur - scene.targetDuration) > 0.1) {
        log.info(`  scene ${scene.id}: Adjusting duration from ${dur.toFixed(2)}s to ${scene.targetDuration}s...`);
        const { padOrTrimAudio } = await import("./assets/audio-tools.js");
        const tmpOut = join(voiceDir, `scene-${scene.id}-padded.mp3`);
        await padOrTrimAudio(out, tmpOut, scene.targetDuration);
        const { rename } = await import("node:fs/promises");
        await rename(tmpOut, out);
        dur = scene.targetDuration;
      }

      doneTts++;
      log.progress(doneTts, totalTts, "TTS");
      log.info(`  scene ${scene.id}: ${dur.toFixed(2)}s`);
      return { id: scene.id, path: out, durationSec: dur };
    }),
  );

  const toEnglishPexelsQuery = (keyword: string | undefined, fallback: string) => {
    const normalized = keyword?.trim();
    if (!normalized) return fallback;
    return /^[\x00-\x7F]+$/.test(normalized) ? normalized : fallback;
  };
  const isStoryStyle = script.metadata.source.domain.toLowerCase() === "story"
    || script.metadata.source.url.toLowerCase().startsWith("generated://story");
  const storyVideoFallbacks = [
    "crowded city street",
    "busy street crowd",
    "people walking downtown",
    "urban crowd rush hour",
    "basketball game",
    "soccer match",
    "runner training",
    "extreme sports",
    "majestic mountains",
    "dramatic ocean waves",
    "epic waterfall",
    "aerial nature landscape",
  ];
  const storyVideoKeywordForScene = (idx: number) => storyVideoFallbacks[idx % storyVideoFallbacks.length];

  const videoDir = join(outputDir, "videos");
  await mkdir(videoDir, { recursive: true });

  let doneVideo = 0;
  const shouldFetchVideo = (scene: Script["scenes"][number]) => isStoryStyle || !!scene.visual?.videoKeyword;
  const videoScenesCount = script.scenes.filter(shouldFetchVideo).length;

  const videoPromises = script.scenes.map((scene, idx) =>
    limit(async () => {
      if (!shouldFetchVideo(scene)) return { id: scene.id, success: false, reason: "no keyword" };
      const kw = toEnglishPexelsQuery(scene.visual?.videoKeyword, isStoryStyle ? storyVideoKeywordForScene(idx) : "news background");
      const out = join(videoDir, `scene-${scene.id}.mp4`);
      if (existsSync(out)) {
        doneVideo++;
        if (videoScenesCount > 0) log.progress(doneVideo, videoScenesCount, "Video");
        return { id: scene.id, success: true, path: out };
      }
      const result = await fetchStockVideo(kw, out, cfg.pexelsApiKey);
      doneVideo++;
      if (videoScenesCount > 0) log.progress(doneVideo, videoScenesCount, "Video");
      if (!result.success) {
        log.warn(`  scene ${scene.id}: Pexels video fetch failed (${result.reason})`);
      }
      return { id: scene.id, ...result };
    }),
  );

  const pexelsImgDir = join(outputDir, "images", "pexels");
  await mkdir(pexelsImgDir, { recursive: true });
  let doneImg = 0;
  const imgScenesCount = script.scenes.filter(s => !isStoryStyle && s.visual?.imageKeyword).length;

  const pexelsImagePromises = script.scenes.map((scene) =>
    limit(async () => {
      if (isStoryStyle) return { id: scene.id, success: false, reason: "story mode uses video backgrounds" };
      const kw = toEnglishPexelsQuery(scene.visual?.imageKeyword, "news background");
      if (!kw) return { id: scene.id, success: false };
      const out = join(pexelsImgDir, `scene-${scene.id}.jpg`);
      if (existsSync(out)) {
        doneImg++;
        if (imgScenesCount > 0) log.progress(doneImg, imgScenesCount, "Images");
        return { id: scene.id, success: true, path: out };
      }
      const result = await fetchPexelsImage(kw, out, cfg.pexelsApiKey);
      doneImg++;
      if (imgScenesCount > 0) log.progress(doneImg, imgScenesCount, "Images");
      if (!result.success) {
        log.warn(`  scene ${scene.id}: Pexels image fetch failed (${result.reason})`);
      } else {
        log.info(`  scene ${scene.id}: Pexels image saved`);
      }
      return { id: scene.id, ...result };
    }),
  );

  const [imgResult, sceneAudio, sceneVideos, pexelsImages] = await Promise.all([
    imgPromise,
    Promise.all(sceneAudioPromises),
    Promise.all(videoPromises),
    Promise.all(pexelsImagePromises),
  ]);

  const videoPaths: Record<string, string> = {};
  sceneVideos.forEach(v => { if (v.success && v.path) videoPaths[v.id] = v.path; });

  const pexelsImagePaths: Record<string, string> = {};
  pexelsImages.forEach(p => { if (p.success && p.path) pexelsImagePaths[p.id] = p.path; });

  let bgImageRelPath: string | null = null;
  if (imgResult.success) {
    bgImageRelPath = "images/bg.jpg";
    log.ok(`Background image: ${script.metadata.source.domain}`);
  } else {
    log.warn(`Background image fetch failed: ${imgResult.reason} → using gradient fallback`);
  }

  // ── STEP 3: Concat voice + mix SFX layer ──────────────────────────────
  log.step(3, TOTAL_STEPS, "Concat voice + mix SFX layer");
  const voiceRawMp3 = join(outputDir, "voice-raw.mp3");
  const voiceMp3 = join(outputDir, "voice.mp3");
  await concatWithSilence(sceneAudio.map((a) => a.path), SCENE_GAP_SEC, voiceRawMp3);

  const sceneStarts: Record<string, number> = {};
  let cursor = 0;
  for (const a of sceneAudio) {
    sceneStarts[a.id] = cursor;
    cursor += a.durationSec + SCENE_GAP_SEC;
  }

  const sfxIndex = indexSfxLibrary(SFX_DIR);
  const indexCats = Object.keys(sfxIndex).length;
  const indexFiles = Object.values(sfxIndex).reduce((s, a) => s + a.length, 0);
  log.info(`  SFX library: ${indexFiles} files in ${indexCats} categories`);

  const sfxList: SfxMixSpec[] = [];
  for (const scene of script.scenes) {
    const startSec = sceneStarts[scene.id];
    if (scene.sfx) {
      if (scene.sfx.name === "none") {
        log.info(`  scene ${scene.id}: SFX disabled (explicit "none")`);
        continue;
      }
      const sfxPath = join(SFX_DIR, `${scene.sfx.name}.mp3`);
      if (existsSync(sfxPath)) {
        sfxList.push({ path: sfxPath, startSec: startSec + scene.sfx.startOffsetSec, volume: scene.sfx.volume });
        log.info(`  scene ${scene.id}: SFX override -> ${scene.sfx.name}.mp3`);
      } else {
        log.warn(`  scene ${scene.id}: explicit SFX not found, skipping: ${scene.sfx.name}.mp3`);
      }
      continue;
    }
    const picked = pickSfxForScene({
      voiceText: scene.voiceText,
      templateName: scene.templateData.template,
      sceneId: scene.id,
      index: sfxIndex,
    });
    if (!picked) {
      log.warn(`  scene ${scene.id}: no SFX available (empty library?)`);
      continue;
    }
    const sfxPath = join(SFX_DIR, picked.relPath);
    if (!existsSync(sfxPath)) {
      const allFiles = Object.values(sfxIndex).flat();
      const fallback = allFiles.find(f => existsSync(join(SFX_DIR, f)));
      if (fallback) {
        log.warn(`  scene ${scene.id}: SFX file missing (${picked.relPath}), using fallback: ${fallback}`);
        const playback = defaultPlayback(picked);
        sfxList.push({ path: join(SFX_DIR, fallback), startSec: startSec + playback.offsetSec, volume: playback.volume });
      } else {
        log.warn(`  scene ${scene.id}: SFX file missing and no fallback found, skipping`);
      }
      continue;
    }
    const playback = defaultPlayback(picked);
    sfxList.push({ path: sfxPath, startSec: startSec + playback.offsetSec, volume: playback.volume });
    const why = picked.source === "semantic"
      ? `semantic match "${picked.matchedKeyword}"`
      : picked.source;
    log.info(`  scene ${scene.id}: SFX -> ${picked.relPath} (${why})`);
  }
  log.info(`  mixing ${sfxList.length} SFX into voice.mp3`);
  await mixSfxOntoVoice(voiceRawMp3, sfxList, voiceMp3);

  const totalAudioSec = await getDurationSec(voiceMp3);
  log.ok(`voice.mp3 total: ${totalAudioSec.toFixed(2)}s`);

  // ── STEP 4: Compose HTML + project files ──────────────────────────────
  log.step(4, TOTAL_STEPS, "Compose HTML + project files");
  const html = composeHtml({
    script,
    sceneAudio: sceneAudio.map((a) => ({ id: a.id, durationSec: a.durationSec })),
    gapSec: SCENE_GAP_SEC,
    bgImageRelPath,
    audioRelPath: "voice.mp3",
    videoPaths,
    pexelsImagePaths,
    outroHoldSec: OUTRO_HOLD_SEC,
  });
  await writeFile(join(outputDir, "index.html"), html);
  await writeFile(join(outputDir, "hyperframes.json"), JSON.stringify(HYPERFRAMES_CONFIG, null, 2));
  const slug = basename(outputDir);
  await writeFile(join(outputDir, "meta.json"), JSON.stringify({
    id: slug,
    name: script.metadata.title,
    createdAt: new Date().toISOString(),
  }, null, 2));
  await copyFile(join(TPL_DIR, "styles.css"), join(outputDir, "styles.css"));
  await copyFile(join(TPL_DIR, "animations.js"), join(outputDir, "animations.js"));
  log.ok(`HTML + project files written to ${outputDir}`);

  // ── STEP 5: Render with Hyperframes + composite Pexels videos ────────
  log.step(5, TOTAL_STEPS, "Render with Hyperframes + composite Pexels videos");
  const videoPath = join(outputDir, "video.mp4");
  await renderWithHyperframes({ compositionDir: outputDir, outputPath: videoPath });
  log.ok(`Hyperframes render complete`);

  const footageScenes = script.scenes
    .filter(s => videoPaths[s.id])
    .map(s => ({
      id: s.id,
      path: videoPaths[s.id],
      start: sceneStarts[s.id],
      dur: (sceneAudio.find(a => a.id === s.id)!.durationSec + SCENE_GAP_SEC),
    }));

  if (footageScenes.length > 0) {
    log.info(`  Compositing ${footageScenes.length} Pexels video(s) via ffmpeg...`);
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
    const transitionStarts = footageScenes.slice(1).map((bv) => bv.start);
    if (transitionStarts.length > 0) {
      let transitionBase = "footage_dark";
      transitionStarts.forEach((start, idx) => {
        const half = SCENE_WHITE_FADE_SEC / 2;
        const fadeStart = Math.max(0, start - half);
        f.push(
          `color=c=white:s=1080x1920:d=${esc(SCENE_WHITE_FADE_SEC)},format=rgba,` +
          `fade=t=in:st=0:d=${esc(half)}:alpha=1,` +
          `fade=t=out:st=${esc(half)}:d=${esc(half)}:alpha=1,` +
          `setpts=PTS-STARTPTS+${esc(fadeStart)}/TB[whitefade${idx}]`
        );
        const fadeEnd = fadeStart + SCENE_WHITE_FADE_SEC;
        const nextLabel = idx === transitionStarts.length - 1 ? "footage_transition" : `footage_transition${idx}`;
        f.push(`[${transitionBase}][whitefade${idx}]overlay=enable='between(t,${esc(fadeStart)},${esc(fadeEnd)})':format=auto:eof_action=pass[${nextLabel}]`);
        transitionBase = nextLabel;
      });
      f.push("[footage_transition][ui]overlay=format=auto[out]");
    } else {
      f.push("[footage_dark][ui]overlay=format=auto[out]");
    }
    const filterGraph = f.join("; ");
    log.info(`  ffmpeg filter: ${filterGraph}`);
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
      // We pipe stderr to capture errors if needed, but we don't print the progress lines
      let stderr = "";
      proc.stderr.on("data", (data) => { stderr += data.toString(); });
      
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg failed (code ${code}):\n${stderr.slice(-500)}`));
      });
      proc.on("error", reject);
    });
    const { unlink, rename } = await import("node:fs/promises");
    await unlink(videoPath);
    await rename(tmpPath, videoPath);
    log.ok(`Video composited with ${footageScenes.length} Pexels footage(s)`);
  }

  // ── STEP 6: Mix BGM (manga mode) ─────────────────────────────────────────
  const isMangaMode = script.metadata.mode === "manga";
  if (isMangaMode && script.bgm) {
    log.step(6, TOTAL_STEPS, "Mix BGM into video");
    await mixBgmIntoVideo(videoPath, script.bgm, totalAudioSec);
  } else if (isMangaMode) {
    log.step(6, TOTAL_STEPS, "Mix BGM (skipped — no BGM config)");
    log.info("  No BGM config in script.json — skipping");
  }

  // ── STEP 7: Burn subtitles into video ───────────────────────────────────
  log.step(7, TOTAL_STEPS, "Burn subtitles into video");
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
    log.warn("  No subtitle cues generated — skipping burn-in");
  } else {
    log.info(`  subtitles: ${subtitleBuild.cueCount} cues (${subtitleBuild.usedSrt} from SRT, ${subtitleBuild.estimated} estimated, ${subtitleBuild.skipped} skipped)`);
    await burnSubtitlesIntoVideo({ videoPath, subtitlePath: subtitleBuild.outPath });
    log.ok("Subtitles burned into video.mp4");
  }

  // ── STEP 8: Done ────────────────────────────────────────────────────────
  log.step(TOTAL_STEPS, TOTAL_STEPS, "Done");
  log.done(`Video ready: ${script.metadata.title}`);

  console.log(`\n  ${log.ansi.bold}Video:${log.ansi.reset}  [video.mp4](output/${slug}/video.mp4)`);
  console.log(`  ${log.ansi.bold}Thời lượng:${log.ansi.reset} ${totalAudioSec.toFixed(2)}s`);
  console.log();
}
