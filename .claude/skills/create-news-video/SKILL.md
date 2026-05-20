---
name: create-news-video
description: Tạo video tin tức 9:16, video manga, hoặc video kể chuyện nền thiên nhiên từ URL/file/nội dung tiếng Việt (không giới hạn thời lượng). Output: video.mp4.
trigger-phrases:
  - "tạo video tin tức"
  - "làm video so sánh"
  - "tạo video truyện tranh"
  - "làm video manga"
  - "render tin thành video"
  - "tạo video kể chuyện"
  - "làm video kể chuyện"
  - "story mode"
---

# Kỹ năng Tạo Video (News, Manga & Kể chuyện)

## QUY TẮC BẮT BUỘC

### ⚡ KHÔNG HỎI - THỰC HIỆN NGAY
- Task tạo video → thực hiện ngay, không hỏi
- Tự quyết định mọi bước
- Chỉ hỏi khi lỗi nghiêm trọng
- Nếu user nói "kể chuyện", "chuyện", "truyện", "story" → dùng Story Mode/Kể chuyện

### 💬 TRẢ LỜI NGẮN GỌN
- Tối đa 2-3 câu/response
- Chỉ báo kết quả + đường dẫn `video.mp4`

---

## QUY TRÌNH (3 BƯỚC)

### Bước 1: Thu thập nội dung
**News Mode**:
- **Text**: scrape URL bằng công cụ web đang khả dụng
  - Nếu kết quả rỗng → thử nguồn khác hoặc báo lỗi
- **Ảnh/Video**: Tự động từ Pexels (qua pipeline)
- Viết script tóm tắt (không giới hạn thời lượng)

**Manga Mode**:
- Scrape ảnh truyện
- OCR qua Claude Vision:
  - Dùng `Read` tool đọc từng ảnh manga trực tiếp
  - Claude tự nhận diện text tiếng Việt trong speech bubbles
  - Đọc: **phải qua trái, trên xuống dưới**
  - Không cần API key hay delay
- **Giữ nguyên nội dung text từ ảnh (OCR):** Tuyệt đối không tự ý sửa lỗi chính tả hay thay đổi nội dung text đã nhận diện được.

**Story Mode / Kể chuyện**:
- Input có thể là:
  - Nội dung truyện user cung cấp trực tiếp
  - File `.txt` / `.md` chứa truyện
  - Chủ đề để Claude tự sáng tác truyện
- Không scrape web nếu input không phải URL.
- Chia truyện thành các cảnh kể chậm, câu ngắn, giọng êm, giàu hình ảnh.
- **Bắt buộc dùng video nền xuyên suốt video, không dùng ảnh nền.**
- Video nền ưu tiên cảnh côn trùng, thiên nhiên, chill, rừng, suối, mưa nhẹ, mây, đồng cỏ, hoặc cảnh thư giãn tương tự.
- Nếu tự tạo truyện: ưu tiên truyện ngắn, cảm xúc, dễ nghe, không bạo lực nặng.

### Bước 2: Viết script.json
**Cấu trúc chuẩn:**
```json
{
  "version": "1.0",
  "metadata": {
    "title": "Tiêu đề video",
    "source": {
      "url": "https://example.com/source",
      "domain": "example.com",
      "image": "https://example.com/cover.jpg"
    },
    "mode": "news",
    "channel": "Tên kênh",
    "theme": "cyber"
  },
  "voice": {
    "provider": "lucylab",
    "voiceId": "vi-VN-Standard-A",
    "speed": 1.0
  },
  "scenes": [
    {
      "id": "hook",
      "type": "hook",
      "voiceText": "Text đọc (phonetic: 5.5 → năm chấm năm)",
      "visual": { "bgSrc": "images/bg.jpg" },
      "templateData": {
        "template": "hook",
        "headline": "Tiêu đề",
        "subhead": "Phụ đề"
      }
    },
    {
      "id": "body-1",
      "type": "body",
      "voiceText": "Nội dung chi tiết",
      "visual": {
        "videoKeyword": "technology office",
        "imageKeyword": "technology background"
      },
      "templateData": {
        "template": "stat-hero",
        "value": "5.5",
        "label": "nâng cấp lớn",
        "context": "Tóm tắt điểm chính"
      }
    },
    {
      "id": "outro",
      "type": "outro",
      "voiceText": "Cảm ơn bạn đã theo dõi. Hãy theo dõi Nép si lon để xem các video thú vị nhé.",
      "templateData": {
        "template": "outro",
        "ctaTop": "Theo dõi ngay",
        "channelName": "Tên kênh",
        "source": "example.com"
      }
    }
  ]
}
```

**Manga body scene mẫu:**
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

**Templates theo mode:**
- **News**: hook, comparison, stat-hero, feature-list, callout, kinetic-text, outro
- **Manga**: manga-panel (body), hook, outro
- **Story/Kể chuyện**: hook, callout, kinetic-text, feature-list, outro (không dùng template mang cảm giác bản tin nếu không cần)

