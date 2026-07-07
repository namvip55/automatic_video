import "dotenv/config";

export type TtsProvider = "lucylab" | "elevenlabs";
export type OcrProvider = "ocr_space";

export interface Config {
  ttsProvider: TtsProvider;

  // LucyLab
  lucylabApiKey?: string;
  lucylabVoiceId?: string;
  lucylabEndpoint: string;
  lucylabPollIntervalMs: number;
  lucylabPollTimeoutMs: number;

  // ElevenLabs
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  elevenlabsModelId: string;
  elevenlabsEndpoint: string;

  // Stock Footage
  pexelsApiKey?: string;

  // LLM (News/Story script generation)
  llmApiKey?: string;
  llmBaseUrl?: string;
  llmModel: string;

  // Firecrawl (News URL scraping)
  firecrawlApiKey?: string;
  firecrawlBaseUrl: string;

  // OCR (Manga OCR)
  ocrProvider: OcrProvider;
  ocrSpaceApiKey?: string;
  ocrSpaceBaseUrl: string;
  ocrSpaceEngine: number;

  ttsConcurrency: number;
}

function intDefault(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = parseInt(v, 10);
  if (isNaN(n)) throw new Error(`Env var ${name} must be integer, got "${v}"`);
  return n;
}

export function loadConfig(): Config {
  const provider = (process.env.TTS_PROVIDER ?? "lucylab") as TtsProvider;
  if (provider !== "lucylab" && provider !== "elevenlabs") {
    throw new Error(`TTS_PROVIDER must be "lucylab" or "elevenlabs", got "${provider}"`);
  }

  // Validate provider-specific required vars
  if (provider === "lucylab") {
    if (!process.env.VIETNAMESE_API_KEY || process.env.VIETNAMESE_API_KEY.trim() === "") {
      throw new Error(
        `Missing VIETNAMESE_API_KEY (required when TTS_PROVIDER=lucylab). ` +
        `Copy .env.example to .env.local and fill in your LucyLab API key.`
      );
    }
    if (!process.env.VIETNAMESE_VOICEID || process.env.VIETNAMESE_VOICEID.trim() === "") {
      throw new Error(
        `Missing VIETNAMESE_VOICEID (required when TTS_PROVIDER=lucylab). ` +
        `Copy .env.example to .env.local and fill in your LucyLab voice ID.`
      );
    }
  } else {
    if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY.trim() === "") {
      throw new Error(
        `Missing ELEVENLABS_API_KEY (required when TTS_PROVIDER=elevenlabs). ` +
        `Copy .env.example to .env.local and fill in your ElevenLabs API key.`
      );
    }
    if (!process.env.ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID.trim() === "") {
      throw new Error(
        `Missing ELEVENLABS_VOICE_ID (required when TTS_PROVIDER=elevenlabs). ` +
        `Copy .env.example to .env.local and fill in your ElevenLabs voice ID.`
      );
    }
  }

  // Validate Firecrawl API (News URL scraping)
  if (!process.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY.trim() === "") {
    throw new Error(
      `Missing FIRECRAWL_API_KEY (required for News URL scraping). ` +
      `Get a free API key at https://firecrawl.dev (500 free credits).`
    );
  }

  // Validate OCR provider
  const ocrProvider = (process.env.OCR_PROVIDER ?? "ocr_space") as OcrProvider;
  if (ocrProvider === "ocr_space") {
    if (!process.env.OCR_SPACE_API_KEY || process.env.OCR_SPACE_API_KEY.trim() === "") {
      throw new Error(
        `Missing OCR_SPACE_API_KEY (required when OCR_PROVIDER=ocr_space). ` +
        `Get a free key at https://ocr.space/ocrapi`
      );
    }
  }

  return {
    ttsProvider: provider,
    lucylabApiKey: process.env.VIETNAMESE_API_KEY,
    lucylabVoiceId: process.env.VIETNAMESE_VOICEID,
    lucylabEndpoint: process.env.LUCYLAB_ENDPOINT ?? "https://api.lucylab.io/json-rpc",
    lucylabPollIntervalMs: intDefault("LUCYLAB_POLL_INTERVAL_MS", 2000),
    lucylabPollTimeoutMs: intDefault("LUCYLAB_POLL_TIMEOUT_MS", 120000),
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
    elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID,
    elevenlabsModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
    elevenlabsEndpoint: process.env.ELEVENLABS_ENDPOINT ?? "https://api.elevenlabs.io/v1",
    pexelsApiKey: process.env.PEXELS_API_KEY,
    llmApiKey: process.env.LLM_API_KEY,
    llmBaseUrl: process.env.LLM_BASE_URL,
    llmModel: process.env.LLM_MODEL ?? "gpt-4o",
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
    firecrawlBaseUrl: process.env.FIRECRAWL_BASE_URL ?? "https://api.firecrawl.dev",
    ocrProvider: (process.env.OCR_PROVIDER ?? "ocr_space") as OcrProvider,
    ocrSpaceApiKey: process.env.OCR_SPACE_API_KEY,
    ocrSpaceBaseUrl: process.env.OCR_SPACE_BASE_URL ?? "https://api.ocr.space",
    ocrSpaceEngine: intDefault("OCR_SPACE_ENGINE", 2),
    ttsConcurrency: intDefault("TTS_CONCURRENCY", 1),
  };
}
