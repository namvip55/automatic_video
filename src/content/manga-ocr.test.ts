import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import axios from "axios";

// Mock axios for OCR.Space API calls
vi.mock("axios");
const mockedAxios = vi.mocked(axios);

import { ocrMangaPages } from "./manga-ocr.js";

describe("manga-ocr", () => {
  let tmpDir: string;
  let page1Path: string;
  let page2Path: string;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OCR_PROVIDER = "ocr_space";
    process.env.OCR_SPACE_API_KEY = "test-ocr-key";
    process.env.OCR_SPACE_BASE_URL = "https://api.ocr.space";
    process.env.OCR_SPACE_ENGINE = "2";

    tmpDir = mkdtempSync(join(tmpdir(), "ocr-test-"));
    page1Path = join(tmpDir, "page-001.png");
    page2Path = join(tmpDir, "page-002.png");
    writeFileSync(page1Path, "DUMMY_IMAGE_DATA_1");
    writeFileSync(page2Path, "DUMMY_IMAGE_DATA_2");
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.OCR_PROVIDER;
    delete process.env.OCR_SPACE_API_KEY;
    delete process.env.OCR_SPACE_BASE_URL;
    delete process.env.OCR_SPACE_ENGINE;
  });

  it("performs OCR on manga pages and returns array of texts", async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          ParsedResults: [
            {
              ParsedText: "Xin chào thế giới!",
              FileParseExitCode: 1,
            },
          ],
          OCRExitCode: 1,
          IsErroredOnProcessing: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          ParsedResults: [
            {
              ParsedText: "Đây là trang 2.",
              FileParseExitCode: 1,
            },
          ],
          OCRExitCode: 1,
          IsErroredOnProcessing: false,
        },
      });

    const results = await ocrMangaPages([page1Path, page2Path], { concurrency: 1 });
    expect(results).toEqual(["Xin chào thế giới!", "Đây là trang 2."]);
  });

  it("returns dot for empty/failed pages", async () => {
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          ParsedResults: [
            {
              ParsedText: "", // empty content
              FileParseExitCode: 1,
            },
          ],
          OCRExitCode: 1,
          IsErroredOnProcessing: false,
        },
      })
      .mockResolvedValueOnce({
        data: {
          OCRExitCode: 99,
          IsErroredOnProcessing: true,
          ErrorMessage: ["API Error"],
        },
      });

    const results = await ocrMangaPages([page1Path, page2Path], { concurrency: 2 });
    expect(results).toEqual([".", "."]);
  });
});
