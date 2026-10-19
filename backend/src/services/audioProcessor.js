const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const config = require('../config');
const { resolveSafeTempDir } = require('./ttsService');

const FFMPEG_BIN = '/usr/bin/ffmpeg';
const FFPROBE_BIN = '/usr/bin/ffprobe';

/**
 * Safely validates and resolves a path inside STORAGE_MERGED_DIR
 */
function resolveSafeMergedFilePath(jobId) {
  const safeJobId = path.basename(String(jobId || 'default')).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeJobId) {
    throw new Error('Invalid jobId');
  }
  if (!fs.existsSync(config.STORAGE_MERGED_DIR)) {
    fs.mkdirSync(config.STORAGE_MERGED_DIR, { recursive: true });
  }
  const fileName = `${safeJobId}_full_story.mp3`;
  const resolvedPath = path.resolve(config.STORAGE_MERGED_DIR, fileName);
  const baseWithSep = config.STORAGE_MERGED_DIR.endsWith(path.sep)
    ? config.STORAGE_MERGED_DIR
    : config.STORAGE_MERGED_DIR + path.sep;
  if (!resolvedPath.startsWith(baseWithSep)) {
    throw new Error('Directory traversal detected');
  }
  return { safeJobId, fileName, resolvedPath };
}

/**
 * Generates a short silence MP3 file (0.35s) to insert natural pauses between segments
 */
function generateSilenceFile(jobTempDir, durationSec = 0.35) {
  const silencePath = path.resolve(jobTempDir, 'silence_pause.mp3');
  const dirWithSep = jobTempDir.endsWith(path.sep) ? jobTempDir : jobTempDir + path.sep;
  if (!silencePath.startsWith(dirWithSep)) {
    throw new Error('Invalid silence file path');
  }
  return new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `anullsrc=r=24000:cl=mono`,
        '-t',
        String(durationSec),
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        silencePath
      ],
      { timeout: 10000 },
      (err) => {
        if (err) return reject(err);
        resolve(silencePath);
      }
    );
  });
}

/**
 * Probes audio duration in seconds using ffprobe
 */
function getAudioDurationSeconds(filePath) {
  return new Promise((resolve) => {
    execFile(
      FFPROBE_BIN,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 10000 },
      (err, stdout) => {
        if (err) return resolve(0);
        const val = parseFloat(String(stdout).trim());
        resolve(Number.isFinite(val) ? Number(val.toFixed(2)) : 0);
      }
    );
  });
}

/**
 * Merges ordered audio segment files into a single MP3 file using FFmpeg concat demuxer
 */
async function mergeAudioSegments(segmentItems, jobId = 'job_default') {
  if (!Array.isArray(segmentItems) || segmentItems.length === 0) {
    throw new Error('No audio segments provided to merge');
  }

  const jobTempDir = resolveSafeTempDir(jobId);
  const { safeJobId, fileName, resolvedPath: mergedFilePath } = resolveSafeMergedFilePath(jobId);
  const silencePath = await generateSilenceFile(jobTempDir, 0.35);

  const dirWithSep = jobTempDir.endsWith(path.sep) ? jobTempDir : jobTempDir + path.sep;
  const sortedSegments = [...segmentItems].sort((a, b) => a.index - b.index);

  const concatLines = [];
  for (let i = 0; i < sortedSegments.length; i++) {
    const segFileName = path.basename(String(sortedSegments[i].fileName || ''));
    const segResolved = path.resolve(jobTempDir, segFileName);
    if (!segResolved.startsWith(dirWithSep) || !fs.existsSync(segResolved)) {
      throw new Error(`Segment audio file missing or invalid: ${segFileName}`);
    }
    const escapedSeg = segResolved.replace(/'/g, "'\\''");
    concatLines.push(`file '${escapedSeg}'`);
    if (i < sortedSegments.length - 1) {
      const escapedSilence = silencePath.replace(/'/g, "'\\''");
      concatLines.push(`file '${escapedSilence}'`);
    }
  }

  const concatListPath = path.resolve(jobTempDir, 'concat_list.txt');
  fs.writeFileSync(concatListPath, concatLines.join('\n') + '\n', 'utf-8');

  await new Promise((resolve, reject) => {
    execFile(
      FFMPEG_BIN,
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatListPath,
        '-ar',
        '24000',
        '-ac',
        '1',
        '-c:a',
        'libmp3lame',
        '-b:a',
        '64k',
        mergedFilePath
      ],
      { timeout: 60000 },
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });

  const stats = fs.statSync(mergedFilePath);
  const durationSeconds = await getAudioDurationSeconds(mergedFilePath);

  return {
    jobId: safeJobId,
    fileName,
    mergedFilePath,
    audioUrl: `/api/audio/${fileName}`,
    totalSegmentsMerged: sortedSegments.length,
    sizeBytes: stats.size,
    durationSeconds
  };
}

module.exports = {
  mergeAudioSegments,
  resolveSafeMergedFilePath,
  getAudioDurationSeconds
};
