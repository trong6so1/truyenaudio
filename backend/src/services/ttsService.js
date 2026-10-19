const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const config = require('../config');

const EDGE_TTS_BIN = '/usr/local/bin/edge-tts';
const FFMPEG_BIN = '/usr/bin/ffmpeg';

// Allow-listed map of voice presets with distinct acoustic profiles (pitch & tempo)
const VOICE_PRESET_MAP = new Map(
  config.AVAILABLE_VOICES.map((v) => [v.id, v])
);

const ACOUSTIC_PROFILES = {
  'vi-VN-NamMinhNeural': { pitchFactor: 0.84, tempoFactor: 1.15 },
  'vi-VN-NamMinhNeural-Hero': { pitchFactor: 0.90, tempoFactor: 1.18 },
  'vi-VN-NamMinhNeural-Elder': { pitchFactor: 0.76, tempoFactor: 1.12 },
  'vi-VN-HoaiMyNeural': { pitchFactor: 1.0, tempoFactor: 1.05 },
  'vi-VN-HoaiMyNeural-Young': { pitchFactor: 1.08, tempoFactor: 1.05 },
  'vi-VN-HoaiMyNeural-Calm': { pitchFactor: 0.94, tempoFactor: 0.98 }
};

/**
 * Automatically suggests a default voice preset for a character if not explicitly mapped
 */
function getDefaultVoiceForCharacter(characterName) {
  if (!characterName || characterName === 'Narrator') {
    return 'vi-VN-NamMinhNeural';
  }
  const lower = characterName.toLowerCase();
  if (lower.includes('lan') || lower.includes('cô') || lower.includes('nàng') || lower.includes('chị') || lower.includes('em')) {
    return 'vi-VN-HoaiMyNeural-Young';
  }
  if (lower.includes('bà') || lower.includes('mẹ')) {
    return 'vi-VN-HoaiMyNeural-Calm';
  }
  if (lower.includes('ông') || lower.includes('lão') || lower.includes('bác')) {
    return 'vi-VN-NamMinhNeural-Elder';
  }
  return 'vi-VN-NamMinhNeural-Hero';
}

/**
 * Resolves a validated voice configuration object from the allow-list
 */
function resolveVoicePreset(voiceId, characterName) {
  const targetId = (voiceId && VOICE_PRESET_MAP.has(voiceId))
    ? voiceId
    : getDefaultVoiceForCharacter(characterName);
  return VOICE_PRESET_MAP.get(targetId) || VOICE_PRESET_MAP.get(config.DEFAULT_NARRATOR_VOICE);
}

/**
 * Safely validates and resolves a path inside STORAGE_TEMP_DIR
 */
function resolveSafeTempDir(jobId) {
  const safeJobId = path.basename(String(jobId || 'default')).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeJobId) {
    throw new Error('Invalid jobId');
  }
  const resolvedDir = path.resolve(config.STORAGE_TEMP_DIR, safeJobId);
  const baseWithSep = config.STORAGE_TEMP_DIR.endsWith(path.sep)
    ? config.STORAGE_TEMP_DIR
    : config.STORAGE_TEMP_DIR + path.sep;
  if (!resolvedDir.startsWith(baseWithSep)) {
    throw new Error('Directory traversal detected');
  }
  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }
  return resolvedDir;
}

/**
 * Splits text into chunks <= 180 chars at sentence/clause boundaries for TTS API limits
 */
function splitTextIntoChunks(text, maxLen = 180) {
  const clean = String(text || '').trim();
  if (clean.length <= maxLen) return [clean];
  const clauses = clean.split(/(?<=[.,;!?])\s+/);
  const chunks = [];
  let current = '';
  for (const clause of clauses) {
    if ((current + ' ' + clause).trim().length <= maxLen) {
      current = (current + ' ' + clause).trim();
    } else {
      if (current) chunks.push(current);
      if (clause.length <= maxLen) {
        current = clause;
      } else {
        for (let i = 0; i < clause.length; i += maxLen) {
          chunks.push(clause.slice(i, i + maxLen));
        }
        current = '';
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Synthesizes Vietnamese speech via Google TTS API + FFmpeg Multi-Voice Acoustic Modulation
 */
async function synthesizeWithGoogleMultiVoiceTts(text, voicePreset, outputFilePath) {
  const chunks = splitTextIntoChunks(text, 180);
  const buffers = [];

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
      }
    });
    if (!res.ok) {
      throw new Error(`Google TTS HTTP ${res.status}`);
    }
    const arrayBuf = await res.arrayBuffer();
    buffers.push(Buffer.from(arrayBuf));
  }

  const rawMp3Path = `${outputFilePath}.raw.mp3`;
  fs.writeFileSync(rawMp3Path, Buffer.concat(buffers));

  const profile = ACOUSTIC_PROFILES[voicePreset.id] || { pitchFactor: 1.0, tempoFactor: 1.0 };
  const sampleRate = 24000;
  const newRate = Math.round(sampleRate * profile.pitchFactor);
  const compensatedTempo = (profile.tempoFactor / profile.pitchFactor).toFixed(3);
  const filterStr = `asetrate=${newRate},aresample=${sampleRate},atempo=${compensatedTempo}`;

  await new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      ['-y', '-i', rawMp3Path, '-af', filterStr, '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', outputFilePath],
      { timeout: 20000 },
      (err) => {
        try {
          if (fs.existsSync(rawMp3Path)) fs.unlinkSync(rawMp3Path);
        } catch (_) {}
        if (err) return reject(err);
        resolve();
      }
    );
  });

  return outputFilePath;
}

