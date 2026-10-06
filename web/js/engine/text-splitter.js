// 文本切分与清洗（与 Kotlin TextSplitter 对应）

/** 句子边界标点 */
const SENTENCE_BOUNDARY = new Set(['。', '！', '？', '，', '；', '：', '、']);

/** 句中保留的标点 */
export const PUNCTUATION = new Set(['。', '！', '？', '，', '；', '：', '、']);

/**
 * 清洗用户粘贴/输入的诗词文本：去除所有空白与不可见/控制字符。
 * 网页复制常带入行尾空格、换行、全角空格、零宽字符等，混入正文会被当作"字"标注。
 */
export function cleanInput(text) {
  if (!text) return text || '';
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (/\s/u.test(ch)) continue;                 // 空白（含全角空格）
    if (c === 0xfeff) continue;                   // BOM / 零宽不换行
    if (c >= 0x200b && c <= 0x200f) continue;     // 零宽空格/连接符/方向控制
    if (c >= 0x2028 && c <= 0x202e) continue;     // 行/段分隔、双向文本
    if (c >= 0x2060 && c <= 0x206f) continue;     // 连字符/字距/语言标签等
    if (c >= 0xfe00 && c <= 0xfe0f) continue;     // 变体选择符
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) continue; // 控制字符
    out += ch;
  }
  return out;
}

/**
 * 按标点把诗文切分为"句"（句末字即韵脚）。
 * 标点保留在句中，返回每句的完整文本。
 */
export function splitSentences(text) {
  if (!text || !text.trim()) return [];
  const chars = Array.from(text);
  const result = [];
  let start = 0;
  let i = 0;
  while (i < chars.length) {
    if (SENTENCE_BOUNDARY.has(chars[i]) && i < chars.length - 1) {
      // 句末标点若在文本中间，则句到此为止
      result.push(chars.slice(start, i + 1).join(''));
      start = i + 1;
    }
    i++;
  }
  if (start < chars.length) {
    result.push(chars.slice(start).join(''));
  }
  return result;
}
