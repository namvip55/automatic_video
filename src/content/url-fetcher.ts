/**
 * url-fetcher.ts
 *
 * Scrape URL → text content (title, body text, og:image).
 * Uses Firecrawl API for AI-powered content extraction.
 */

import axios from "axios";

export interface FetchedContent {
  title: string;
  text: string;
  url: string;
  domain: string;
  ogImage: string | null;
}

interface FirecrawlResponse {
  success: boolean;
  data: {
    markdown: string;
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
      ogImage?: string;
    };
    html?: string;
    links?: string[];
  };
}

interface FirecrawlConfig {
  apiKey: string;
  baseUrl: string;
}

/**
 * Read Firecrawl configuration from environment variables.
 * Avoids loading full config to prevent TTS/LLM validation side effects.
 */
function getFirecrawlConfig(): FirecrawlConfig {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const baseUrl = process.env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev";

  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is required for News URL scraping. " +
      "Get a free API key at https://firecrawl.dev"
    );
  }

  return { apiKey, baseUrl };
}

/**
 * Fetch a URL and extract the main text content, title, and og:image.
 *
 * Strategy:
 *   1. POST to Firecrawl API with the URL
 *   2. Request markdown format with onlyMainContent=true (AI-powered filtering)
 *   3. Extract title and ogImage from metadata
 *   4. Return clean markdown content
 */
export async function fetchUrlContent(url: string): Promise<FetchedContent> {
  const { apiKey, baseUrl } = getFirecrawlConfig();

  try {
    const resp = await axios.post(
      `${baseUrl}/v1/scrape`,
      {
        url,
        formats: ["markdown"],
        onlyMainContent: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 60000, // Firecrawl may take longer (JS rendering, AI processing)
      }
    );

    const data: FirecrawlResponse = resp.data;

    if (!data.success) {
      throw new Error(`Firecrawl scrape failed for ${url}: ${JSON.stringify(data)}`);
    }

    const domain = safeDomain(url);
    const title = data.data.metadata?.title?.trim() || domain;
    const text = data.data.markdown?.trim() || "";
    const ogImage = data.data.metadata?.ogImage || null;

    return {
      title,
      text,
      url,
      domain,
      ogImage,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error || error.message;
      throw new Error(
        `Failed to scrape ${url} (HTTP ${status}): ${message}`
      );
    }
    throw error;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "local";
  }
}
