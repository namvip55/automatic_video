---
name: create-news-video
description: Tạo video tin tức 9:16 từ URL hoặc file/nội dung tin tức tiếng Việt. Output: video.mp4.
trigger-phrases:
  - "tạo video tin tức"
  - "làm video tin tức"
  - "render tin thành video"
  - "tạo video từ url"
  - "làm video so sánh"
---

# Kỹ năng Tạo Video Tin Tức

## QUY TẮC BẮT BUỘC

### KHÔNG HỎI - THỰC HIỆN NGAY
- Task tạo video tin tức → thực hiện ngay, không hỏi.
- Tự quyết định bố cục, template, keyword ảnh/video.
- Chỉ hỏi khi thiếu input nghiêm trọng hoặc URL/file không đọc được.
- Không dùng Manga Mode hoặc Story Mode trong skill này.

### TRẢ LỜI NGẮN GỌN
- Tối đa 2-3 câu/response.
- Khi hoàn tất, chỉ bàn giao link `video.mp4`.

## QUY TRÌNH

### Bước 1: Thu thập nội dung
- Nếu input là URL: scrape nội dung bằng công cụ web khả dụng.
- Nếu input là file `.txt`, `.md`, `.json`: đọc file và trích nội dung chính.
- Nếu input là text trực tiếp: dùng text đó làm nguồn.
- Nếu scrape rỗng hoặc bị chặn: thử nguồn khác nếu có, nếu không thì báo lỗi ngắn.
- Viết nội dung tiếng Việt rõ, ngắn câu, phù hợp giọng đọc.
- Không giới hạn thời lượng video; tạo đủ nội dung theo nguồn.

### Bước 2: Viết script.json
- `metadata.mode`: `"news"`.
- `metadata.source.domain`: domain nguồn hoặc `"local"` nếu là file/text.
- `metadata.source.url`: URL nguồn hoặc đường dẫn file.
- `voice.provider`: luôn dùng `"lucylab"`.
- `voice.voiceId`: dùng `"${VIETNAMESE_VOICEID}"` nếu không có voice cụ thể.
- Dùng Pexels asset qua `visual.videoKeyword` và/hoặc `visual.imageKeyword` bằng tiếng Anh.
- Ưu tiên `videoKeyword` cho cảnh body để video có chuyển động.

### Templates được dùng
- `hook`
- `comparison`
- `stat-hero`
- `feature-list`
- `callout`
- `kinetic-text`
- `outro`

### Giới hạn schema bắt buộc
- `hook.headline` tối đa 40 ký tự; `hook.subhead` tối đa 40 ký tự.
- `stat-hero.value` tối đa 20 ký tự; `label` tối đa 40; `context` tối đa 50.
- `feature-list.title` tối đa 40; mỗi bullet tối đa 50; tối đa 4 bullet.
- `callout.statement` tối đa 80; `tag` tối đa 20.
- `outro.ctaTop`, `channelName` tối đa 30; `source` tối đa 40.
- `comparison` phải đúng dạng:
  `{ "template": "comparison", "left": { "label": "...", "value": "...", "color": "cyan" }, "right": { "label": "...", "value": "...", "color": "purple", "winner": true } }`.
- `kinetic-text` phải dùng `chunks`; mỗi chunk tối đa 30 ký tự, tối đa 6 chunk.

### Phonetic bắt buộc
- `5.5` → `năm chấm năm`
- `AI` → `ây ai`
- `Nepsilon` → `Nép si lon`

### Bước 3: Chạy pipeline
```bash
npm run pipeline -- path/to/script.json
```

## QUY TẮC HÌNH ẢNH & ÂM THANH
- Tỷ lệ video: 9:16 vertical.
- News dùng overlay làm tối nền.
- SFX mặc định tắt nếu không cần nhấn mạnh.
- BGM tùy chọn.
- Nếu video Pexels bị nhiễu/chất lượng thấp: đổi keyword hoặc giảm CRF trong xử lý render nếu cần.

## OUTPUT

Chỉ bàn giao:

```text
✅ Video: [video.mp4](đường_dẫn)
```
