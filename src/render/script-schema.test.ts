import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ScriptSchema } from "./script-schema.js";

const load = (name: string) =>
  JSON.parse(readFileSync(`tests/fixtures/${name}`, "utf8"));

describe("ScriptSchema", () => {
  it("accepts sample-script-with-image.json", () => {
    expect(() => ScriptSchema.parse(load("sample-script-with-image.json"))).not.toThrow();
  });

  it("accepts sample-script-no-image.json", () => {
    expect(() => ScriptSchema.parse(load("sample-script-no-image.json"))).not.toThrow();
  });

  it("rejects invalid-bad-enum.json", () => {
    expect(() => ScriptSchema.parse(load("invalid-bad-enum.json"))).toThrow(/kenBurns/);
  });

  it.skip("rejects invalid-too-many-scenes.json", () => {
    expect(() => ScriptSchema.parse(load("invalid-too-many-scenes.json"))).toThrow(/scenes/);
  });

  it("rejects invalid-line-too-long.json", () => {
    // headline is over 40 chars — Zod error references the max value
    expect(() => ScriptSchema.parse(load("invalid-line-too-long.json"))).toThrow(/40/);
  });

  it("requires hook + outro present", () => {
    const data = load("sample-script-with-image.json");
    data.scenes = data.scenes.filter((s: any) => s.type !== "outro");
    expect(() => ScriptSchema.parse(data)).toThrow(/outro/);
  });

  it("rejects news board templates for story scripts", () => {
    const data = load("sample-script-with-image.json");
    data.metadata.source.domain = "story";
    data.metadata.source.url = "generated://story";
    data.scenes[1].templateData = {
      template: "stat-hero",
      value: "99%",
      label: "giống bảng tin",
    };

    expect(() => ScriptSchema.parse(data)).toThrow(/news board templates/);
  });

  it("rejects news board templates for manga scripts", () => {
    const data = load("sample-script-with-image.json");
    data.metadata.mode = "manga";
    data.scenes[1].templateData = {
      template: "feature-list",
      title: "Bảng tin",
      bullets: ["Không dùng cho manga"],
    };

    expect(() => ScriptSchema.parse(data)).toThrow(/news board templates/);
  });
});
