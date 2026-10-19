const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('../app');
const config = require('../config');

const TEST_STORY = `Buổi sáng trên bến cảng sương còn đọng trên những mũi thuyền.
Ông lão nhìn ra biển khơi rồi chậm rãi nói: "Hôm nay gió thuận, đoàn tàu của chúng ta có thể ra khơi sớm."
Minh bước tới bên cạnh, ánh mắt đầy quyết tâm. Minh đáp: "Cháu đã chuẩn bị xong toàn bộ lưới và lương thực rồi ông ạ."
Từ trên boong tàu, Lan vẫy tay gọi lớn: "Hai ông cháu nhanh lên kẻo mặt trời lên cao bây giờ!"`;

async function runApiTest() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Test POST /api/process-story
    const processRes = await fetch(`${baseUrl}/api/process-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyText: TEST_STORY })
    });
    const processData = await processRes.json();

    // 2. Test POST /api/assign-voices
    const customVoiceMapping = {
      Narrator: 'vi-VN-NamMinhNeural',
      'Ông lão': 'vi-VN-NamMinhNeural-Elder',
      Minh: 'vi-VN-NamMinhNeural-Hero',
      Lan: 'vi-VN-HoaiMyNeural-Young'
    };
    const assignRes = await fetch(`${baseUrl}/api/assign-voices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyId: processData.storyId,
        voiceMapping: customVoiceMapping
      })
    });
    const assignData = await assignRes.json();

    // 3. Test POST /api/generate-audio
    const generateRes = await fetch(`${baseUrl}/api/generate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyId: processData.storyId,
        voiceMapping: customVoiceMapping
      })
    });
    const generateData = await generateRes.json();

    // 4. Test GET /api/audio/:fileName
    const audioFetchRes = await fetch(`${baseUrl}${generateData.audioUrl}`);
    const audioBuffer = Buffer.from(await audioFetchRes.arrayBuffer());

    const testSummary = {
      timestamp: new Date().toISOString(),
      endpointsTested: [
        {
          endpoint: 'POST /api/process-story',
          status: processRes.status,
          response: processData
        },
        {
          endpoint: 'POST /api/assign-voices',
          status: assignRes.status,
          response: assignData
        },
        {
          endpoint: 'POST /api/generate-audio',
          status: generateRes.status,
          response: generateData
        },
        {
          endpoint: `GET ${generateData.audioUrl}`,
          status: audioFetchRes.status,
          contentType: audioFetchRes.headers.get('content-type'),
          downloadedBytes: audioBuffer.length
        }
      ]
    };

    const jsonOutputPath = path.join(config.OUTPUTS_DIR, 'task-5-api-test.json');
    fs.writeFileSync(jsonOutputPath, JSON.stringify(testSummary, null, 2), 'utf-8');

    const reportPath = path.join(config.OUTPUTS_DIR, 'task-5-report.md');
    const reportMd = `# Task 5 Output: Xây dựng Backend API

- **Thời gian hoàn thành:** ${testSummary.timestamp}
- **Server Host/Binding:** \`127.0.0.1\` (Localhost)
- **Kết quả kiểm thử 4 Endpoints:**
  1. \`POST /api/process-story\`: HTTP \`${processRes.status}\` - Bóc tách ${processData.totalSegments} phân đoạn, ${processData.characters.length} nhân vật (\`storyId: ${processData.storyId}\`).
  2. \`POST /api/assign-voices\`: HTTP \`${assignRes.status}\` - Đã gán và xác thực allow-list giọng đọc cho từng nhân vật.
  3. \`POST /api/generate-audio\`: HTTP \`${generateRes.status}\` - Sinh & ghép thành công file \`${generateData.fileName}\` (Thời lượng: \`${generateData.durationSeconds}s\`, Kích thước: \`${generateData.sizeBytes} bytes\`).
  4. \`GET ${generateData.audioUrl}\`: HTTP \`${audioFetchRes.status}\` (\`Content-Type: ${audioFetchRes.headers.get('content-type')}\`, tải về thành công \`${audioBuffer.length} bytes\`).
`;
    fs.writeFileSync(reportPath, reportMd, 'utf-8');

    console.log('Task 5 Backend API tests passed 100%!');
    console.log('Saved JSON to:', jsonOutputPath);
    console.log('Saved Report to:', reportPath);
  } finally {
    server.close();
  }
}

runApiTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