**Giới hạn schema BẮT BUỘC để tránh lỗi render:**
- `hook.headline` tối đa 40 ký tự; `hook.subhead` tối đa 40 ký tự.
- `stat-hero.value` tối đa 20 ký tự; `label` tối đa 40; `context` tối đa 50.
- `feature-list.title` tối đa 40; mỗi bullet tối đa 50; tối đa 4 bullet.
- `callout.statement` tối đa 80; `tag` tối đa 20.
- `outro.ctaTop`, `channelName` tối đa 30; `source` tối đa 40.
- `comparison` phải dùng đúng dạng: `{ "template": "comparison", "left": { "label": "...", "value": "...", "color": "cyan" }, "right": { "label": "...", "value": "...", "color": "purple", "winner": true } }`.
- `kinetic-text` phải dùng `chunks`: `{ "template": "kinetic-text", "chunks": ["cụm 1", "cụm 2"], "highlightColor": "primary" }`; mỗi chunk tối đa 30 ký tự, tối đa 6 chunk.
- Khi ghi `script.json`, dùng UTF-8 không BOM nếu có thể; pipeline cũng đã tự bỏ BOM khi đọc JSON.

**Phụ đề:** pipeline ưu tiên SRT thật từ LucyLab, tự chia cue dài thành cụm ngắn để người xem đọc dần; không cần nhồi cả câu dài vào một lần hiển thị.

**Phonetic BẮT BUỘC**: `5.5` → `năm chấm năm`, `AI` → `ây ai`, `Nepsilon` → `Nép si lon`

**TTS Provider**: luôn luôn dùng `lucylab`.

**Thời lượng video**: Không giới hạn thời lượng cho tất cả mode. Tạo script đầy đủ nội dung.

**Story Mode / Kể chuyện - bắt buộc:**
- `metadata.mode` dùng `"news"` để tương thích pipeline hiện tại.
- `metadata.source.domain` đặt `"story"`; `metadata.source.url` đặt `"generated://story"` hoặc đường dẫn file nếu user đưa file.
- Mỗi scene phải có `visual.videoKeyword` bằng tiếng Anh, thuộc nhóm video nền thiên nhiên/chill/côn trùng/thư giãn.
- Không dùng `visual.imageKeyword` trong Story Mode.
- Bộ keyword gợi ý: `macro insects nature`, `butterfly flowers`, `calm forest video`, `misty mountains`, `peaceful river`, `soft rain nature`, `quiet meadow`, `sunset lake`, `gentle clouds`, `peaceful garden`, `morning forest mist`, `chill nature`.
- Với truyện dài, chia thành nhiều body scene theo nhịp kể; không giới hạn thời lượng.

### Bước 3: Chạy Pipeline
- **News**: `npm run pipeline -- path/to/script.json`
- **Story/Kể chuyện**: `npm run pipeline -- path/to/script.json`
- **Manga**: `npm run manga -- path/to/script.json`

---

## QUY TẮC HÌNH ẢNH & ÂM THANH

| Mode | Overlay | SFX | BGM |
|------|---------|-----|-----|
| Manga | Không | `sfx: { "name": "none" }` | Có (mặc định) |
| News | Làm tối nền | Mặc định tắt | Tùy chọn |
| Story/Kể chuyện | Làm tối nhẹ trên video nền | Mặc định tắt | Tùy chọn |

**Xử lý nhiễu video:**
- Kiểm tra video nguồn Pexels (chất lượng thấp → nhiễu)
- Kiểm tra FFmpeg `-crf` (20 = chất lượng cao, 28+ = nén nhiều)
- Nếu dùng overlay/blend → đảm bảo ảnh PNG có alpha channel đúng
- Test: xuất video không overlay để xác định nguồn nhiễu

---

## XỬ LÝ LỖI THƯỜNG GẶP

| Lỗi | Nguyên nhân | Giải pháp |
|-----|------------|-----------|
| EBUSY: resource busy | File bị lock | Đóng process đang dùng file rồi chạy lại pipeline |
| Fetch timeout | Nguồn treo/chậm | Thử lại với nguồn khác hoặc giảm tải |
| Fetch trả về rỗng | Trang bị chặn | Thử nguồn khác hoặc báo lỗi user |
| Ảnh cũ không update | Cache cũ | Xóa `images/` trước khi chạy lại |
| Tên thư mục sai | Typo | `Move-Item` / `Copy-Item` |
| Video nhiễu | Nguồn/FFmpeg | Kiểm tra Pexels video, giảm `-crf` xuống 18-20 |

---

## CHUẨN OUTPUT VIDEO

### News Mode
- **Tỷ lệ**: 9:16 (vertical)
- **Thời lượng**: Không giới hạn
- **Input**: URL tin tức → scrape text nội dung → Pexels assets
- **Output**: `output/<slug>/video.mp4`

### Manga Mode
- **Tỷ lệ**: 9:16 (vertical)
- **Thời lượng**: Không giới hạn (theo số trang truyện)
- **Input**: Ảnh truyện → OCR Claude Vision (giữ nguyên text) → template `manga-panel`
- **Output**: `output/<slug>/video.mp4`

### Story Mode / Kể chuyện
- **Tỷ lệ**: 9:16 (vertical)
- **Thời lượng**: Không giới hạn (theo nội dung truyện)
- **Input**: Nội dung truyện / file truyện / chủ đề để tự sáng tác
- **Visual**: Video nền xuyên suốt bằng Pexels `videoKeyword` tiếng Anh; ưu tiên côn trùng, thiên nhiên, chill, thư giãn; không dùng `imageKeyword`
- **Output**: `output/<slug>/video.mp4`

### Cả 3 mode đều bàn giao:
```
✅ Video: [video.mp4](đường_dẫn)
```

---

## KẾT QUẢ BÀN GIAO

```
✅ Video: [video.mp4](đường_dẫn)
```
