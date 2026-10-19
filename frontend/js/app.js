(function () {
  const SAMPLE_STORY = [
    'Đêm mùa đông trên đỉnh đèo Bảo Lộc sương mù giăng kín lối. Trong căn quán gỗ nhỏ bên đường, ngọn đèn dầu leo lét chiếu sáng gương mặt trầm tư của ông lão chủ quán.',
    'Cánh cửa gỗ chợt kẹt mở, một chàng trai trẻ khoác áo choàng ướt đẫm bước vào. Minh khẽ nói: "Cháu chào ông, ngoài trời lạnh quá, cho cháu xin một chén trà nóng được không ạ?"',
    'Ông lão ngẩng đầu nhìn chàng trai, đôi mắt ánh lên vẻ hiền từ. Ông lão mỉm cười đáp: "Vào đi cháu, ngồi xuống bên bếp lửa cho ấm người đã."',
    'Từ phía sau tấm rèm vải, một cô gái trẻ bưng khay trà bước ra. Lan nhẹ nhàng hỏi: "Anh đi đâu mà đêm hôm khuya khoắt lại một mình vượt đèo thế này?"',
    'Minh đón lấy chén trà nóng, hơi ấm lan tỏa qua từng đầu ngón tay.',
    '- Cảm ơn cô, tôi đang trên đường tìm lại cuốn nhật ký cũ của cha tôi để lại trên vùng núi này. - Minh trả lời.',
    'Ông lão thoáng giật mình, bàn tay đang châm trà khẽ run lên. Ông lão thở dài nói: "Thì ra cháu chính là con trai của người lính năm xưa..."'
  ].join('\n');

  const storyTextarea = document.getElementById('story-textarea');
  const charCounter = document.getElementById('char-counter');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const fileUpload = document.getElementById('file-upload');
  const btnProcessStory = document.getElementById('btn-process-story');
  const btnAssignVoices = document.getElementById('btn-assign-voices');
  const btnGenerateAudio = document.getElementById('btn-generate-audio');

  const segmentSummaryBadge = document.getElementById('segment-summary-badge');
  const charactersContainer = document.getElementById('characters-container');
  const segmentsPreview = document.getElementById('segments-preview');

  const audioStatusBadge = document.getElementById('audio-status-badge');
  const statusBanner = document.getElementById('status-banner');
  const playerBox = document.getElementById('player-box');
  const storyAudioPlayer = document.getElementById('story-audio-player');
  const btnDownloadAudio = document.getElementById('btn-download-audio');
  const audioMetaInfo = document.getElementById('audio-meta-info');

  let currentStoryId = null;
  let availableVoices = [];
  let currentVoiceMapping = {};

  function updateCharCount() {
    const len = (storyTextarea.value || '').length;
    charCounter.textContent = `${len} ký tự`;
  }

  function showStatus(message, type) {
    statusBanner.classList.remove('hidden', 'error', 'success');
    if (type === 'error') statusBanner.classList.add('error');
    if (type === 'success') statusBanner.classList.add('success');
    statusBanner.textContent = message;
  }

  function renderCharacterVoiceList(characters, voices, mapping) {
    charactersContainer.replaceChildren();
    charactersContainer.classList.remove('empty-box');

    characters.forEach((char) => {
      const row = document.createElement('div');
      row.className = 'character-row';

      const info = document.createElement('div');
      info.className = 'character-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'character-name';
      nameEl.textContent = char.displayName || char.name;

      const metaEl = document.createElement('span');
      metaEl.className = 'character-meta';
      metaEl.textContent = `${char.segmentCount} phân đoạn (${char.type === 'narration' ? 'Dẫn truyện' : 'Lời thoại'})`;

      info.appendChild(nameEl);
      info.appendChild(metaEl);

      const select = document.createElement('select');
      select.className = 'voice-select';
      select.setAttribute('data-character', char.name);

      const selectedVoiceId = mapping[char.name] || char.suggestedVoiceId;
      voices.forEach((v) => {
        const option = document.createElement('option');
        option.value = v.id;
        option.textContent = v.name;
        if (v.id === selectedVoiceId) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      select.addEventListener('change', (e) => {
        currentVoiceMapping[char.name] = e.target.value;
      });

      row.appendChild(info);
      row.appendChild(select);
      charactersContainer.appendChild(row);
    });
  }

  function renderSegmentsPreview(segments) {
    segmentsPreview.replaceChildren();
    segmentsPreview.classList.remove('empty-box');

    segments.forEach((seg, idx) => {
      const item = document.createElement('div');
      item.className = `segment-item ${seg.type === 'dialogue' ? 'dialogue' : 'narration'}`;

      const speaker = document.createElement('span');
      speaker.className = 'segment-speaker';
      speaker.textContent = `[#${idx + 1} - ${seg.character}]:`;

      const textSpan = document.createElement('span');
      textSpan.textContent = seg.text;

      item.appendChild(speaker);
      item.appendChild(textSpan);
      segmentsPreview.appendChild(item);
    });
  }

  function renderAudioMeta(data) {
    audioMetaInfo.replaceChildren();
    const items = [
      { label: 'Mã phiên xử lý (Story ID)', value: data.storyId },
      { label: 'Tổng thời lượng', value: `${data.durationSeconds} giây` },
      { label: 'Số đoạn đã ghép', value: `${data.totalSegmentsMerged} đoạn` },
      { label: 'Kích thước file MP3', value: `${(data.sizeBytes / 1024).toFixed(1)} KB` }
    ];

    items.forEach((it) => {
      const card = document.createElement('div');
      card.className = 'meta-card';

      const lbl = document.createElement('div');
      lbl.className = 'meta-card-label';
      lbl.textContent = it.label;

      const val = document.createElement('div');
      val.className = 'meta-card-value';
      val.textContent = it.value;

      card.appendChild(lbl);
      card.appendChild(val);
      audioMetaInfo.appendChild(card);
    });
  }

  storyTextarea.addEventListener('input', updateCharCount);

  btnLoadSample.addEventListener('click', () => {
    storyTextarea.value = SAMPLE_STORY;
    updateCharCount();
  });

  fileUpload.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      storyTextarea.value = String(reader.result || '');
      updateCharCount();
    };
    reader.readAsText(file, 'utf-8');
  });

  btnProcessStory.addEventListener('click', async () => {
    const text = (storyTextarea.value || '').trim();
    if (!text) {
      showStatus('Vui lòng nhập hoặc tải nội dung truyện chữ trước khi phân tích.', 'error');
      return;
    }

    btnProcessStory.disabled = true;
    btnProcessStory.textContent = 'Đang phân tích truyện...';
    showStatus('Đang phân tích lời dẫn truyện và bóc tách lời thoại các nhân vật...', 'info');

    try {
      const res = await fetch('/api/process-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyText: text })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi phân tích truyện.');
      }

      currentStoryId = data.storyId;
      availableVoices = data.availableVoices || [];
      currentVoiceMapping = { ...(data.voiceMapping || {}) };

      segmentSummaryBadge.textContent = `${data.characters.length} vai đọc • ${data.totalSegments} đoạn`;
      renderCharacterVoiceList(data.characters, availableVoices, currentVoiceMapping);
      renderSegmentsPreview(data.segments);

      btnAssignVoices.disabled = false;
      btnGenerateAudio.disabled = false;
      showStatus(
        `Phân tích hoàn tất! Nhận diện được ${data.characters.length} vai đọc và ${data.totalSegments} phân đoạn. Bạn có thể tùy chỉnh giọng đọc và bấm "Tạo & Ghép Truyện Audio".`,
        'success'
      );
    } catch (err) {
      showStatus(err.message || 'Không thể phân tích truyện chữ.', 'error');
    } finally {
      btnProcessStory.disabled = false;
      btnProcessStory.textContent = 'Phân tích Nhân vật & Hội thoại';
    }
  });

  btnAssignVoices.addEventListener('click', async () => {
    if (!currentStoryId) return;
    btnAssignVoices.disabled = true;
    try {
      const res = await fetch('/api/assign-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: currentStoryId,
          voiceMapping: currentVoiceMapping
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi lưu cấu hình giọng đọc.');
      }
      currentVoiceMapping = data.voiceMapping;
      showStatus('Đã lưu cấu hình gán giọng đọc cho tất cả nhân vật!', 'success');
    } catch (err) {
      showStatus(err.message, 'error');
    } finally {
      btnAssignVoices.disabled = false;
    }
  });

  btnGenerateAudio.addEventListener('click', async () => {
    if (!currentStoryId && !(storyTextarea.value || '').trim()) return;

    btnGenerateAudio.disabled = true;
    btnProcessStory.disabled = true;
    btnAssignVoices.disabled = true;
    audioStatusBadge.textContent = 'Đang xử lý TTS & FFmpeg...';
    showStatus(
      'Đang gọi TTS đa giọng đọc cho từng phân đoạn và dùng FFmpeg ghép nối thành file MP3 hoàn chỉnh... Vui lòng đợi trong giây lát.',
      'info'
    );

    try {
      const res = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: currentStoryId,
          storyText: storyTextarea.value,
          voiceMapping: currentVoiceMapping
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi sinh file audio.');
      }

      storyAudioPlayer.src = data.audioUrl;
      btnDownloadAudio.href = data.downloadUrl;
      btnDownloadAudio.setAttribute('download', data.fileName || 'truyen_audio.mp3');
      renderAudioMeta(data);

      playerBox.classList.remove('hidden');
      audioStatusBadge.textContent = 'Hoàn thành';
      showStatus(
        `Xuất Truyện Audio thành công! Thời lượng: ${data.durationSeconds} giây (${data.totalSegmentsMerged} phân đoạn). Bạn có thể nghe ngay hoặc tải về máy.`,
        'success'
      );
    } catch (err) {
      audioStatusBadge.textContent = 'Lỗi';
      showStatus(err.message || 'Lỗi trong quá trình xuất audio.', 'error');
    } finally {
      btnGenerateAudio.disabled = false;
      btnProcessStory.disabled = false;
      btnAssignVoices.disabled = false;
    }
  });
})();
