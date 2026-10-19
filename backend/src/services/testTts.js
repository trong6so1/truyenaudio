const fs = require('fs');
const path = require('path');
const config = require('../config');
const { synthesizeStorySegments } = require('./ttsService');

async function runTest() {
  const task2JsonPath = path.join(config.OUTPUTS_DIR, 'task-2-llm-analysis.json');
  const task2Data = JSON.parse(fs.readFileSync(task2JsonPath, 'utf-8'));

  const customVoiceMapping = {
    Narrator: 'vi-VN-NamMinhNeural',
    Minh: 'vi-VN-NamMinhNeural-Hero',
    'Ông lão': 'vi-VN-NamMinhNeural-Elder',
    Lan: 'vi-VN-HoaiMyNeural-Young'
  };

  console.log('Starting Task 3 Multi-Voice TTS synthesis for', task2Data.segments.length, 'segments...');
  const ttsResult = await synthesizeStorySegments(
    task2Data.segments,
    customVoiceMapping,
    'task3_sample_job'
  );

  const jsonOutputPath = path.join(config.OUTPUTS_DIR, 'task-3-tts-segments.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(ttsResult, null, 2), 'utf-8');

  const reportContent = `# Task 3 Output: Xây dựng Module TTS (Text-to-Speech Đa giọng đọc)

- **Thời gian hoàn thành:** ${new Date().toISOString()}
- **Job ID:** \`${ttsResult.jobId}\`
- **Thư mục chứa file audio phân đoạn:** \`${ttsResult.tempDir}\`
- **Tổng số file audio đã sinh:** ${ttsResult.totalSegments}

## 1. Bảng Mapping Nhân vật - Giọng đọc đã áp dụng
| Nhân vật | Mã Giọng Đọc (Voice ID) | Mô tả Giọng Đọc |
| :--- | :--- | :--- |
| **Narrator** | \`vi-VN-NamMinhNeural\` | Nam Minh (Nam - Trầm ấm, Dẫn truyện) |
| **Minh** | \`vi-VN-NamMinhNeural-Hero\` | Minh Khôi (Nam trẻ - Năng động, rate +8%, pitch +5Hz) |
| **Ông lão** | \`vi-VN-NamMinhNeural-Elder\` | Ông Lão (Nam trầm - Già dặn, rate -10%, pitch -8Hz) |
| **Lan** | \`vi-VN-HoaiMyNeural-Young\` | Linh Đan (Nữ trẻ - Trong trẻo, rate +10%, pitch +8Hz) |

## 2. Danh sách các file Audio nhỏ đã tạo
| STT | Nhân vật | Loại | Voice ID | File Audio | Kích thước (Bytes) | Provider |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${ttsResult.segments.map((s) => `| ${s.index} | **${s.character}** | \`${s.type}\` | \`${s.voiceId}\` | \`${s.fileName}\` | ${s.sizeBytes} | \`${s.provider}\` |`).join('\n')}
`;

  const reportOutputPath = path.join(config.OUTPUTS_DIR, 'task-3-report.md');
  fs.writeFileSync(reportOutputPath, reportContent, 'utf-8');

  console.log('Task 3 TTS Synthesis completed successfully!');
  console.log('Saved JSON to:', jsonOutputPath);
  console.log('Saved Report to:', reportOutputPath);
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
