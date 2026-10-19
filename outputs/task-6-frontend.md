# Task 6 Output: Xây dựng Frontend (Giao diện người dùng)

- **Thời gian hoàn thành:** 2026-10-19T08:52:10Z
- **Trạng thái:** Hoàn thành (Completed)
- **Các file Frontend đã tạo:**
  - `frontend/index.html` (Cấu trúc 3 khu vực: Nhập truyện chữ, Phân vai & Chọn giọng đọc, Trình phát Audio & Download)
  - `frontend/css/style.css` (Giao diện Dark Studio responsive, trực quan)
  - `frontend/js/app.js` (Xử lý tương tác API `/api/process-story`, `/api/assign-voices`, `/api/generate-audio`, tuân thủ an toàn chống XSS không dùng `innerHTML`/`alert`)

## Kiến trúc 3 khu vực giao diện
1. **Khu vực 1 - Nhập Truyện Chữ:**
   - `<textarea id="story-textarea">` hỗ trợ dán truyện dài đến 50.000 ký tự.
   - Nút `Tải truyện mẫu` (`#btn-load-sample`) và tải file `.txt` (`#file-upload`).
   - Nút `Phân tích Nhân vật & Hội thoại` (`#btn-process-story`).
2. **Khu vực 2 - Phân Vai & Gán Giọng Đọc:**
   - Danh sách nhân vật trích xuất tự động (`#characters-container`), mỗi nhân vật đi kèm `<select class="voice-select">` chọn giọng đọc trong 6 preset tiếng Việt.
   - Khung xem trước kịch bản phân đoạn (`#segments-preview`) phân biệt màu sắc giữa lời dẫn truyện (`narration`) và lời thoại (`dialogue`).
   - Nút `Lưu cấu hình giọng đọc` (`#btn-assign-voices`) và `Tạo & Ghép Truyện Audio (MP3)` (`#btn-generate-audio`).
3. **Khu vực 3 - Trình Phát Nhạc & Download:**
   - Banner hiển thị trạng thái xử lý realtime (`#status-banner`).
   - Trình phát `<audio id="story-audio-player" controls>` và nút tải về `<a id="btn-download-audio" download>`.
   - Thẻ thống kê metadata (`#audio-meta-info`): Mã phiên xử lý, Tổng thời lượng, Số đoạn đã ghép, Kích thước file MP3.
