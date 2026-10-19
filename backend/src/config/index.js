const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const AVAILABLE_VOICES = [
  {
    id: 'vi-VN-NamMinhNeural',
    name: 'Nam Minh (Nam - Trầm ấm, Dẫn truyện)',
    gender: 'male',
    role: 'narrator_or_character',
    provider: 'edge-tts'
  },
  {
    id: 'vi-VN-HoaiMyNeural',
    name: 'Hoài My (Nữ - Truyền cảm, Nhẹ nhàng)',
    gender: 'female',
    role: 'narrator_or_character',
    provider: 'edge-tts'
  },
  {
    id: 'vi-VN-NamMinhNeural-Hero',
    edgeVoice: 'vi-VN-NamMinhNeural',
    rate: '+8%',
    pitch: '+5Hz',
    name: 'Minh Khôi (Nam trẻ - Năng động)',
    gender: 'male',
    role: 'character',
    provider: 'edge-tts'
  },
  {
    id: 'vi-VN-NamMinhNeural-Elder',
    edgeVoice: 'vi-VN-NamMinhNeural',
    rate: '-10%',
    pitch: '-8Hz',
    name: 'Ông Lão / Trầm Hùng (Nam trầm - Già dặn)',
    gender: 'male',
    role: 'character',
    provider: 'edge-tts'
  },
  {
    id: 'vi-VN-HoaiMyNeural-Young',
    edgeVoice: 'vi-VN-HoaiMyNeural',
    rate: '+10%',
    pitch: '+8Hz',
    name: 'Linh Đan (Nữ trẻ - Trong trẻo)',
    gender: 'female',
    role: 'character',
    provider: 'edge-tts'
  },
  {
    id: 'vi-VN-HoaiMyNeural-Calm',
    edgeVoice: 'vi-VN-HoaiMyNeural',
    rate: '-8%',
    pitch: '-5Hz',
    name: 'Bà Lão / Điềm Đạm (Nữ trầm - Sâu lắng)',
    gender: 'female',
    role: 'character',
    provider: 'edge-tts'
  }
];

module.exports = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  HOST: process.env.HOST || '127.0.0.1',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
  TTS_PROVIDER: process.env.TTS_PROVIDER || 'edge-tts',
  STORAGE_TEMP_DIR: path.resolve(__dirname, '../../storage/temp'),
  STORAGE_MERGED_DIR: path.resolve(__dirname, '../../storage/merged'),
  OUTPUTS_DIR: path.resolve(__dirname, '../../../outputs'),
  AVAILABLE_VOICES,
  DEFAULT_NARRATOR_VOICE: 'vi-VN-NamMinhNeural'
};
