const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const app = require('../app');
const config = require('../config');

const E2E_STORY = `Chiều thu vàng rực trên con phố cổ Hà Nội, tiếng lá sấu rơi xào xạc bên hiên quán cà phê nhỏ.
Minh đặt tách cà phê xuống bàn, nhìn người bạn đối diện. Minh hỏi: "Cậu thực sự định tuần sau sẽ lên vùng cao dạy học sao?"
Lan khẽ gật đầu, đôi mắt trong trẻo ánh lên niềm vui. Lan mỉm cười nói: "Ừ, mình đã chuẩn bị sách vở cho các em nhỏ trên đó suốt hai tháng nay rồi."
Từ bàn bên cạnh, Ông lão bán báo ngẩng lên nhìn hai người trẻ tuổi. Ông lão trầm giọng bảo: "Tuổi trẻ mà có tấm lòng như cô chú đây thật đáng quý lắm!"`;

async function runE2ETests() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const testResults = [];

  try {
    // TC-01: Frontend Static & Security Headers
    const homeRes = await fetch(`${baseUrl}/`);
    const homeHtml = await homeRes.text();
    const cspHeader = homeRes.headers.get('content-security-policy');
    const nosniffHeader = homeRes.headers.get('x-content-type-options');
    assert.strictEqual(homeRes.status, 200, 'TC-01: GET / should return 200');
    assert.ok(homeHtml.includes('story-textarea'), 'TC-01: HTML should contain story-textarea');
    assert.ok(cspHeader && cspHeader.includes("default-src 'self'"), 'TC-01: CSP header must be set');
    assert.strictEqual(nosniffHeader, 'nosniff', 'TC-01: X-Content-Type-Options must be nosniff');
    testResults.push({
      id: 'TC-01',
      name: 'Frontend Static Assets & Security Headers',
      status: 'PASSED',
      details: { httpStatus: homeRes.status, nosniffHeader, cspHeader }
    });

    // TC-02: Error Handling - Empty Story Input
    const emptyRes = await fetch(`${baseUrl}/api/process-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyText: '   ' })
    });
    const emptyData = await emptyRes.json();
    assert.strictEqual(emptyRes.status, 400, 'TC-02: Empty story should return 400');
    testResults.push({
      id: 'TC-02',
      name: 'Validation & Error Handling - Input rỗng',
      status: 'PASSED',
      details: { httpStatus: emptyRes.status, error: emptyData.error }
    });

    // TC-03: Error Handling - Invalid storyId on assign-voices
    const invalidStoryRes = await fetch(`${baseUrl}/api/assign-voices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: 'story_nonexistent_999', voiceMapping: {} })
    });
    const invalidStoryData = await invalidStoryRes.json();
    assert.strictEqual(invalidStoryRes.status, 404, 'TC-03: Unknown storyId should return 404');
    testResults.push({
      id: 'TC-03',
      name: 'Validation & Error Handling - StoryId không tồn tại',
      status: 'PASSED',
      details: { httpStatus: invalidStoryRes.status, error: invalidStoryData.error }
    });

    // TC-04: Security - Path Traversal & Extension Validation on Audio Download
    const traversalRes = await fetch(`${baseUrl}/api/audio/..%2F..%2Fpackage.json`);
    assert.ok([400, 404].includes(traversalRes.status), 'TC-04: Path traversal must be rejected');
    testResults.push({
      id: 'TC-04',
      name: 'Security - Chống Path Traversal khi tải file Audio',
      status: 'PASSED',
      details: { httpStatus: traversalRes.status }
    });

    // TC-05: Full End-to-End Story-to-Audio Pipeline
    const procRes = await fetch(`${baseUrl}/api/process-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyText: E2E_STORY })
    });
    const procData = await procRes.json();
    assert.strictEqual(procRes.status, 200);
    assert.ok(procData.characters.length >= 4, 'Should extract Narrator, Minh, Lan, Ông lão');

    const assignRes = await fetch(`${baseUrl}/api/assign-voices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyId: procData.storyId,
        voiceMapping: {
          Narrator: 'vi-VN-NamMinhNeural',
          Minh: 'vi-VN-NamMinhNeural-Hero',
          Lan: 'vi-VN-HoaiMyNeural-Young',
          'Ông lão': 'vi-VN-NamMinhNeural-Elder'
        }
      })
    });
    const assignData = await assignRes.json();
    assert.strictEqual(assignRes.status, 200);

    const genRes = await fetch(`${baseUrl}/api/generate-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storyId: procData.storyId,
        voiceMapping: assignData.voiceMapping
      })
    });
    const genData = await genRes.json();
    assert.strictEqual(genRes.status, 200);
    assert.ok(genData.durationSeconds > 10, 'Generated audio duration should be > 10s');

    const dlRes = await fetch(`${baseUrl}${genData.downloadUrl}`);
    const dlBuf = Buffer.from(await dlRes.arrayBuffer());
    assert.strictEqual(dlRes.status, 200);
    assert.ok(
      (dlRes.headers.get('content-disposition') || '').includes('attachment'),
      'Download endpoint should include Content-Disposition: attachment'
    );
    assert.ok(dlBuf.length > 100000, 'Downloaded MP3 should be > 100KB');

    const finalOutputMp3 = path.join(config.OUTPUTS_DIR, 'task-7-e2e-final-story.mp3');
    fs.writeFileSync(finalOutputMp3, dlBuf);

    testResults.push({
      id: 'TC-05',
      name: 'Full E2E Pipeline (Process -> Assign Voices -> TTS -> FFmpeg Merge -> Download MP3)',
      status: 'PASSED',
      details: {
        storyId: procData.storyId,
        extractedCharacters: procData.characters.map((c) => c.name),
        totalSegments: genData.totalSegmentsMerged,
        durationSeconds: genData.durationSeconds,
        sizeBytes: dlBuf.length,
        savedSampleFile: finalOutputMp3
      }
    });

    const summaryObj = {
      completedAt: new Date().toISOString(),
      totalTests: testResults.length,
      passedTests: testResults.filter((t) => t.status === 'PASSED').length,
      testResults
    };

    const jsonPath = path.join(config.OUTPUTS_DIR, 'task-7-e2e-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(summaryObj, null, 2), 'utf-8');

    const mdPath = path.join(config.OUTPUTS_DIR, 'task-7-e2e-test.md');
    const mdContent = `# Task 7 Output: Tích hợp, Kiểm thử E2E và Hoàn thiện (Project Complete)

- **Thời gian hoàn thành:** ${summaryObj.completedAt}
- **Tổng số Test Cases:** ${summaryObj.totalTests}
- **Số Test Cases đạt (PASSED):** ${summaryObj.passedTests}/${summaryObj.totalTests} (100%)
- **File Audio E2E hoàn chỉnh:** \`outputs/task-7-e2e-final-story.mp3\` (\`${genData.durationSeconds} giây\`, \`${dlBuf.length} bytes\`)

## Bảng Kết Quả Kiểm Thử Chi Tiết
| Mã TC | Tên Test Case | Trạng Thái | Chi Tiết |
| :--- | :--- | :--- | :--- |
${testResults.map((t) => `| **${t.id}** | ${t.name} | ✅ **${t.status}** | \`${JSON.stringify(t.details)}\` |`).join('\n')}

