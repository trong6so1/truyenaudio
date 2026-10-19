# Truyện Audio AI Studio (Multi-Voice Story-to-Audio)

Hệ thống Fullstack chuyển đổi **Truyện chữ** thành **Truyện Audio đa giọng đọc**:
1. **Bóc tách tự động (LLM / NLP Tiếng Việt):** Phân tích lời dẫn truyện (`Narrator`) và lời thoại của từng nhân vật (`dialogue`).
2. **Đa giọng đọc (Multi-Voice TTS + DSP):** Gán mỗi nhân vật một giọng đọc riêng biệt (Nam trầm dẫn truyện, Nam trẻ, Ông lão, Nữ trẻ, Bà lão...).
3. **Ghép nối Audio (FFmpeg):** Tự động chèn khoảng nghỉ tự nhiên và nối các đoạn audio thành một file `.mp3` hoàn chỉnh.

## Cách khởi chạy

```bash
# Cài đặt dependencies
npm --prefix backend install

# Khởi chạy Web Server (http://127.0.0.1:3001)
npm --prefix backend start
```

## Danh sách File Output theo từng Task (`outputs/`)
- **Task 1:** `outputs/task-1-project-structure.md`
- **Task 2:** `outputs/task-2-llm-analysis.json` & `outputs/task-2-report.md`
- **Task 3:** `outputs/task-3-tts-segments.json` & `outputs/task-3-report.md`
- **Task 4:** `outputs/task-4-audio-merge.md` & `outputs/task-4-sample-merged.mp3`
- **Task 5:** `outputs/task-5-api-test.json` & `outputs/task-5-report.md`
- **Task 6:** `outputs/task-6-frontend.md`
- **Task 7:** `outputs/task-7-e2e-test.md`, `outputs/task-7-e2e-results.json` & `outputs/task-7-e2e-final-story.mp3`
