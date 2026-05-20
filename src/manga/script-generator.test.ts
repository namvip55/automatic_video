import { describe, it, expect } from "vitest";
import { generateMangaScript } from "./script-generator.js";
import type { MangaChapter } from "./manga-scraper.js";

function chapter(): MangaChapter {
  return {
    title: "Test Manga",
    chapter: "Chapter 1",
    chapterNumber: 1,
    source: "example.com",
    coverImage: "",
    pages: ["p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg", "p5.jpg"],
    totalChapters: 1,
    tags: [],
    chapterList: [],
  };
}

describe("generateMangaScript", () => {
  it("adds rotating Ken Burns effects to manga page scenes", () => {
    const script = generateMangaScript(
      chapter(),
      ["pages/p1.jpg", "pages/p2.jpg", "pages/p3.jpg", "pages/p4.jpg", "pages/p5.jpg"],
    );

    const bodyScenes = script.scenes.filter((scene: any) => scene.type === "body");

    expect(bodyScenes.map((scene: any) => scene.kenBurns)).toEqual([
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "zoom-in",
    ]);
    expect(bodyScenes.map((scene: any) => scene.templateData.kenBurns)).toEqual([
      "zoom-in",
      "zoom-out",
      "pan-left",
      "pan-right",
      "zoom-in",
    ]);
  });
});
