import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildMergedSubtitleFile, burnSubtitlesIntoVideo, subtitleForceStyle, toWordHighlightAss } from "./subtitle-burner.js";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sub-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("buildMergedSubtitleFile", () => {
  it("merges scene SRT cues with scene start offsets", async () => {
    const srt1 = join(tmp, "scene-1.srt");
    const srt2 = join(tmp, "scene-2.srt");
    const out = join(tmp, "subtitles.srt");

    await writeFile(
      srt1,
      "1\n00:00:00,000 --> 00:00:01,000\nXin chao\n",
      "utf8",
    );
    await writeFile(
      srt2,
      "1\n00:00:00,200 --> 00:00:01,000\nTam biet\n",
      "utf8",
    );

    const result = await buildMergedSubtitleFile({
      scenes: [
        {
          sceneId: "s1",
          sceneStartSec: 0,
          sceneDurationSec: 1.5,
          voiceText: "Xin chao.",
          srtPath: srt1,
        },
        {
          sceneId: "s2",
          sceneStartSec: 2.5,
          sceneDurationSec: 1.2,
          voiceText: "Tam biet.",
          srtPath: srt2,
        },
      ],
      outSrtPath: out,
    });

    expect(result.cueCount).toBe(2);
    expect(result.usedSrt).toBe(2);
    expect(result.estimated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.outPath).toBe(out);

    const merged = await readFile(out, "utf8");
    expect(merged).toContain("00:00:00,000 --> 00:00:01,000");
    expect(merged).toContain("00:00:02,700 --> 00:00:03,500");
    expect(merged).toContain("Xin chao");
    expect(merged).toContain("Tam biet");
  });

  it("splits long SRT cues into shorter timed chunks", async () => {
    const srt = join(tmp, "scene-1.srt");
    const out = join(tmp, "subtitles.srt");

    await writeFile(
      srt,
      "1\n00:00:00,000 --> 00:00:04,000\nEl Nino có thể quay lại trong năm hai nghìn không trăm hai mươi sáu, và thời tiết toàn cầu sẽ rất khó đoán\n",
      "utf8",
    );

    const result = await buildMergedSubtitleFile({
      scenes: [
        {
          sceneId: "s1",
          sceneStartSec: 0,
          sceneDurationSec: 4,
          voiceText: "El Nino có thể quay lại trong năm hai nghìn không trăm hai mươi sáu.",
          srtPath: srt,
        },
      ],
      outSrtPath: out,
    });

    expect(result.usedSrt).toBe(1);
    expect(result.cueCount).toBeGreaterThan(1);
    const merged = await readFile(out, "utf8");
    expect(merged).toContain("00:00:00,000 -->");
    expect(merged).toContain("--> 00:00:04,000");
  });

  it("falls back to estimated cues when SRT is invalid JSON array", async () => {
    const srt = join(tmp, "scene-1.srt");
    const out = join(tmp, "subtitles.srt");

    await writeFile(srt, "[]", "utf8");

    const result = await buildMergedSubtitleFile({
      scenes: [
        {
          sceneId: "s1",
          sceneStartSec: 1,
          sceneDurationSec: 2,
          voiceText: "Cau mot. Cau hai!",
          srtPath: srt,
        },
      ],
      outSrtPath: out,
    });

    expect(result.usedSrt).toBe(0);
    expect(result.estimated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.cueCount).toBeGreaterThan(0);

    const merged = await readFile(out, "utf8");
    expect(merged).toContain("Cau mot");
    expect(merged).toContain("Cau hai");
  });

  it("falls back to estimated cues when SRT is malformed", async () => {
    const srt = join(tmp, "scene-1.srt");
    const out = join(tmp, "subtitles.srt");

    await writeFile(srt, "not-an-srt", "utf8");

    const result = await buildMergedSubtitleFile({
      scenes: [
        {
          sceneId: "s1",
          sceneStartSec: 0,
          sceneDurationSec: 1.5,
          voiceText: "Noi dung fallback.",
          srtPath: srt,
        },
      ],
      outSrtPath: out,
    });

    expect(result.usedSrt).toBe(0);
    expect(result.estimated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.cueCount).toBeGreaterThan(0);
  });

  it("skips silent scenes and returns null path when no cues", async () => {
    const out = join(tmp, "subtitles.srt");

    const result = await buildMergedSubtitleFile({
      scenes: [
        {
          sceneId: "s1",
          sceneStartSec: 0,
          sceneDurationSec: 1,
          voiceText: ".",
          srtPath: join(tmp, "missing-1.srt"),
        },
        {
          sceneId: "s2",
          sceneStartSec: 1,
          sceneDurationSec: 1,
          voiceText: "   ",
          srtPath: join(tmp, "missing-2.srt"),
        },
      ],
      outSrtPath: out,
    });

    expect(result.cueCount).toBe(0);
    expect(result.outPath).toBeNull();
    expect(result.skipped).toBe(2);
  });
});

describe("subtitleForceStyle", () => {
  it("uses bold italic modern sans-serif styling", () => {
    const style = subtitleForceStyle();
    expect(style).toContain("FontName=Montserrat ExtraBold Italic");
    expect(style).toContain("Bold=1");
    expect(style).toContain("Italic=1");
    expect(style).toContain("Outline=1.1");
  });
});

describe("toWordHighlightAss", () => {
  it("builds ASS subtitles with karaoke word highlight styling", () => {
    const ass = toWordHighlightAss([
      { startMs: 0, endMs: 1200, text: "Xin chao ban" },
    ]);

    expect(ass).toContain("[V4+ Styles]");
    expect(ass).toContain("Style: Highlight,Montserrat ExtraBold Italic,54");
    expect(ass).toContain("&H0000D7FF");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:01.20,Highlight");
    expect(ass).toMatch(/\{\\k\d+\}Xin \{\\k\d+\}chao \{\\k\d+\}ban/);
  });

  it("escapes ASS control characters in cue text", () => {
    const ass = toWordHighlightAss([
      { startMs: 0, endMs: 1000, text: "A {test} \\ ok" },
    ]);

    expect(ass).toContain("\\{test\\}");
    expect(ass).toContain("\\\\");
  });
});

describe("burnSubtitlesIntoVideo", () => {
  it("returns false when video or subtitle file does not exist", async () => {
    const ok = await burnSubtitlesIntoVideo({
      videoPath: join(tmp, "missing.mp4"),
      subtitlePath: join(tmp, "missing.srt"),
    });
    expect(ok).toBe(false);
  });
});
