const fs = require('fs');
const path = require('path');
const config = require('../config');
const { mergeAudioSegments } = require('./audioProcessor');

async function runTest() {
  const task3JsonPath = path.join(config.OUTPUTS_DIR, 'task-3-tts-segments.json');
  const task3Data = JSON.parse(fs.readFileSync(task3JsonPath, 'utf-8'));

  console.log('Merging', task3Data.segments.length, 'audio segments with FFmpeg...');
  const mergeResult = await mergeAudioSegments(task3Data.segments, task3Data.jobId);

  // Copy merged audio to outputs/ for verification
  const outputSampleAudioPath = path.join(config.OUTPUTS_DIR, 'task-4-sample-merged.mp3');
  fs.copyFileSync(mergeResult.mergedFilePath, outputSampleAudioPath);

  const reportContent = `# Task 4 Output: Xây dựng Module Audio Processing (Ghép Audio)

- **Thời gian hoàn thành:** ${new Date().toISOString()}
- **Job ID:** \`${mergeResult.jobId}\`
- **Số phân đoạn đã ghép:** ${mergeResult.totalSegmentsMerged} phân đoạn (kèm khoảng nghỉ tự nhiên \`0.35s\` giữa các đoạn)
- **File Audio hoàn chỉnh (Storage):** \`${mergeResult.mergedFilePath}\`
- **File Audio mẫu lưu tại Outputs:** \`${outputSampleAudioPath}\`
- **URL phục vụ qua API:** \`${mergeResult.audioUrl}\`
- **Tổng thời lượng (Duration):** \`${mergeResult.durationSeconds} giây\`
- **Kích thước file (Size):** \`${mergeResult.sizeBytes} bytes\` (~${(mergeResult.sizeBytes / 1024).toFixed(1)} KB)

## JSON Metadata Output
\`\`\`json
${JSON.stringify(mergeResult, null, 2)}
\`\`\`
`;

  const reportOutputPath = path.join(config.OUTPUTS_DIR, 'task-4-audio-merge.md');
  fs.writeFileSync(reportOutputPath, reportContent, 'utf-8');

  console.log('Task 4 Audio Merge completed successfully!');
  console.log('Merged Audio saved to:', outputSampleAudioPath);
  console.log('Report saved to:', reportOutputPath);
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