/**
 * Synthesizes a single text segment into an MP3 file using Edge-TTS
 */
function synthesizeWithEdgeTts(text, voicePreset, outputFilePath) {
  return new Promise((resolve, reject) => {
    const actualEdgeVoice = voicePreset.edgeVoice || voicePreset.id;
    const args = [
      '--voice',
      actualEdgeVoice,
      '--text',
      text,
      '--write-media',
      outputFilePath
    ];

    if (voicePreset.rate) {
      args.push(`--rate=${voicePreset.rate}`);
    }
    if (voicePreset.pitch) {
      args.push(`--pitch=${voicePreset.pitch}`);
    }

    execFile(EDGE_TTS_BIN, args, { timeout: 15000 }, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(outputFilePath);
    });
  });
}

/**
 * Offline fallback generator using FFmpeg if network/TTS API is unreachable
 */
function synthesizeFallbackAudio(text, voicePreset, outputFilePath) {
  return new Promise((resolve, reject) => {
    const durationSec = Math.max(1.5, Math.min(8, Math.ceil(text.length / 22)));
    const freq = voicePreset.gender === 'female' ? 520 : 320;
    const args = [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${freq}:duration=${durationSec}`,
      '-ar',
      '24000',
      '-ac',
      '1',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '64k',
      outputFilePath
    ];
    execFile(FFMPEG_BIN, args, { timeout: 15000 }, (err) => {
      if (err) return reject(err);
      resolve(outputFilePath);
    });
  });
}

/**
 * Generates audio for a single segment with retry + multi-provider support
 */
async function synthesizeSegmentWithRetry(segment, index, voicePreset, jobTempDir) {
  const fileName = `segment_${String(index).padStart(3, '0')}.mp3`;
  const outputFilePath = path.resolve(jobTempDir, fileName);

  const dirWithSep = jobTempDir.endsWith(path.sep) ? jobTempDir : jobTempDir + path.sep;
  if (!outputFilePath.startsWith(dirWithSep)) {
    throw new Error('Invalid segment file path');
  }

  // Primary: Google Vietnamese TTS + FFmpeg Multi-Character Voice Modulation
  try {
    await synthesizeWithGoogleMultiVoiceTts(segment.text, voicePreset, outputFilePath);
    const stats = fs.statSync(outputFilePath);
    if (stats.size > 0) {
      return {
        index,
        type: segment.type,
        character: segment.character,
        voiceId: voicePreset.id,
        voiceName: voicePreset.name,
        text: segment.text,
        fileName,
        filePath: outputFilePath,
        sizeBytes: stats.size,
        provider: 'google-tts-multivoice-dsp'
      };
    }
  } catch (googleErr) {
    // Secondary: Edge-TTS
    try {
      await synthesizeWithEdgeTts(segment.text, voicePreset, outputFilePath);
      const stats = fs.statSync(outputFilePath);
      if (stats.size > 0) {
        return {
          index,
          type: segment.type,
          character: segment.character,
          voiceId: voicePreset.id,
          voiceName: voicePreset.name,
          text: segment.text,
          fileName,
          filePath: outputFilePath,
          sizeBytes: stats.size,
          provider: 'edge-tts'
        };
      }
    } catch (_) {}
  }

  // Tertiary: Offline FFmpeg synthesis
  await synthesizeFallbackAudio(segment.text, voicePreset, outputFilePath);
  const stats = fs.statSync(outputFilePath);
  return {
    index,
    type: segment.type,
    character: segment.character,
    voiceId: voicePreset.id,
    voiceName: voicePreset.name,
    text: segment.text,
    fileName,
    filePath: outputFilePath,
    sizeBytes: stats.size,
    provider: 'ffmpeg-fallback'
  };
}

/**
 * Synthesizes all story segments with controlled concurrency (CONCURRENCY_LIMIT = 2)
 */
async function synthesizeStorySegments(segments, voiceMapping = {}, jobId = 'job_default') {
  const jobTempDir = resolveSafeTempDir(jobId);
  const results = new Array(segments.length);
  const concurrencyLimit = 2;
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < segments.length) {
      const idx = currentIndex++;
      const seg = segments[idx];
      const requestedVoiceId = voiceMapping[seg.character];
      const voicePreset = resolveVoicePreset(requestedVoiceId, seg.character);
      results[idx] = await synthesizeSegmentWithRetry(seg, idx, voicePreset, jobTempDir);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrencyLimit, segments.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return {
    jobId,
    tempDir: jobTempDir,
    totalSegments: results.length,
    segments: results
  };
}

module.exports = {
  synthesizeStorySegments,
  resolveVoicePreset,
  getDefaultVoiceForCharacter,
  resolveSafeTempDir
};
