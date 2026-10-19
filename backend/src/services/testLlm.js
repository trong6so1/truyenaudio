const fs = require('fs');
const path = require('path');
const { analyzeStoryText } = require('./llmService');
const config = require('../config');

const SAMPLE_STORY = `Đêm mùa đông trên đỉnh đèo Bảo Lộc sương mù giăng kín lối. Trong căn quán gỗ nhỏ bên đường, ngọn đèn dầu leo lét chiếu sáng gương mặt trầm tư của ông lão chủ quán.
Cánh cửa gỗ chợt kẹt mở, một chàng trai trẻ khoác áo choàng ướt đẫm bước vào. Minh khẽ nói: "Cháu chào ông, ngoài trời lạnh quá, cho cháu xin một chén trà nóng được không ạ?"
Ông lão ngẩng đầu nhìn chàng trai, đôi mắt ánh lên vẻ hiền từ. Ông lão mỉm cười đáp: "Vào đi cháu, ngồi xuống bên bếp lửa cho ấm người đã."
Từ phía sau tấm rèm vải, một cô gái trẻ bưng khay trà bước ra. Lan nhẹ nhàng hỏi: "Anh đi đâu mà đêm hôm khuya khoắt lại một mình vượt đèo thế này?"
Minh đón lấy chén trà nóng, hơi ấm lan tỏa qua từng đầu ngón tay.
- Cảm ơn cô, tôi đang trên đường tìm lại cuốn nhật ký cũ của cha tôi để lại trên vùng núi này. - Minh trả lời.
Ông lão thoáng giật mình, bàn tay đang châm trà khẽ run lên. Ông lão thở dài nói: "Thì ra cháu chính là con trai của người lính năm xưa..."`;

async function runTest() {
  const result = await analyzeStoryText(SAMPLE_STORY);

  const jsonOutputPath = path.join(config.OUTPUTS_DIR, 'task-2-llm-analysis.json');
  fs.writeFileSync(jsonOutputPath, JSON.stringify(result, null, 2), 'utf-8');

  const reportContent = `# Task 2 Output: Xây dựng Module LLM (Text Analysis)

- **Thời gian hoàn thành:** ${new Date().toISOString()}
- **Engine phân tích:** \`${result.providerUsed}\`
- **Tổng số phân đoạn bóc tách:** ${result.totalSegments}
- **Danh sách nhân vật nhận diện được (${result.characters.length}):**
${result.characters.map((c) => `  - **${c.displayName}** (\`${c.name}\`): ${c.segmentCount} phân đoạn (${c.type})`).join('\n')}

## Dữ liệu JSON Output (\`outputs/task-2-llm-analysis.json\`)
\`\`\`json
${JSON.stringify(result.segments, null, 2)}
\`\`\`
`;

  const reportOutputPath = path.join(config.OUTPUTS_DIR, 'task-2-report.md');
  fs.writeFileSync(reportOutputPath, reportContent, 'utf-8');

  console.log('Task 2 LLM Analysis completed successfully!');
  console.log('Saved JSON to:', jsonOutputPath);
  console.log('Saved Report to:', reportOutputPath);
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
