import { readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import type { Script, TemplateDataType } from "./script-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_DIR = join(__dirname, "templates");

// Grain overlay HTML inline (from installed component)
const GRAIN_OVERLAY_HTML = `<div id="grain-overlay" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:100;"><div class="grain-texture"></div></div>`;

export interface SceneAudio {
  id: string;
  durationSec: number;
}

export interface ComposeArgs {
  script: Script;
  sceneAudio: SceneAudio[];
  gapSec: number;
  bgImageRelPath: string | null;   // null => no image available
  audioRelPath: string;
  /** Extra seconds added to outro scene visual duration after voice ends. Default 3. */
  videoPaths?: Record<string, string>;
  /** Pexels still image paths keyed by scene id (from imageKeyword fetches). */
  pexelsImagePaths?: Record<string, string>;
  outroHoldSec?: number;
}

export function composeHtml(args: ComposeArgs): string {
  const { script, sceneAudio, gapSec, bgImageRelPath, audioRelPath } = args;
  const outroHoldSec = args.outroHoldSec ?? 3;

  // Compute timing per scene. Outro scene gets extra HOLD seconds after voice ends.
  let cursor = 0;
  const timing = script.scenes.map((scene) => {
    const audio = sceneAudio.find((a) => a.id === scene.id);
    if (!audio) throw new Error(`No audio entry for scene id=${scene.id}`);
    const isOutro = scene.type === "outro";
    const dur = audio.durationSec + gapSec + (isOutro ? outroHoldSec : 0);
    const start = cursor;
    cursor += dur;
    return { scene, start, duration: dur };
  });
  const totalDuration = cursor;

  // Render scenes
  const sceneHtml = timing.map(({ scene, start, duration }) => {
    const videoPath = args.videoPaths?.[scene.id];
    const videoRelPath = videoPath ? `videos/${basename(videoPath)}` : null;
    const pexelsImgPath = args.pexelsImagePaths?.[scene.id];
    const pexelsImgRelPath = pexelsImgPath ? `images/pexels/${basename(pexelsImgPath)}` : null;
    return renderScene(scene, start, duration, bgImageRelPath, videoRelPath, pexelsImgRelPath);
  }).join("\n");

  const shellHtml = renderShell(script.metadata);

  const animJs = readFileSync(join(TPL_DIR, "animations.js"), "utf8");

  const tpl = readFileSync(join(TPL_DIR, "base.html.tmpl"), "utf8");

  // Set theme class on body (default classic if not provided)
  const themeClass = script.metadata.theme ? `theme-${script.metadata.theme}` : "theme-classic";

  return tpl
    .replace("<body>", `<body class="${themeClass}">`)
    .replace("{{TITLE}}", escapeHtml(script.metadata.title))
    .replace(/\{\{TOTAL_DURATION\}\}/g, totalDuration.toFixed(2))
    .replace("{{SHELL}}", shellHtml)
    .replace("{{SCENES}}", sceneHtml)
    .replace(/src="voice\.mp3"/g, `src="${audioRelPath}"`)
    .replace('<script src="animations.js"></script>', `<script>\n${animJs}\n</script>`);
}

// ── PERSISTENT SHELL ───────────────────────────────────────────────────────
function renderShell(_metadata: Script["metadata"]): string {
  return `<div class="shell-bg"></div>\n${GRAIN_OVERLAY_HTML}`;
}

// ── SCENE DISPATCH ─────────────────────────────────────────────────────────
function renderScene(
  scene: Script["scenes"][number],
  start: number,
  duration: number,
  bgImageRelPath: string | null,
  videoRelPath: string | null,
  pexelsImgRelPath: string | null,
): string {
  const td = scene.templateData;

  // Generate background HTML: prioritize bgSrc (article image) for hook scene,
  // Pexels video for body scenes, Pexels still image (imageKeyword) as alternative,
  // and image fallback as last resort.
  // Priority order for each scene type:
  //   - hook + bgSrc  → article image (Ken Burns)
  //   - body + video  → Pexels footage (magenta placeholder, composited later by ffmpeg)
  //   - body + pexelsImg → Pexels still image (Ken Burns)
  //   - any + bgSrc   → article image (Ken Burns) — explicit override
  //   - any + bgImage → article image (Ken Burns)  — fallback
  //   - default       → gradient
  let bgHtml = "";
  const isHook = scene.type === "hook";
  const hasBgSrc = !!scene.visual?.bgSrc;
  const isMangaPanel = scene.templateData.template === "manga-panel";

  // MANGA PANEL: use pageSrc from templateData as background
  if (isMangaPanel) {
    const td = scene.templateData as Extract<TemplateDataType, { template: "manga-panel" }>;
    const src = td.pageSrc ?? scene.visual?.bgSrc;
    if (src) {
      const kb = scene.kenBurns || td.kenBurns || "zoom-in";
      bgHtml = `<div class="bg kb-${kb} manga-bg" style="background-image: url('${src}'); background-size: contain; background-repeat: no-repeat; background-position: center;"></div>`;
    } else {
      bgHtml = `<div class="bg gradient-news-dark"></div>`;
    }
  }
  // HOOK always prefers bgSrc (article hero image) — never video
  else if (isHook && bgImageRelPath && hasBgSrc) {
    const kb = scene.kenBurns || "zoom-in";
    bgHtml = `<div class="bg kb-${kb}" style="background-image: url('${bgImageRelPath}')"></div>`;
  }
  // Use magenta placeholder for video (composited via ffmpeg in post-processing)
  else if (videoRelPath) {
    bgHtml = `<div class="bg footage-placeholder" data-video-scene="${scene.id}" style="background:#FF00FF;"></div>`;
  }
  // Pexels still image via imageKeyword
  else if (pexelsImgRelPath) {
    const kb = scene.kenBurns || "zoom-in";
    bgHtml = `<div class="bg kb-${kb}" style="background-image: url('${pexelsImgRelPath}'); background-position: center 25%;"></div>`;
  }
  // Explicit bgSrc on non-hook scenes
  else if (bgImageRelPath && hasBgSrc) {
    const kb = scene.kenBurns || "zoom-in";
    bgHtml = `<div class="bg kb-${kb}" style="background-image: url('${bgImageRelPath}')"></div>`;
  }
  // Generic fallback to article image
  else if (bgImageRelPath) {
    bgHtml = `<div class="bg kb-zoom-in" style="background-image: url('${bgImageRelPath}')"></div>`;
  } else {
    bgHtml = `<div class="bg gradient-news-dark"></div>`;
  }
  // Skip overlay/vignette for video scenes — chroma-key needs pure #FF00FF.
  // Vignette effect for video scenes is applied in ffmpeg post-compositing instead.
  const isVideoScene = !!videoRelPath;
  const overlayHtml = (isVideoScene || isMangaPanel)
    ? ''
    : `<div class="overlay" style="opacity: 0.55"></div>
  <div class="vignette"></div>
  <div class="vignette-bottom"></div>
  <div class="vignette-top"></div>`;

  let inner: string;
  let layoutName: string;

  switch (td.template) {
    case "hook":
      inner = renderHookInner(td);
      layoutName = "hook";
      break;
    case "comparison":
      inner = renderComparisonInner(td);
      layoutName = "comparison";
      break;
    case "stat-hero":
      inner = renderStatHeroInner(td);
      layoutName = "stat-hero";
      break;
    case "feature-list":
      inner = renderFeatureListInner(td);
      layoutName = "feature-list";
      break;
    case "callout":
      inner = renderCalloutInner(td);
      layoutName = "callout";
      break;
    case "kinetic-text":
      inner = renderKineticTextInner(td);
      layoutName = "kinetic-text";
      break;
    case "manga-panel":
      inner = renderMangaPanelInner(td);
      layoutName = "manga-panel";
      break;
    case "outro":
      inner = renderOutroInner(td);
      layoutName = "outro";
      break;
    default: {
      const _never: never = td;
      throw new Error(`Unknown template: ${(_never as any).template}`);
    }
  }

  return buildScene(scene, start, duration, layoutName, `${bgHtml}\n${overlayHtml}\n${inner}`);
}

// ── HOOK SCENE ─────────────────────────────────────────────────────────────
function renderHookInner(td: Extract<TemplateDataType, { template: "hook" }>): string {
  const headline = escapeHtml(td.headline);
  const subhead = td.subhead ? escapeHtml(td.subhead) : "";

  return `
  <div class="layout-hook">
    <div class="hook-headline shimmer-sweep-target">${headline}</div>
    ${subhead ? `<div class="hook-subhead">${subhead}</div>` : ""}
  </div>`;
}

// ── COMPARISON SCENE ───────────────────────────────────────────────────────
function renderComparisonInner(td: Extract<TemplateDataType, { template: "comparison" }>): string {
  const lColor = td.left.color;  // "cyan" | "purple"
  const rColor = td.right.color;
  const winnerClass = td.right.winner ? " card-winner" : "";

  return `
<div class="layout-comparison">
  <div class="cmp-card cmp-left color-${lColor}">
    <div class="cmp-label">${escapeHtml(td.left.label)}</div>
    <div class="cmp-value">${escapeHtml(td.left.value)}</div>
  </div>
  <div class="cmp-vs">VS</div>
  <div class="cmp-card cmp-right color-${rColor}${winnerClass}">
    <div class="cmp-label">${escapeHtml(td.right.label)}</div>
    <div class="cmp-value">${escapeHtml(td.right.value)}</div>
    ${td.right.winner ? '<div class="cmp-winner-badge">WINNER</div>' : ""}
  </div>
</div>`.trim();
}

// ── STAT HERO SCENE ────────────────────────────────────────────────────────
function renderStatHeroInner(td: Extract<TemplateDataType, { template: "stat-hero" }>): string {
  const context = td.context ? `<div class="stat-context">${escapeHtml(td.context)}</div>` : "";
  return `
<div class="layout-stat-hero">
  <div class="stat-value shimmer-sweep-target">${escapeHtml(td.value)}</div>
  <div class="stat-label">${escapeHtml(td.label)}</div>
  ${context}
</div>`.trim();
}

// ── FEATURE LIST SCENE ─────────────────────────────────────────────────────
function renderFeatureListInner(td: Extract<TemplateDataType, { template: "feature-list" }>): string {
  const alignClass = td.align ? `align-${td.align}` : "align-center";
  const bullets = td.bullets.map((b, i) =>
    `<div class="feat-bullet feat-bullet-${i}" data-idx="${i}">
      <div class="feat-dot"></div>
      <div class="feat-text">${escapeHtml(b)}</div>
    </div>`
  ).join("\n    ");

  return `
<div class="layout-feature-list ${alignClass}">
  <div class="feat-card">
    <div class="feat-title">${escapeHtml(td.title)}</div>
    <div class="feat-rule"></div>
    <div class="feat-bullets">
      ${bullets}
    </div>
  </div>
</div>`.trim();
}

// ── CALLOUT SCENE ──────────────────────────────────────────────────────────
function renderCalloutInner(td: Extract<TemplateDataType, { template: "callout" }>): string {
  const alignClass = td.align ? `align-${td.align}` : "align-center";
  const tag = td.tag ? `<div class="callout-tag">${escapeHtml(td.tag)}</div>` : "";
  return `
<div class="layout-callout ${alignClass}">
  <div class="callout-card">
    ${tag}
    <div class="callout-statement">${escapeHtml(td.statement)}</div>
  </div>
</div>`.trim();
}

// ── KINETIC TEXT SCENE ─────────────────────────────────────────────────────
function renderKineticTextInner(td: Extract<TemplateDataType, { template: "kinetic-text" }>): string {
  const chunks = td.chunks.map((chunk, i) =>
    `<div class="kinetic-chunk kinetic-chunk-${i}">${escapeHtml(chunk)}</div>`
  ).join("");

  const colorClass = td.highlightColor === "secondary" ? "highlight-secondary" : "highlight-primary";

  return `
<div class="layout-kinetic-text ${colorClass}">
  <div class="kinetic-container">
    ${chunks}
  </div>
</div>`.trim();
}

// ── MANGA PANEL SCENE ─────────────────────────────────────────────────────
function renderMangaPanelInner(td: Extract<TemplateDataType, { template: "manga-panel" }>): string {
  const pageNum = td.pageNumber;
  const totalPages = td.totalPages;
  const mangaTitle = escapeHtml(td.mangaTitle);
  const chapterTitle = escapeHtml(td.chapterTitle);
  const pageSrc = td.pageSrc ? escapeHtml(td.pageSrc) : "";

  // The manga panel uses the page image as background (set via scene bg),
  // and overlays page number + title info
  return `
<div class="layout-manga-panel">
  ${pageSrc ? `<div class="manga-page-img" style="background-image: url('${pageSrc}')"></div>` : ""}
  <div class="manga-info-top">
    <div class="manga-title-bar">${mangaTitle}</div>
    <div class="manga-chapter-bar">${chapterTitle}</div>
  </div>
  <div class="manga-page-counter">
    <span class="manga-page-current">${pageNum}</span>
    <span class="manga-page-sep">/</span>
    <span class="manga-page-total">${totalPages}</span>
  </div>
</div>`.trim();
}

// ── OUTRO SCENE ────────────────────────────────────────────────────────────
function renderOutroInner(
  _td: Extract<TemplateDataType, { template: "outro" }>,
): string {
  return `<div class="layout-outro clean-outro"></div>`;
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function buildScene(
  scene: Script["scenes"][number],
  start: number,
  duration: number,
  layoutName: string,
  innerHtml: string,
): string {
  // Extract align from templateData if it exists
  const td = scene.templateData as any;
  const alignClass = td.align ? `align-${td.align}` : "";
  const cameraEffect = scene.camera || "none";

  return `
<div class="scene clip ${alignClass}" id="scene-${scene.id}"
     data-start="${start.toFixed(2)}" data-duration="${duration.toFixed(2)}" data-active="0"
     data-layout="${layoutName}" data-camera="${cameraEffect}">
  ${innerHtml}
</div>`.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
