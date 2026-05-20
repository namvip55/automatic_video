---
name: create-story-video
description: Tạo video kể chuyện/story 9:16 từ chủ đề, nội dung hoặc file tiếng Việt, dùng video nền đông người tấp nập/xô bồ, thể thao, và thiên nhiên hùng vĩ. Output: video.mp4.
trigger-phrases:
  - "tạo video kể chuyện"
  - "làm video kể chuyện"
  - "tạo video truyện"
  - "làm video truyện"
  - "story mode"
  - "kể chuyện"
---

# Kỹ năng Tạo Video Kể Chuyện

## QUY TẮC BẮT BUỘC

### KHÔNG HỎI - THỰC HIỆN NGAY
- Task tạo video kể chuyện/story → thực hiện ngay, không hỏi.
- Nếu user chỉ đưa chủ đề, tự sáng tác truyện phù hợp.
- Nếu user đưa nội dung/file, dùng nội dung đó.
- Không scrape web nếu input không phải URL.
- Không dùng News Mode hoặc Manga Mode trong skill này.

### VIDEO NỀN BẮT BUỘC
- Story Mode luôn dùng **video nền**, không dùng ảnh nền.
- Mỗi scene phải có `visual.videoKeyword` bằng tiếng Anh.
- Không dùng `visual.imageKeyword` trong Story Mode.
- Video nền ưu tiên 3 nhóm: cảnh đông người tấp nập/xô bồ, thể thao/năng lượng, và thiên nhiên hùng vĩ.

### TRẢ LỜI NGẮN GỌN
- Tối đa 2-3 câu/response.
- Khi hoàn tất, chỉ bàn giao link `video.mp4`.

## QUY TRÌNH

### Bước 1: Chuẩn bị nội dung truyện
Input có thể là:

- Chủ đề để tự sáng tác truyện.
- Nội dung truyện user cung cấp trực tiếp.
- File `.txt` hoặc `.md` chứa truyện.

Cách viết:

- Truyện tiếng Việt, câu ngắn, dễ nghe.
- Giọng kể chậm, êm, giàu hình ảnh.
- Nếu tự sáng tác: ưu tiên truyện ngắn, hài hước/cảm xúc/dễ nghe, không bạo lực nặng.
- Chia thành nhiều scene body theo nhịp kể.
- Không giới hạn thời lượng, nhưng nếu user yêu cầu thời lượng cụ thể thì ước lượng số scene và độ dài voiceText tương ứng.

### Bước 2: Viết script.json
- `metadata.mode`: dùng `"news"` để tương thích pipeline hiện tại.
- `metadata.source.domain`: `"story"`.
- `metadata.source.url`: `"generated://story"` hoặc đường dẫn file nếu user đưa file.
- `voice.provider`: luôn dùng `"lucylab"`.
- `voice.voiceId`: dùng `"${VIETNAMESE_VOICEID}"` nếu không có voice cụ thể.
- Mỗi scene có `visual.videoKeyword`.
- Không scene nào dùng `visual.imageKeyword`.

### Bộ videoKeyword gợi ý

Đông người tấp nập/xô bồ:
- `crowded city street`
- `busy street crowd`
- `people walking downtown`
- `urban crowd rush hour`

Thể thao:
- `basketball game`
- `soccer match`
- `runner training`
- `extreme sports`

Thiên nhiên hùng vĩ:
- `majestic mountains`
- `dramatic ocean waves`
- `epic waterfall`
- `aerial nature landscape`

### Templates được dùng
- `hook`
- `callout`
- `kinetic-text`
- `outro`

### Template cấm trong Story Mode
- Không dùng `comparison`, `stat-hero`, `feature-list` vì các template này tạo cảm giác bảng/bản tin.
- Chỉ News Mode mới được dùng giao diện bảng tin tức.

### Giới hạn schema bắt buộc
- `hook.headline` tối đa 40 ký tự; `hook.subhead` tối đa 40 ký tự.
- `feature-list.title` tối đa 40; mỗi bullet tối đa 50; tối đa 4 bullet.
- `callout.statement` tối đa 80; `tag` tối đa 20.
- `outro.ctaTop`, `channelName` tối đa 30; `source` tối đa 40.
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
- Story dùng overlay làm tối nhẹ trên video nền.
- SFX mặc định tắt nếu không cần nhấn mạnh.
- BGM tùy chọn.
- Nếu video Pexels bị nhiễu/chất lượng thấp: đổi keyword sang nhóm đông người tấp nập/xô bồ, thể thao hoặc thiên nhiên hùng vĩ khác.

## OUTPUT

Chỉ bàn giao:

```text
✅ Video: [video.mp4](đường_dẫn)
```
