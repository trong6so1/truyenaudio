const config = require('../config');

const SYSTEM_PROMPT = `Bạn là một chuyên gia phân tích văn học và xử lý ngôn ngữ tự nhiên (NLP).
Nhiệm vụ của bạn là đọc đoạn truyện chữ đầu vào và bóc tách thành một mảng JSON gồm các phân đoạn theo đúng trình tự xuất hiện trong truyện.
Mỗi phần tử trong mảng JSON phải có cấu trúc chính xác như sau:
{
  "type": "narration" | "dialogue",
  "character": "Narrator" (nếu là narration) hoặc "Tên nhân vật" (nếu là dialogue),
  "text": "Nội dung lời dẫn hoặc lời thoại (đã lược bỏ dấu ngoặc kép thừa)"
}
Chỉ trả về JSON hợp lệ, không kèm markdown giải thích.`;

/**
 * Rule-based Vietnamese story parser fallback when LLM API key is not configured
 * or when offline analysis is used.
 */
function parseStoryWithVietnameseNLP(storyText) {
  if (!storyText || typeof storyText !== 'string') {
    return [];
  }

  const speechVerbs = [
    'nói', 'hỏi', 'đáp', 'trả lời', 'thì thầm', 'hét lên', 'gọi', 'kêu lên',
    'thở dài', 'mỉm cười nói', 'cười nói', 'quát', 'bảo', 'nhắc', 'lẩm bẩm',
    'cất tiếng', 'lên tiếng', 'ngạc nhiên hỏi', 'vội nói', 'khẽ nói', 'dặn'
  ];

  // Verb pattern for extracting character names before or after speech verbs
  const verbPattern = speechVerbs.join('|');
  const capWord = '[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]*';
  const beforeVerbRegex = new RegExp(
    `(?:^|[.,;!?\\s])((?:[Ôô]ng lão|[Bb]à lão|[Cc]ô gái|[Cc]hàng trai|${capWord}(?:\\s+${capWord}){0,2}))(?:\\s+[^.,;!?A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]{0,25})?\\s+(?:${verbPattern})\\b`
  );

  const STOP_PRONOUNS = new Set([
    'Nhưng', 'Tuy', 'Bỗng', 'Đột', 'Sau', 'Rồi', 'Khi', 'Trong',
    'Ngoài', 'Trên', 'Dưới', 'Giữa', 'Một', 'Những', 'Các', 'Trời', 'Gió', 'Đêm',
    'Từ', 'Cánh', 'Ngọn', 'Đôi', 'Bàn'
  ]);

  function cleanCharacterName(rawName, lastSpeaker, knownCharacters) {
    if (!rawName) return lastSpeaker || 'Nhân vật';
    const trimmed = rawName.trim().replace(/^(nhưng|rồi|bỗng|lúc đó|ngay lập tức)\s+/i, '');
    const words = trimmed.split(/\s+/);
    if (words.length > 0 && STOP_PRONOUNS.has(words[0])) {
      return lastSpeaker || 'Nhân vật';
    }
    const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    for (const known of knownCharacters) {
      if (normalized.toLowerCase() === known.toLowerCase()) {
        return known;
      }
    }
    return normalized;
  }

  const lines = storyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const segments = [];
  const knownCharacters = new Set();
  let lastMentionedCharacter = null;

  for (const line of lines) {
    // Case 1: Dialogue line starting with dash (- or – or —)
    if (/^[-–—]\s*/.test(line)) {
      const content = line.replace(/^[-–—]\s*/, '').trim();
      // Check if trailing narration exists after dash e.g. "Chào cậu! - Lan mỉm cười nói."
      const parts = content.split(/\s+[-–—]\s+/);
      if (parts.length > 1) {
        const dialogueText = parts[0].replace(/^["“”']+|["“”']+$/g, '').trim();
        const trailingNarration = parts.slice(1).join(' - ').trim();
        let speaker = lastMentionedCharacter || 'Nhân vật';
        const match = trailingNarration.match(beforeVerbRegex);
        if (match && match[1]) {
          speaker = cleanCharacterName(match[1], lastMentionedCharacter, knownCharacters);
          knownCharacters.add(speaker);
          lastMentionedCharacter = speaker;
        }
        if (dialogueText) {
          segments.push({
            type: 'dialogue',
            character: speaker,
            text: dialogueText
          });
        }
        if (trailingNarration) {
          segments.push({
            type: 'narration',
            character: 'Narrator',
            text: trailingNarration
          });
        }
      } else {
        const dialogueText = content.replace(/^["“”']+|["“”']+$/g, '').trim();
        const speaker = lastMentionedCharacter || 'Nhân vật';
        if (dialogueText) {
          segments.push({
            type: 'dialogue',
            character: speaker,
            text: dialogueText
          });
        }
      }
      continue;
    }

    // Case 2: Line containing quoted dialogue ("..." or “...”)
    const quoteRegex = /["“]([^"”]+)["”]/g;
    let match;
    let lastIndex = 0;
    let foundQuote = false;

    while ((match = quoteRegex.exec(line)) !== null) {
      foundQuote = true;
      const beforeQuote = line.slice(lastIndex, match.index).trim();
      const dialogueText = match[1].trim();

      if (beforeQuote) {
        const speakerMatch = beforeQuote.match(beforeVerbRegex);
        if (speakerMatch && speakerMatch[1]) {
          const speaker = cleanCharacterName(speakerMatch[1], lastMentionedCharacter, knownCharacters);
          knownCharacters.add(speaker);
          lastMentionedCharacter = speaker;
        }
        const cleanedBefore = beforeQuote.replace(/[:]\s*$/, '').trim();
        if (cleanedBefore) {
          segments.push({
            type: 'narration',
            character: 'Narrator',
            text: cleanedBefore
          });
        }
      }

      // Also check after quote if speaker wasn't before quote
      const afterQuotePreview = line.slice(quoteRegex.lastIndex).trim();
      let currentSpeaker = lastMentionedCharacter || 'Nhân vật';
      if (!beforeQuote && afterQuotePreview) {
        const afterMatch = afterQuotePreview.match(beforeVerbRegex);
        if (afterMatch && afterMatch[1]) {
          currentSpeaker = cleanCharacterName(afterMatch[1], lastMentionedCharacter, knownCharacters);
          knownCharacters.add(currentSpeaker);
          lastMentionedCharacter = currentSpeaker;
        }
      }

      if (dialogueText) {
        segments.push({
          type: 'dialogue',
          character: currentSpeaker,
          text: dialogueText
        });
      }

      lastIndex = quoteRegex.lastIndex;
    }

    if (foundQuote) {
      const remaining = line.slice(lastIndex).replace(/^[,.;:\s-–—]+/, '').trim();
      if (remaining) {
        const afterMatch = remaining.match(beforeVerbRegex);
        if (afterMatch && afterMatch[1]) {
          const speaker = cleanCharacterName(afterMatch[1], lastMentionedCharacter, knownCharacters);
          knownCharacters.add(speaker);
          lastMentionedCharacter = speaker;
        }
        segments.push({
          type: 'narration',
          character: 'Narrator',
          text: remaining
        });
      }
      continue;
    }

    // Case 3: Pure narration line (check if it introduces a character for the next line)
    const introMatch = line.match(beforeVerbRegex);
    if (introMatch && introMatch[1]) {
      const speaker = cleanCharacterName(introMatch[1], lastMentionedCharacter, knownCharacters);
      knownCharacters.add(speaker);
      lastMentionedCharacter = speaker;
    }
    segments.push({
      type: 'narration',
      character: 'Narrator',
      text: line.replace(/[:]\s*$/, '').trim()
    });
  }

  return segments;
}

/**
 * Calls OpenAI API if OPENAI_API_KEY is configured
 */
async function callOpenAI(storyText) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: storyText }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned status ${response.status}`);
  }
  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '[]';
  const cleanedJson = rawContent.replace(/```json|```/g, '').trim();
  return JSON.parse(cleanedJson);
}

/**
 * Analyzes story text and returns structured segments + character list
 */
async function analyzeStoryText(storyText) {
  let segments = [];
  let providerUsed = 'vietnamese-nlp-parser';

  if (config.OPENAI_API_KEY) {
    try {
      segments = await callOpenAI(storyText);
      providerUsed = 'openai-gpt-4o-mini';
    } catch (err) {
      segments = parseStoryWithVietnameseNLP(storyText);
      providerUsed = 'vietnamese-nlp-parser (fallback)';
    }
  } else {
    segments = parseStoryWithVietnameseNLP(storyText);
  }

  // Extract unique characters ( always include Narrator first )
  const characterMap = new Map();
  characterMap.set('Narrator', {
    name: 'Narrator',
    displayName: 'Người dẫn truyện (Narrator)',
    type: 'narration',
    segmentCount: 0
  });

  for (const seg of segments) {
    const charName = seg.type === 'narration' ? 'Narrator' : (seg.character || 'Nhân vật');
    seg.character = charName;
    if (!characterMap.has(charName)) {
      characterMap.set(charName, {
        name: charName,
        displayName: charName,
        type: 'dialogue',
        segmentCount: 0
      });
    }
    characterMap.get(charName).segmentCount += 1;
  }

  return {
    providerUsed,
    totalSegments: segments.length,
    characters: Array.from(characterMap.values()),
    segments
  };
}

module.exports = {
  analyzeStoryText,
  parseStoryWithVietnameseNLP
};
