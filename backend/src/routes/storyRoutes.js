const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { analyzeStoryText } = require('../services/llmService');
const {
  synthesizeStorySegments,
  getDefaultVoiceForCharacter,
  resolveVoicePreset
} = require('../services/ttsService');
const { mergeAudioSegments } = require('../services/audioProcessor');

const router = express.Router();

// In-memory store for processed stories and voice assignments
const storySessionStore = new Map();

/**
 * Generates a safe unique story job ID
 */
function createStoryId() {
  return `story_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * GET /api/voices - Returns available TTS voices
 */
router.get('/voices', (req, res) => {
  res.json({
    voices: config.AVAILABLE_VOICES,
    defaultNarratorVoice: config.DEFAULT_NARRATOR_VOICE
  });
});

/**
 * POST /api/process-story - Analyzes story text, extracts narration & character dialogues
 */
router.post('/process-story', async (req, res) => {
  try {
    const { storyText } = req.body || {};
    if (!storyText || typeof storyText !== 'string' || !storyText.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung truyện chữ hợp lệ.' });
    }
    if (storyText.length > 50000) {
      return res.status(400).json({ error: 'Nội dung truyện vượt quá giới hạn 50.000 ký tự.' });
    }

    const analysis = await analyzeStoryText(storyText.trim());
    const storyId = createStoryId();

    const defaultVoiceMapping = {};
    const enrichedCharacters = analysis.characters.map((char) => {
      const suggestedVoiceId = getDefaultVoiceForCharacter(char.name);
      defaultVoiceMapping[char.name] = suggestedVoiceId;
      return {
        ...char,
        suggestedVoiceId
      };
    });

    storySessionStore.set(storyId, {
      storyId,
      storyText: storyText.trim(),
      characters: enrichedCharacters,
      segments: analysis.segments,
      voiceMapping: defaultVoiceMapping,
      createdAt: new Date().toISOString()
    });

    return res.json({
      storyId,
      providerUsed: analysis.providerUsed,
      totalSegments: analysis.totalSegments,
      characters: enrichedCharacters,
      voiceMapping: defaultVoiceMapping,
      segments: analysis.segments,
      availableVoices: config.AVAILABLE_VOICES
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi phân tích truyện chữ.' });
  }
});

/**
 * POST /api/assign-voices - Assigns voice IDs to extracted characters
 */
router.post('/assign-voices', (req, res) => {
  try {
    const { storyId, voiceMapping } = req.body || {};
    if (!storyId || typeof storyId !== 'string' || !storySessionStore.has(storyId)) {
      return res.status(404).json({ error: 'Không tìm thấy phiên xử lý truyện (storyId không hợp lệ).' });
    }
    if (!voiceMapping || typeof voiceMapping !== 'object') {
      return res.status(400).json({ error: 'Dữ liệu voiceMapping không hợp lệ.' });
    }

    const session = storySessionStore.get(storyId);
    const validatedMapping = { ...session.voiceMapping };

    for (const [charName, voiceId] of Object.entries(voiceMapping)) {
      const preset = resolveVoicePreset(String(voiceId), charName);
      validatedMapping[charName] = preset.id;
    }

    session.voiceMapping = validatedMapping;
    storySessionStore.set(storyId, session);

    return res.json({
      storyId,
      message: 'Đã lưu cấu hình gán giọng đọc cho các nhân vật.',
      voiceMapping: validatedMapping
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi khi lưu cấu hình giọng đọc.' });
  }
});

/**
 * POST /api/generate-audio - Runs TTS synthesis & FFmpeg merging to produce final audio URL
 */
router.post('/generate-audio', async (req, res) => {
  try {
    const { storyId, storyText, voiceMapping } = req.body || {};

    let activeStoryId = storyId && storySessionStore.has(storyId) ? storyId : null;
    let segments = [];
    let finalVoiceMapping = {};

    if (activeStoryId) {
      const session = storySessionStore.get(activeStoryId);
      segments = session.segments;
      finalVoiceMapping = {
        ...session.voiceMapping,
        ...(voiceMapping && typeof voiceMapping === 'object' ? voiceMapping : {})
      };
    } else if (storyText && typeof storyText === 'string' && storyText.trim()) {
      activeStoryId = createStoryId();
      const analysis = await analyzeStoryText(storyText.trim());
      segments = analysis.segments;
      for (const char of analysis.characters) {
        finalVoiceMapping[char.name] = getDefaultVoiceForCharacter(char.name);
      }
      if (voiceMapping && typeof voiceMapping === 'object') {
        Object.assign(finalVoiceMapping, voiceMapping);
      }
    } else {
      return res.status(400).json({
        error: 'Cần cung cấp storyId đã phân tích hoặc storyText đầu vào.'
      });
    }

    // Validate all voice IDs against allow-list
    for (const [charName, vId] of Object.entries(finalVoiceMapping)) {
      finalVoiceMapping[charName] = resolveVoicePreset(String(vId), charName).id;
    }

    const ttsResult = await synthesizeStorySegments(segments, finalVoiceMapping, activeStoryId);
    const mergeResult = await mergeAudioSegments(ttsResult.segments, activeStoryId);

    return res.json({
      storyId: activeStoryId,
      audioUrl: mergeResult.audioUrl,
      downloadUrl: `${mergeResult.audioUrl}?download=1`,
      fileName: mergeResult.fileName,
      durationSeconds: mergeResult.durationSeconds,
      sizeBytes: mergeResult.sizeBytes,
      totalSegmentsMerged: mergeResult.totalSegmentsMerged,
      voiceMapping: finalVoiceMapping,
      segments: ttsResult.segments.map((s) => ({
        index: s.index,
        type: s.type,
        character: s.character,
        voiceId: s.voiceId,
        voiceName: s.voiceName,
        text: s.text,
        sizeBytes: s.sizeBytes,
        provider: s.provider
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi trong quá trình tạo và ghép file audio.' });
  }
});

/**
 * GET /api/audio/:fileName - Safely streams or downloads the merged MP3 file
 */
router.get('/audio/:fileName', (req, res) => {
  try {
    const rawName = String(req.params.fileName || '');
    const safeFileName = path.basename(rawName).replace(/[^a-zA-Z0-9_.-]/g, '');
    if (!safeFileName || !safeFileName.endsWith('.mp3')) {
      return res.status(400).json({ error: 'Tên file audio không hợp lệ.' });
    }

    const resolvedPath = path.resolve(config.STORAGE_MERGED_DIR, safeFileName);
    const baseWithSep = config.STORAGE_MERGED_DIR.endsWith(path.sep)
      ? config.STORAGE_MERGED_DIR
      : config.STORAGE_MERGED_DIR + path.sep;

    if (!resolvedPath.startsWith(baseWithSep) || !fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Không tìm thấy file audio.' });
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'audio/mpeg');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    }
    return res.sendFile(resolvedPath);
  } catch (err) {
    return res.status(500).json({ error: 'Không thể tải file audio.' });
  }
});

module.exports = router;
