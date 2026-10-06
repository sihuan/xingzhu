// 近体诗格律检测（与 Kotlin PingZeChecker.kt 对应）
// 体裁识别 + 孤平/三平尾/三仄尾/失对/失粘/出韵 检查。

import { ToneClass, isHanzi } from './model.js';
import { splitSentences } from './text-splitter.js';

/** 格律问题类型 */
export const IssueType = Object.freeze({
  LONELY_LEVEL: 'LONELY_LEVEL',
  TRIPLE_LEVEL_TAIL: 'TRIPLE_LEVEL_TAIL',
  TRIPLE_OBLIQUE_TAIL: 'TRIPLE_OBLIQUE_TAIL',
  MISMATCH_IN_COUPLET: 'MISMATCH_IN_COUPLET',
  MISMATCH_BETWEEN_COUPLETS: 'MISMATCH_BETWEEN_COUPLETS',
  RHYME_MISMATCH: 'RHYME_MISMATCH',
});

export const PingZeChecker = {
  /** 自动判定近体诗体裁；非近体诗（古体/词/杂言）返回 null */
  detectForm(contentText) {
    const lines = splitSentences(contentText);
    if (lines.length === 0) return null;
    const lengths = new Set(lines.map((line) => Array.from(line).filter(isHanzi).length));
    if (lengths.size !== 1) return null;
    const len = [...lengths][0];
    const n = lines.length;
    if (len === 5 && n === 4) return '五言绝句';
    if (len === 5 && n === 8) return '五言律诗';
    if (len === 7 && n === 4) return '七言绝句';
    if (len === 7 && n === 8) return '七言律诗';
    return null;
  },

  /** 对已标注的近体诗做格律检测，返回问题列表（无问题则空列表） */
  check(annotated) {
    const issues = [];
    const lines = annotated.lines.map((line) => line.chars.filter((c) => isHanzi(c.char)));
    if (lines.length === 0) return issues;

    // 句级检查：孤平 / 三平尾 / 三仄尾
    lines.forEach((chars, idx) => {
      if (chars.length < 3) return;

      const tail = chars.slice(-3).map((c) => c.tone);
      if (tail.every((t) => t === ToneClass.LEVEL)) {
        issues.push({ lineIndex: idx, charIndex: null, type: IssueType.TRIPLE_LEVEL_TAIL, message: `第 ${idx + 1} 句三平尾（句末三字皆平）` });
      } else if (tail.every((t) => t === ToneClass.OBLIQUE)) {
        issues.push({ lineIndex: idx, charIndex: null, type: IssueType.TRIPLE_OBLIQUE_TAIL, message: `第 ${idx + 1} 句三仄尾（句末三字皆仄）` });
      }

      // 孤平：平收句式（平平仄仄平 / 仄仄平平仄仄平）中"平"被挤成仄
      if (chars[chars.length - 1].tone === ToneClass.LEVEL && chars.length >= 3) {
        const levelCount = chars.slice(0, -1).filter((c) => c.tone === ToneClass.LEVEL).length;
        const tailOblique = chars[chars.length - 2].tone === ToneClass.OBLIQUE &&
          chars[chars.length - 3].tone === ToneClass.OBLIQUE;
        if (levelCount === 1 && tailOblique) {
          issues.push({ lineIndex: idx, charIndex: null, type: IssueType.LONELY_LEVEL, message: `第 ${idx + 1} 句犯孤平（句中仅一个平声字）` });
        }
      }
    });

    const keyPos = keyPositions(lines[0].length);

    // 失对：一联内（0-1, 2-3, ...）两句关键位平仄应相反
    for (let i = 0; i < lines.length - 1; i += 2) {
      if (!isOpposite(lines[i], lines[i + 1], keyPos)) {
        issues.push({ lineIndex: i, charIndex: null, type: IssueType.MISMATCH_IN_COUPLET, message: `第 ${i / 2 + 1} 联失对（两句关键位平仄未相对）` });
      }
    }

    // 失粘：相邻两联（1-2, 3-4, ...）出句与前联对句关键位平仄应相粘
    for (let i = 1; i < lines.length - 1; i += 2) {
      if (!isSame(lines[i], lines[i + 1], keyPos)) {
        issues.push({ lineIndex: i, charIndex: null, type: IssueType.MISMATCH_BETWEEN_COUPLETS, message: `第 ${i + 1} 句与第 ${i + 2} 句失粘` });
      }
    }

    // 出韵：近体诗只在偶句（2、4、6、8 句）押韵，比较这些句的韵脚韵部是否一致
    const rhymeLines = annotated.lines.filter((_, idx) => idx % 2 === 1);
    const rhymes = rhymeLines
      .map((line) => [...line.chars].reverse().find((c) => c.isRhymeWord && c.rhyme !== null))
      .filter(Boolean);
    const firstRhyme = rhymes.length > 0 ? rhymes[0].rhyme : null;
    if (firstRhyme !== null) {
      for (const meta of rhymes) {
        if (meta.rhyme !== firstRhyme) {
          const lineIdx = annotated.lines.findIndex((l) => l.chars.includes(meta));
          issues.push({ lineIndex: lineIdx, charIndex: null, type: IssueType.RHYME_MISMATCH, message: `韵脚『${meta.char}』（${meta.rhyme}）与首韵（${firstRhyme}）不同，疑出韵` });
        }
      }
    }

    return issues;
  },
};

/** 五言取第 2、4 位；七言取第 2、4、6 位（0-based: 1,3 / 1,3,5） */
function keyPositions(lineLen) {
  return lineLen >= 7 ? [1, 3, 5] : [1, 3];
}

function isOpposite(a, b, pos) {
  let checked = 0;
  for (const p of pos) {
    const ta = a[p] ? a[p].tone : null;
    const tb = b[p] ? b[p].tone : null;
    if (ta != null && tb != null && ta !== ToneClass.UNKNOWN && tb !== ToneClass.UNKNOWN) {
      checked++;
      if (ta === tb) return false;
    }
  }
  return checked > 0;
}

function isSame(a, b, pos) {
  let checked = 0;
  for (const p of pos) {
    const ta = a[p] ? a[p].tone : null;
    const tb = b[p] ? b[p].tone : null;
    if (ta != null && tb != null && ta !== ToneClass.UNKNOWN && tb !== ToneClass.UNKNOWN) {
      checked++;
      if (ta !== tb) return false;
    }
  }
  return checked > 0;
}
