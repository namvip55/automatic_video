import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";
import { fetchUrlContent } from "./url-fetcher.js";

vi.mock("axios");
const mockedAxios = vi.mocked(axios);

describe("url-fetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIRECRAWL_API_KEY = "fc-test-key";
    process.env.FIRECRAWL_BASE_URL = "https://api.firecrawl.dev";
  });

  it("extracts title, body, and ogImage from Firecrawl response", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          markdown: "# Main Heading\n\nThis is the first paragraph with some details.\n\nSecond paragraph holds more content.",
          metadata: {
            title: "Test Page",
            ogImage: "https://example.com/cover.jpg",
          },
        },
      },
    });

    const content = await fetchUrlContent("https://example.com/news");

    expect(content.title).toBe("Test Page");
    expect(content.ogImage).toBe("https://example.com/cover.jpg");
    expect(content.domain).toBe("example.com");
    expect(content.text).toContain("This is the first paragraph");
    expect(content.text).toContain("Second paragraph holds");

    // Verify API call
    expect(mockedAxios.post).toHaveBeenCalledWith(
      "https://api.firecrawl.dev/v1/scrape",
      {
        url: "https://example.com/news",
        formats: ["markdown"],
        onlyMainContent: true,
      },
      expect.objectContaining({
        headers: {
          Authorization: "Bearer fc-test-key",
          "Content-Type": "application/json",
        },
      })
    );
  });

  it("falls back to domain when title is missing", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          markdown: "Paragraph content.",
          metadata: {},
        },
      },
    });

    const content = await fetchUrlContent("https://example.com/simple");
    expect(content.title).toBe("example.com");
  });

  it("returns null for ogImage when missing", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          markdown: "Some content.",
          metadata: {
            title: "Page Without Image",
          },
        },
      },
    });

    const content = await fetchUrlContent("https://example.com/no-image");
    expect(content.ogImage).toBeNull();
  });

  it("throws error when Firecrawl API returns success: false", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        success: false,
        error: "Invalid API key",
      },
    });

    await expect(fetchUrlContent("https://example.com/fail")).rejects.toThrow(
      "Firecrawl scrape failed"
    );
  });

  it("throws error on network failure with descriptive message", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: { error: "Unauthorized" },
      },
      message: "Request failed",
    });

    // Cast to any to bypass type predicate signature requirement
    (mockedAxios.isAxiosError as any) = vi.fn().mockReturnValue(true);

    await expect(fetchUrlContent("https://example.com/auth-fail")).rejects.toThrow(
      "Failed to scrape https://example.com/auth-fail (HTTP 401): Unauthorized"
    );
  });
});
