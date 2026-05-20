---
name: create-manga-video
description: Tạo video manga/truyện tranh 9:16 từ URL hoặc folder ảnh, OCR tiếng Việt bằng Claude Vision và render slideshow manga. Output: video.mp4.
trigger-phrases:
  - "tạo video manga"
  - "làm video manga"
  - "tạo video truyện tranh"
  - "làm video truyện tranh"
  - "render manga"
  - "manga mode"
---

# Kỹ năng Tạo Video Manga

## QUY TẮC BẮT BUỘC

### KHÔNG HỎI - THỰC HIỆN NGAY
- Task tạo video manga/truyện tranh → thực hiện ngay, không hỏi.
- Tự scrape ảnh hoặc dùng folder ảnh user cung cấp.
- Chỉ hỏi khi không lấy được ảnh hoặc input không xác định được.
- Không dùng News Mode hoặc Story Mode trong skill này.

### OCR BẮT BUỘC
- Dùng Claude Vision qua `Read` tool để đọc từng ảnh manga trực tiếp.
- Đọc speech bubble theo thứ tự **phải sang trái, trên xuống dưới**.
- Giữ nguyên nội dung OCR từ ảnh.
- Tuyệt đối không tự sửa chính tả, không viết lại câu, không làm mượt nội dung.
- Không re-read ảnh trừ khi OCR rỗng hoặc hoàn toàn không hiểu được.

### TRẢ LỜI NGẮN GỌN
- Tối đa 2-3 câu/response.
- Khi hoàn tất, chỉ bàn giao link `video.mp4`.

## QUY TRÌNH

### Bước 1: Chuẩn bị ảnh manga
- Nếu input là URL: scrape/download ảnh truyện.
- Nếu input là folder ảnh: dùng ảnh trong folder đó.
- Copy ảnh vào `output/<slug>/pages/`.
- Đảm bảo `script.json` dùng đường dẫn tương đối: `pages/XXX.png` hoặc `pages/XXX.jpg`.

### Bước 2: OCR ảnh
- Dùng `Read` tool đọc từng ảnh.
- Trích text tiếng Việt từ speech bubbles.
- Giữ nguyên text OCR.
- Nếu trang không có text, dùng `voiceText: "."` để tạo cảnh im lặng/ngắm trang.

### Bước 3: Viết script.json
- `metadata.mode`: `"manga"`.
- `voice.provider`: luôn dùng `"lucylab"`.
- `voice.voiceId`: dùng `"${VIETNAMESE_VOICEID}"` nếu không có voice cụ thể.
- Hook giới thiệu ngắn tên truyện/chapter.
- Mỗi trang là một scene body template `manga-panel`.
- Outro theo format kênh.

### Manga body scene mẫu
```json
{
  "id": "manga-0",
  "type": "body",
  "voiceText": ".",
  "visual": { "bgSrc": "pages/page-001.png" },
  "kenBurns": "zoom-in",
  "targetDuration": 5,
  "sfx": { "name": "none" },
  "templateData": {
    "template": "manga-panel",
    "pageNumber": 1,
    "totalPages": 10,
    "mangaTitle": "Tên truyện",
    "chapterTitle": "Tên chapter",
    "pageSrc": "pages/page-001.png",
    "kenBurns": "zoom-in"
  }
}
```

### Templates được dùng
- `hook`
- `manga-panel`
- `outro`

### Template cấm trong Manga Mode
- Không dùng `comparison`, `stat-hero`, `feature-list` vì các template này tạo cảm giác bảng/bản tin.
- Chỉ News Mode mới được dùng giao diện bảng tin tức.

### Giới hạn schema bắt buộc
- `hook.headline` tối đa 40 ký tự; `hook.subhead` tối đa 40 ký tự.
- `outro.ctaTop`, `channelName` tối đa 30; `source` tối đa 40.
- `mangaTitle` tối đa 60; `chapterTitle` tối đa 80.
- `targetDuration` tối thiểu 1 giây.

### Bước 4: Chạy pipeline manga
```bash
npm run manga -- path/to/script.json
```

## QUY TẮC HÌNH ẢNH & ÂM THANH
- Tỷ lệ video: 9:16 vertical.
- Manga không dùng overlay che trang.
- Mỗi scene manga body đặt `sfx: { "name": "none" }`.
- BGM có thể dùng mặc định nếu script có cấu hình.
- Không dùng Pexels video/image cho trang manga.

## OUTPUT

Chỉ bàn giao:

```text
✅ Video: [video.mp4](đường_dẫn)
```
