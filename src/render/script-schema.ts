import { z } from "zod";

// ── Template data shapes (discriminated by template field) ─────────────────

const HookData = z.object({
  template: z.literal("hook"),
  headline: z.string().min(1).max(40),
  subhead: z.string().max(40).optional(),
  /** background image path (literal "$source.image" → substituted at pipeline level) */
  bgSrc: z.string().optional(),
  /** Ken Burns effect class */
  kenBurns: z.enum(["zoom-in", "zoom-out", "pan-left", "pan-right"]).default("zoom-in"),
});

const ComparisonSide = z.object({
  label: z.string().min(1).max(30),
  value: z.string().min(1).max(20),
  color: z.enum(["cyan", "purple"]),
});

const ComparisonData = z.object({
  template: z.literal("comparison"),
  left: ComparisonSide,
  right: ComparisonSide.extend({ winner: z.boolean().optional() }),
});

const StatHeroData = z.object({
  template: z.literal("stat-hero"),
  value: z.string().min(1).max(20),
  label: z.string().min(1).max(40),
  context: z.string().max(50).optional(),
});

const FeatureListData = z.object({
  template: z.literal("feature-list"),
  title: z.string().min(1).max(40),
  bullets: z.array(z.string().min(1).max(50)).min(1).max(4),
  icon: z.string().optional(),
  align: z.enum(["center", "bottom-left", "bottom-right"]).default("center"),
});

const CalloutData = z.object({
  template: z.literal("callout"),
  statement: z.string().min(1).max(80),
  tag: z.string().max(20).optional(),
  align: z.enum(["center", "bottom-left", "bottom-right"]).default("center"),
});

const KineticTextData = z.object({
  template: z.literal("kinetic-text"),
  chunks: z.array(z.string().min(1).max(30)).min(1).max(6),
  highlightColor: z.enum(["primary", "secondary"]).default("primary"),
});

const OutroData = z.object({
  template: z.literal("outro"),
  ctaTop: z.string().min(1).max(30),
  channelName: z.string().min(1).max(30),
  source: z.string().min(1).max(40),
});

const MangaPanelData = z.object({
  template: z.literal("manga-panel"),
  /** Current page number (1-based) */
  pageNumber: z.number().int().min(1),
  /** Total pages in this chapter */
  totalPages: z.number().int().min(1),
  /** Manga title displayed at top */
  mangaTitle: z.string().min(1).max(60),
  /** Chapter title displayed below manga title */
  chapterTitle: z.string().min(1).max(80),
  /** Ken Burns effect for this panel */
  kenBurns: z.enum(["zoom-in", "zoom-out", "pan-left", "pan-right"]).default("zoom-in"),
  /** Local path to the page image (set by pipeline) */
  pageSrc: z.string().optional(),
});

export const TemplateData = z.discriminatedUnion("template", [
  HookData,
  ComparisonData,
  StatHeroData,
  FeatureListData,
  CalloutData,
  KineticTextData,
  OutroData,
  MangaPanelData,
]);

export type TemplateDataType = z.infer<typeof TemplateData>;

// ── SFX schema ─────────────────────────────────────────────────────────────
/**
 * Per-scene sound effect override. If omitted, the pipeline picks a default
 * SFX based on the template type (see SKILL.md / pipeline DEFAULT_SFX).
 *
 * `name` examples: "transition/whoosh-soft", "emphasis/ding", "alert/notification"
 *   → resolves to assets/sfx/<name>.mp3
 * Set `name: "none"` to explicitly disable SFX for this scene.
 */
const SfxSpec = z.object({
  name: z.string().min(1),
  /** Volume 0–1, default 0.4 (so SFX doesn't drown the voice) */
  volume: z.number().min(0).max(1).default(0.4),
  /** Seconds offset from scene start (default 0). Negative = before scene. */
  startOffsetSec: z.number().default(0),
});

export type SfxSpecType = z.infer<typeof SfxSpec>;

// ── Scene schema ───────────────────────────────────────────────────────────

const Scene = z.object({
  id: z.string().min(1),
  type: z.enum(["hook", "body", "outro"]),
  voiceText: z.string().min(1),
  visual: z.object({
    videoKeyword: z.string().optional(),
    /** Keyword to search Pexels Photos API for a still image background (alternative to videoKeyword) */
    imageKeyword: z.string().optional(),
    /** Override background for this scene: use article image (pass "$source.image" in pipeline) */
    bgSrc: z.string().optional(),
    background: z.object({
      type: z.enum(["image", "video", "gradient"]).default("gradient"),
      src: z.string().optional(),
    }).optional(),
  }).optional(),
  templateData: TemplateData,
  sfx: SfxSpec.optional(),
  /** Dynamic camera transition during the scene. None = static/normal KenBurns. punch-in = sudden scale up mid-scene */
  camera: z.enum(["none", "punch-in", "punch-out", "shake"]).default("none").optional(),
  /** Ken Burns effect for image backgrounds (defaults to "zoom-in") */
  kenBurns: z.enum(["zoom-in", "zoom-out", "pan-left", "pan-right"]).optional(),
  /** Target duration for the scene in seconds. If set, audio will be padded/trimmed to this exact length. */
  targetDuration: z.number().min(1).optional(),
});

// ── Root schema ────────────────────────────────────────────────────────────

export const ScriptSchema = z.object({
  version: z.literal("1.0"),
  metadata: z.object({
    title: z.string().min(1),
    source: z.object({
      url: z.string(),
      domain: z.string(),
      image: z.string().nullable(),
    }),
    channel: z.string().min(1),
    /** Color theme for the entire video. Default is "classic" (cyan/purple). */
    theme: z.enum(["classic", "gold", "emerald", "sunset", "cyber"]).default("classic").optional(),
    /** Mode: "news" (default) or "manga" (manga slideshow mode). */
    mode: z.enum(["news", "manga"]).default("news").optional(),
  }),
  voice: z.object({
    provider: z.enum(["lucylab", "elevenlabs"]),
    voiceId: z.string().min(1),
    speed: z.number().min(0.5).max(2.0),
  }),
  /** Optional BGM config for manga mode. */
  bgm: z.object({
    /** Path or keyword for background music file */
    src: z.string().min(1),
    /** Volume 0-1 (default 0.2) */
    volume: z.number().min(0).max(1).default(0.2),
    /** Fade in duration in seconds (default 2) */
    fadeInSec: z.number().min(0).default(2),
    /** Fade out duration in seconds (default 3) */
    fadeOutSec: z.number().min(0).default(3),
  }).optional(),
  scenes: z
    .array(Scene)
    .min(3)
    .max(150, "scenes must have at most 150 items")
    .refine(
      (s) => s[0]?.type === "hook",
      { message: "scenes[0] must be type=hook" }
    )
    .refine(
      (s) => s[s.length - 1]?.type === "outro",
      { message: "last scene must be type=outro" }
    ),
});

export type Script = z.infer<typeof ScriptSchema>;
