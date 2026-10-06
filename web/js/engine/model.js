// 核心领域模型（与 Kotlin :engine Model.kt 对应）

/** 平 / 仄（按《诗韵新编》判定）；UNKNOWN = 字典未收录，待考 */
export const ToneClass = Object.freeze({
  LEVEL: 'LEVEL',
  OBLIQUE: 'OBLIQUE',
  UNKNOWN: 'UNKNOWN',
});

/** 构造单个字的标注信息 */
export function charMeta(char, tone, { rhyme = null, isRhymeWord = false, ambiguous = false } = {}) {
  return { char, tone, rhyme, isRhymeWord, ambiguous };
}

/** 构造一行（一个"句"）及其逐字标注 */
export function annotatedLine(text, chars) {
  return { text, chars };
}

/** 构造一首诗的完整标注结果 */
export function annotatedPoem(poemId, lines, form, annotations = []) {
  return { poemId, lines, form, annotations };
}

/** 判断是否为 CJK 统一表意文字（U+4E00..U+9FFF），对应 Kotlin 的字符范围判断 */
export function isHanzi(ch) {
  if (!ch) return false;
  const c = ch.codePointAt(0);
  return c >= 0x4e00 && c <= 0x9fff;
}
