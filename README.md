<a id="top"></a>

<div align="center">

<img src="./assets/logo.svg" alt="Auto Video Studio" width="120" />

# 🎬 Auto Video Studio (News & Manga)

### AI-Powered Pipeline to Turn Articles or Manga into Viral 9:16 Videos

**One command. Zero editing. Pro-grade motion graphics for short-form vertical video.**

[![Stars](https://img.shields.io/github/stars/hoquanghai/Auto-Create-Video?style=for-the-badge&logo=github&color=yellow)](https://github.com/hoquanghai/Auto-Create-Video/stargazers)
[![License](https://img.shields.io/github/license/hoquanghai/Auto-Create-Video?style=for-the-badge&color=green)](LICENSE)
[![Node](https://img.shields.io/badge/node-22%2B-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-6%2B-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[**🇬🇧 English**](README.md) · [**🇻🇳 Tiếng Việt**](README.vi.md) · [**🚀 Quick Start**](#-quick-start) · [**❓ FAQ**](#-faq)

</div>

---

## 🌟 Overview

**Auto Video Studio** is an automated production pipeline designed for content creators. It bridges the gap between raw content (news articles or manga chapters) and high-quality short-form video using AI orchestration and deterministic rendering.

### 🍱 Two Powerful Modes

| Feature | 📰 News Mode | 📖 Manga Mode |
| :--- | :--- | :--- |
| **Input** | News URL, `.txt`, or `.md` | Manga URL or local folder of images |
| **Visuals** | Pexels stock footage + Article images | Original manga panels with Ken Burns |
| **Logic** | Summarization & Scene Analysis | OCR (Claude Vision) + RTL Reading Order |
| **Templates** | 12 dynamic motion graphic templates | Optimized `manga-panel` slideshow |
| **Voice** | Natural TTS (LucyLab/ElevenLabs) | Character-synced or Narrator TTS |

---

## 🎥 Live Demo
👉 [**Watch Demo on YouTube Shorts**](https://youtube.com/shorts/S24JfKxV4bo)

*This video was generated **entirely** by the pipeline — Vietnamese TTS + HyperFrames + GSAP animations, no manual editing.*

---

## ✨ Key Features

- 🤖 **Claude Code Integration**: Run a single slash command `/create-news-video <url>` to start the entire process.
- 🎨 **12+ Smart Templates**: Hook, Comparison, Stat Hero, Feature List, Manga Panel, Kinetic Quote, and more.
- 👁️ **Smart Manga OCR**: Automated Vietnamese text extraction with logical reordering (Right-to-Left, Top-to-Bottom).
- 🎤 **Pro TTS Support**: Built-in integration with **LucyLab** (Vietnamese voice cloning) and **ElevenLabs**.
- 🔊 **Auto SFX Mixing**: 3-tier smart picker (Semantic Match -> Template Default -> Fallback).
- 🖼️ **Auto Thumbnail**: Generates 9:16 covers using Gemini 2.5 Flash Image.
- ♻️ **Idempotent Pipeline**: Skips expensive TTS steps if audio files already exist.

---

## 🚀 Quick Start From a Fresh Machine

Follow these steps on a computer that has not installed anything for this project yet.

### 1. Install system tools

#### Windows 10/11
Open **PowerShell** or **Windows Terminal** and run:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Gyan.FFmpeg -e
```

Close and reopen the terminal, then verify:

```powershell
git --version
node --version
npm --version
ffmpeg -version
```

Node.js must be **22 or higher**.

#### macOS
Install Homebrew first if needed, then run:

```bash
brew install git node ffmpeg
```

Verify:

```bash
git --version
node --version
npm --version
ffmpeg -version
```

#### Ubuntu/Debian Linux
Run:

```bash
sudo apt update
sudo apt install -y git ffmpeg curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:

```bash
git --version
node --version
npm --version
ffmpeg -version
```

### 2. Clone the repository

```bash
git clone https://github.com/hoquanghai/Auto-Create-Video.git
cd Auto-Create-Video
```

### 3. Install Node modules

This creates the local `node_modules/` folder required to run the TypeScript pipeline.

```bash
npm install
```

### 4. Configure API keys

Copy the example environment file:

#### Windows PowerShell
```powershell
Copy-Item .env.example .env.local
```

#### macOS/Linux
```bash
cp .env.example .env.local
```

Open `.env.local` in a text editor and fill in the keys you want to use.

For the default Vietnamese LucyLab setup:

```env
TTS_PROVIDER=lucylab
VIETNAMESE_API_KEY=your_lucylab_api_key
VIETNAMESE_VOICEID=your_lucylab_voice_id
PEXELS_API_KEY=your_pexels_api_key
```

Or use ElevenLabs instead:

```env
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
PEXELS_API_KEY=your_pexels_api_key
```

Required keys:

| Key | Required for | Purpose |
| :--- | :--- | :--- |
| `VIETNAMESE_API_KEY` | `TTS_PROVIDER=lucylab` | Generate Vietnamese voice audio |
| `VIETNAMESE_VOICEID` | `TTS_PROVIDER=lucylab` | Select LucyLab voice |
| `ELEVENLABS_API_KEY` | `TTS_PROVIDER=elevenlabs` | Generate voice audio |
| `ELEVENLABS_VOICE_ID` | `TTS_PROVIDER=elevenlabs` | Select ElevenLabs voice |
| `PEXELS_API_KEY` | News/Story stock visuals | Download background videos/images |

### 5. Prepare sound effects

The repository includes a small default `assets/sfx/` library, so the pipeline can run immediately after install.

To download a larger SFX library:

```bash
npm run sfx:download
npm run sfx:filter
```

`npm run sfx:download` downloads raw files into `SFX/`; `npm run sfx:filter` copies usable short effects into `assets/sfx/`, which is the folder used by the pipeline.

### 6. Check that the project is healthy

```bash
npm run typecheck
npm test
```

Both commands should pass before rendering videos.

### 7. Create a video with Claude Code

Install Claude Code if you want the automated slash command workflow:

```bash
npm install -g @anthropic-ai/claude-code
```

Then run Claude Code from the project root:

```bash
claude
```

Examples inside Claude Code:

```text
/create-news-video https://vnexpress.net/link-to-article
/create-news-video Tạo video kể chuyện hài hước ngắn 2 phút
/create-news-video https://manga-site.com/chapter-1
```

The final file will be saved as:

```text
output/<slug>/video.mp4
```

### 8. Create a video manually without Claude Code

Create a `script.json` file, then run:

```bash
npm run pipeline -- path/to/script.json
```

Minimal Story Mode example:

```json
{
  "version": "1.0",
  "metadata": {
    "title": "Con Muỗi Đi Họp",
    "source": { "url": "generated://story", "domain": "story", "image": "" },
    "mode": "news",
    "channel": "Nép si lon",
    "theme": "emerald"
  },
  "voice": {
    "provider": "lucylab",
    "voiceId": "${VIETNAMESE_VOICEID}",
    "speed": 0.95
  },
  "scenes": [
    {
      "id": "hook",
      "type": "hook",
      "voiceText": "Có một con muỗi tên Mít. Nó có một ước mơ rất nghiêm túc: trở thành trưởng phòng nhân sự.",
      "visual": { "videoKeyword": "macro insects nature" },
      "templateData": { "template": "hook", "headline": "Con Muỗi Đi Họp", "subhead": "Một chuyện rất lạ" }
    },
    {
      "id": "body-1",
      "type": "body",
      "voiceText": "Sáng thứ hai, Mít bay vào phòng họp lúc mọi người đang ngáp. Nó đậu lên màn hình máy chiếu, đúng chỗ chữ kế hoạch quý mới.",
      "visual": { "videoKeyword": "calm forest video" },
      "templateData": { "template": "callout", "statement": "Một con muỗi xuất hiện đúng lúc họp quý.", "tag": "Khởi đầu" }
    },
    {
      "id": "outro",
      "type": "outro",
      "voiceText": "Cảm ơn bạn đã theo dõi. Hãy theo dõi Nép si lon để xem các video thú vị nhé.",
      "visual": { "videoKeyword": "gentle clouds" },
      "templateData": { "template": "outro", "ctaTop": "Theo dõi ngay", "channelName": "Nép si lon", "source": "story" }
    }
  ]
}
```

Run it:

```bash
npm run pipeline -- output/my-story/script.json
```

### 9. Useful commands

```bash
npm run pipeline -- path/to/script.json       # Render News or Story video
npm run manga -- path/to/script.json          # Render Manga script
npm run rerender -- output/<slug>             # Rerender visuals from an existing output folder
npm run typecheck                             # TypeScript validation
npm test                                      # Run tests
npm run sfx:download                         # Download raw SFX into SFX/
npm run sfx:filter                           # Copy usable SFX into assets/sfx/
```

### 10. Common setup problems

| Problem | Fix |
| :--- | :--- |
| `node` is not recognized | Reopen terminal after installing Node.js, or reinstall Node.js 22+ |
| `ffmpeg` is not recognized | Reopen terminal after installing FFmpeg, or add FFmpeg to PATH |
| Missing `VIETNAMESE_API_KEY` | Copy `.env.example` to `.env.local` and fill LucyLab keys |
| Missing `ELEVENLABS_API_KEY` | Set `TTS_PROVIDER=lucylab` or fill ElevenLabs keys |
| Pexels fetch fails | Check `PEXELS_API_KEY` in `.env.local` |
| No SFX available | Use bundled `assets/sfx/` or run `npm run sfx:download` then `npm run sfx:filter` |
| JSON validation fails | Check scene text length limits and valid `theme`: `classic`, `gold`, `emerald`, `sunset`, `cyber` |

---

## 🛠️ Tech Stack

- **Engine**: [HyperFrames](https://hyperframes.heygen.com) (Puppeteer + GSAP + FFmpeg).
- **Language**: TypeScript 6 (ESM).
- **AI**: Claude 4.x (Orchestration + Manga OCR), Gemini 2.5 (Thumbnails).
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