## Tổng hợp toàn bộ File Output của 7 Task trong \`outputs/\`
1. \`outputs/task-1-project-structure.md\` — Cấu trúc dự án & Tech Stack.
2. \`outputs/task-2-llm-analysis.json\` & \`outputs/task-2-report.md\` — Kết quả bóc tách hội thoại & nhân vật.
3. \`outputs/task-3-tts-segments.json\` & \`outputs/task-3-report.md\` — Kết quả sinh 12 đoạn giọng đọc đa nhân vật.
4. \`outputs/task-4-audio-merge.md\` & \`outputs/task-4-sample-merged.mp3\` — Kết quả ghép nối FFmpeg.
5. \`outputs/task-5-api-test.json\` & \`outputs/task-5-report.md\` — Kết quả kiểm thử các REST API endpoints.
6. \`outputs/task-6-frontend.md\` — Báo cáo giao diện người dùng 3 khu vực.
7. \`outputs/task-7-e2e-test.md\`, \`outputs/task-7-e2e-results.json\` & \`outputs/task-7-e2e-final-story.mp3\` — Kết quả kiểm thử E2E toàn trình.
`;
    fs.writeFileSync(mdPath, mdContent, 'utf-8');

    console.log('All Task 7 E2E Tests PASSED!');
    console.log('Saved Report to:', mdPath);
  } finally {
    server.close();
  }
}

runE2ETests().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
