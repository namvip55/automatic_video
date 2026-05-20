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

- Slash command Claude Code riêng cho từng mode: `/create-news-video`, `/create-story-video`, `/create-manga-video`.
- Skill setup môi trường: `/setup-environment`
- Story Mode dùng video nền động: đông người tấp nập/xô bồ, thể thao, thiên nhiên hùng vĩ; không dùng ảnh tĩnh.
- Manga OCR bằng Claude Vision, đọc phải sang trái, trên xuống dưới.
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

Dùng LucyLab mặc định:

```env
TTS_PROVIDER=lucylab
VIETNAMESE_API_KEY=your_lucylab_api_key
VIETNAMESE_VOICEID=your_lucylab_voice_id
PEXELS_API_KEY=your_pexels_api_key
```

Hoặc dùng ElevenLabs:

```env
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
PEXELS_API_KEY=your_pexels_api_key
```

### Check project

```bash
npm run typecheck
npm test
```

Nếu cả hai lệnh pass, project đã sẵn sàng render video.

### Setup bằng Claude Code

Nếu dùng Claude Code, có thể để project tự check và setup:

```bash
npm install -g @anthropic-ai/claude-code
claude
```

Trong Claude Code, chạy:

```text
/setup-environment
```

Skill này sẽ check Git, Node, npm, FFmpeg, tạo `.env.local` nếu thiếu, chạy `npm install`, kiểm tra assets, typecheck và test.

---

## 🎥 Tạo video

### Cách nhanh bằng Claude Code

```text
/create-news-video https://vnexpress.net/link-tin-tuc
/create-story-video Tạo video kể chuyện hài hước ngắn 2 phút
/create-manga-video https://manga-site.com/chapter-1
```

Kết quả nằm tại:

```text
output/<slug>/video.mp4
```

### Cách chạy thủ công

Tạo một file `script.json`, sau đó chạy:

```bash
npm run pipeline -- path/to/script.json
```

Với manga:

```bash
npm run manga -- path/to/script.json
```

---

## 🧰 Lệnh hữu ích

```bash
npm run pipeline -- path/to/script.json       # Render News hoặc Story video
npm run manga -- path/to/script.json          # Render Manga video
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
| Thiếu `VIETNAMESE_API_KEY` | Điền LucyLab key trong `.env.local` |
| Thiếu `PEXELS_API_KEY` | Điền Pexels key trong `.env.local` |
| Không có SFX | Repo có sẵn SFX mẫu; muốn thêm thì chạy `npm run sfx:download` và `npm run sfx:filter` |
| JSON validation fails | Kiểm tra template data, text length và theme hợp lệ |

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
