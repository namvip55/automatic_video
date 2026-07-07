<a id="top"></a>

<div align="center">

<img src="./assets/logo.svg" alt="Automatic Video Generator" width="120" />

# 🎬 Automatic Video Generator

### Tạo video dọc 9:16 tự động từ tin tức, truyện kể hoặc manga

**Clone repo, setup môi trường, nhập nội dung — pipeline sẽ tự tạo voice, phụ đề, hiệu ứng, nền video và xuất `video.mp4`.**

[![License](https://img.shields.io/github/license/namvip55/automatic_video?style=for-the-badge&color=green)](LICENSE)
[![Node](https://img.shields.io/badge/node-22%2B-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-6%2B-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[**🚀 Setup nhanh**](#-setup-nhanh) · [**🎥 Tạo video**](#-tạo-video) · [**🧰 Lệnh hữu ích**](#-lệnh-hữu-ích)

</div>

---

## Giới thiệu

Đây là project tự động hóa sản xuất video ngắn cho TikTok, YouTube Shorts, Facebook Reels hoặc các nền tảng video dọc. Project hỗ trợ tạo video từ URL tin tức, nội dung truyện kể tiếng Việt, hoặc ảnh manga/truyện tranh.

Pipeline sẽ tự xử lý các phần chính:

- Tạo giọng đọc bằng LucyLab hoặc ElevenLabs.
- Tải ảnh/video nền từ Pexels theo keyword.
- Render video dọc 9:16 bằng HyperFrames, Puppeteer, GSAP và FFmpeg.
- Tự ghép voice, SFX, BGM và phụ đề.
- Xuất file cuối cùng tại `output/<slug>/video.mp4`.

## Các chế độ hỗ trợ

| Mode | Input | Visual | Output |
| :--- | :--- | :--- | :--- |
| News | URL tin tức hoặc file nội dung | Video/ảnh stock + template tin tức | `video.mp4` |
| Story | Chủ đề hoặc nội dung truyện | Video đông người tấp nập/xô bồ, thể thao, thiên nhiên hùng vĩ | `video.mp4` |
| Manga | URL/folder ảnh truyện | Trang manga + Ken Burns | `video.mp4` |

## Tính năng chính

- Standalone CLI commands cho từng mode: `npm run news`, `npm run story`, `npm run manga`.
- Auto script generation: URL tin tức → script.json hoặc chủ đề truyện → script.json qua LLM (OpenAI-compatible API).
- News URL scraping với Firecrawl API: hỗ trợ JS-rendered sites, AI-powered content extraction, loại bỏ quảng cáo/navigation.
- Story Mode dùng video nền động: đông người tấp nập/xô bồ, thể thao, thiên nhiên hùng vĩ; không dùng ảnh tĩnh.
- Manga OCR bằng OCR.Space API (Vietnamese, Engine 2), đọc phải sang trái, trên xuống dưới.
- TTS tiếng Việt qua LucyLab, hoặc đa ngôn ngữ qua ElevenLabs.
- Tự burn phụ đề vào video.
- Có sẵn SFX/BGM mẫu để clone về chạy nhanh.

---

## 🚀 Setup nhanh

### Yêu cầu trước khi clone

Máy cần có 4 công cụ:

- Git
- Node.js 22+
- npm
- FFmpeg

Cài nhanh trên Windows:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Gyan.FFmpeg -e
```

Cài nhanh trên macOS:

```bash
brew install git node ffmpeg
```

Cài nhanh trên Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git ffmpeg curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Kiểm tra sau khi cài:

```bash
git --version
node --version
npm --version
ffmpeg -version
```

### Clone và cài project

```bash
git clone https://github.com/namvip55/automatic_video.git
cd automatic_video
npm install
```

### Tạo file môi trường

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS/Linux:

```bash
cp .env.example .env.local
```

Mở `.env.local` và điền API keys.

**Bắt buộc cho News Mode:**

```env
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
FIRECRAWL_API_KEY=fc-your_firecrawl_api_key
```

**Bắt buộc cho Story Mode:**

```env
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_MODEL=nvidia/llama-3.1-nemotron-70b-instruct
```

**Bắt buộc cho Manga OCR:**

```env
OCR_PROVIDER=ocr_space
OCR_SPACE_API_KEY=your_ocr_space_api_key
```

**Bắt buộc cho TTS** (chọn một):

Dùng LucyLab:

```env
TTS_PROVIDER=lucylab
VIETNAMESE_API_KEY=your_lucylab_api_key
VIETNAMESE_VOICEID=your_lucylab_voice_id
```

Hoặc dùng ElevenLabs:

```env
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

**Tùy chọn cho stock footage:**

```env
PEXELS_API_KEY=your_pexels_api_key
```

### Check project

```bash
npm run typecheck
npm test
```

Nếu cả hai lệnh pass, project đã sẵn sàng render video.

---

## 🎥 Tạo video

### News Video (từ URL tin tức)

```bash
npm run news -- https://vnexpress.net/link-tin-tuc
```

Pipeline sẽ tự:
1. Scrape nội dung từ URL
2. Generate script.json qua LLM
3. Render video

### Story Video (từ chủ đề)

```bash
npm run story -- "Kể chuyện về người anh hùng cứu thế giới"
```

Hoặc từ file:

```bash
npm run story -- --file story.txt
```

### Manga Video (từ URL hoặc folder)

```bash
npm run manga -- https://manga-site.com/chapter-1
# hoặc
npm run manga -- path/to/manga-pages/
```

### Chạy từ script.json có sẵn

Nếu đã có `script.json`:

```bash
npm run pipeline -- path/to/script.json
```

---

## 🧰 Lệnh hữu ích

```bash
npm run news -- <url>                         # Tạo video tin tức từ URL
npm run story -- "<topic>"                     # Tạo video truyện từ chủ đề
npm run manga -- <url-or-folder>              # Tạo video manga từ URL/folder
npm run pipeline -- path/to/script.json       # Render từ script.json có sẵn
npm run rerender -- output/<slug>             # Render lại visuals từ output có sẵn
npm run typecheck                             # Kiểm tra TypeScript
npm test                                      # Chạy test
npm run sfx:download                         # Tải SFX thô vào SFX/
npm run sfx:filter                           # Lọc SFX ngắn vào assets/sfx/
```

## Lỗi setup thường gặp

| Lỗi | Cách xử lý |
| :--- | :--- |
| `node` is not recognized | Cài Node.js 22+ rồi mở lại terminal |
| `ffmpeg` is not recognized | Cài FFmpeg rồi mở lại terminal |
| Thiếu `LLM_API_KEY` | Điền API key trong `.env.local` (bắt buộc cho News/Story) |
| Thiếu `FIRECRAWL_API_KEY` | Đăng ký miễn phí tại https://firecrawl.dev (500 free credits), thêm key vào `.env.local` (bắt buộc cho News) |
| Thiếu `OCR_SPACE_API_KEY` | Điền OCR.Space key trong `.env.local` (bắt buộc cho Manga) |
| Thiếu `VIETNAMESE_API_KEY` | Điền LucyLab key trong `.env.local` (nếu dùng TTS) |
| Thiếu `PEXELS_API_KEY` | Điền Pexels key trong `.env.local` (tùy chọn, dùng cho stock footage) |
| Không có SFX | Repo có sẵn SFX mẫu; muốn thêm thì chạy `npm run sfx:download` và `npm run sfx:filter` |
| JSON validation fails | Kiểm tra template data, text length và theme hợp lệ |

---

## 🛠️ Tech Stack

- **Engine**: [HyperFrames](https://hyperframes.heygen.com) (Puppeteer + GSAP + FFmpeg).
- **Language**: TypeScript 6 (ESM).
- **LLM**: OpenAI-compatible API (News/Story script generation). Hỗ trợ: OpenAI, NVIDIA NIM, Azure, Together, Groq, v.v.
- **URL Scraping**: Firecrawl API (News Mode — JS-rendered sites, AI content extraction).
- **Manga OCR**: OCR.Space API (Vietnamese text recognition, Engine 2).
- **TTS**: LucyLab (Vietnamese) or ElevenLabs (Multilingual).
- **Audio**: FFmpeg (Mixing, Normalization, Concat).

---

## 📁 Output Structure
After rendering, you will find your assets in `output/<slug>/`:
- `video.mp4`: Final high-quality video.
- `index.html`: The source code of the video composition.
- `voice/`, `voice.mp3`, `subtitles.srt`: Internal render artifacts.

---

## 🗺️ Roadmap
- [x] Auto Manga OCR & RTL Reading.
- [x] Gemini-powered Thumbnail generation.
- [ ] Automated Background Music selection by mood.
- [ ] Auto-upload to social/reels APIs.
- [ ] Burned-in captions via Whisper alignment.

---

## 🤝 Contributing
Contributions are welcome! Please read our `design.md` for visual guidelines and run `npm test` before submitting PRs.

## 📜 License
[MIT](LICENSE) — Use it for personal or commercial projects.

---
<div align="center">
Made with ❤️ by [Nepsilon](https://github.com/namvip55) in 🇻🇳 Vietnam
</div>
