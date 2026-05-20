---
name: setup-environment
description: Check and set up the local environment after a fresh clone of this video generation project. Verifies Git, Node, npm, FFmpeg, env files, dependencies, assets, typecheck, and tests.
trigger-phrases:
  - "setup môi trường"
  - "check môi trường"
  - "cài môi trường"
  - "fresh clone setup"
  - "after clone setup"
  - "kiểm tra môi trường"
---

# Setup Environment Skill

Use this skill when the user wants to prepare a newly cloned copy of this project so it can generate videos.

## Mục tiêu

1. Check môi trường trước.
2. Báo thiếu gì bằng câu ngắn gọn.
3. Chạy các lệnh setup an toàn, theo thứ tự.
4. Không tự tạo hoặc đoán API key.
5. Không commit/push trừ khi user yêu cầu riêng.

## Quy tắc bắt buộc

- Trả lời bằng tiếng Việt nếu user dùng tiếng Việt.
- Luôn check trước khi cài/chạy setup.
- Không chạy lệnh cài hệ thống có tác động rộng như `winget install`, `brew install`, `sudo apt install` nếu chưa báo user. Nếu thiếu Git/Node/FFmpeg, hướng dẫn user chạy thủ công theo README.
- Có thể tự chạy lệnh local trong repo: `npm install`, copy `.env.example` sang `.env.local` nếu chưa tồn tại, `npm run sfx:filter`, `npm run typecheck`, `npm test`.
- Không overwrite `.env.local` nếu file đã tồn tại.
- Không in nội dung `.env.local` ra chat.
- Nếu thiếu API key, chỉ báo cần điền key vào `.env.local`; không chặn `npm install`, `typecheck`, `test`.
- Nếu user muốn render video ngay sau setup, dùng `/create-news-video` hoặc chạy pipeline theo yêu cầu riêng.

## Quy trình thực hiện

### Bước 1: Check system tools

Chạy các lệnh:

```powershell
git --version
node --version
npm --version
ffmpeg -version
```

Đánh giá:

- Git phải chạy được.
- Node phải là version 22 trở lên.
- npm phải chạy được.
- FFmpeg phải chạy được.

Nếu thiếu tool:

- Dừng setup ở phần phụ thuộc vào tool đó.
- Báo lệnh cài theo hệ điều hành:

Windows:

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Gyan.FFmpeg -e
```

macOS:

```bash
brew install git node ffmpeg
```

Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y git ffmpeg curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### Bước 2: Check project files

Check các file/folder bắt buộc:

- `package.json`
- `package-lock.json`
- `.env.example`
- `src/`
- `assets/`
- `assets/sfx/`
- `assets/bgm/`

Nếu thiếu `package.json` thì báo user đang không ở đúng thư mục repo.

### Bước 3: Install node modules

Nếu `node_modules/` chưa tồn tại hoặc user yêu cầu cài lại:

```powershell
npm install
```

Nếu `node_modules/` đã tồn tại, có thể bỏ qua và báo đã có.

### Bước 4: Prepare env file

Nếu `.env.local` chưa tồn tại và `.env.example` tồn tại:

```powershell
Copy-Item .env.example .env.local
```

Sau đó báo user cần điền key:

- `VIETNAMESE_API_KEY`
- `VIETNAMESE_VOICEID`
- `PEXELS_API_KEY`

Nếu dùng ElevenLabs thay LucyLab:

- `TTS_PROVIDER=elevenlabs`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`

Nếu `.env.local` đã tồn tại, không sửa và không đọc nội dung ra chat.

### Bước 5: Prepare assets

Check `assets/sfx/`. Nếu có file `.mp3` thì báo SFX mặc định đã có.

Nếu user muốn tải thêm SFX hoặc thư viện thiếu, chạy:

```powershell
npm run sfx:download
npm run sfx:filter
```

Không bắt buộc tải thêm nếu `assets/sfx/` đã có sẵn file.

### Bước 6: Validate project

Chạy:

```powershell
npm run typecheck
npm test
```

Nếu pass, báo môi trường code đã sẵn sàng.

### Bước 7: Final report

Kết thúc bằng checklist ngắn:

- Git: OK/thiếu
- Node/npm: OK/thiếu
- FFmpeg: OK/thiếu
- node_modules: OK/đã cài
- `.env.local`: OK/cần điền key
- SFX/BGM assets: OK/thiếu
- Typecheck: pass/fail
- Tests: pass/fail

Nếu mọi thứ pass nhưng `.env.local` chưa có key, nói rõ: code đã sẵn sàng, nhưng render video thật cần API keys.

## Lệnh mẫu nên chạy tự động khi đủ tool

```powershell
npm install
if (-not (Test-Path ".env.local") -and (Test-Path ".env.example")) { Copy-Item ".env.example" ".env.local" }
npm run typecheck
npm test
```

## Output ngắn gọn

Ví dụ:

```text
Setup xong: Node/npm/FFmpeg OK, node_modules đã cài, typecheck/test pass.
Bạn cần điền API keys trong .env.local trước khi render video thật.
```
