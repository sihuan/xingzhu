// 标注引擎（与 Kotlin PingZeEngine.kt 对应）
// 按《诗韵新编》逐字标注平仄与韵部，句末非标点字标注为韵脚。

import { ToneClass } from './model.js';
import { PUNCTUATION, splitSentences } from './text-splitter.js';

function addIfAbsent(list, text) {
  if (!list.includes(text)) list.push(text);
}

export class PingZeEngine {
  constructor(dictionary) {
    this.dictionary = dictionary;
  }

  annotatePoem(poemId, form, contentText) {
    const lines = splitSentences(contentText);
    const notes = [];
    const annotatedLines = lines.map((line) => {
      const chars = Array.from(line);
      let rhymeIndex = -1;
      for (let i = chars.length - 1; i >= 0; i--) {
        if (!PUNCTUATION.has(chars[i])) { rhymeIndex = i; break; }
      }
      const metas = chars.map((c, index) => {
        if (PUNCTUATION.has(c)) {
          return { char: c, tone: ToneClass.UNKNOWN, rhyme: null, isRhymeWord: false, ambiguous: false };
        }
        return this.annotateChar(c, index === rhymeIndex, notes);
      });
      return { text: line, chars: metas };
    });
    return { poemId, form, lines: annotatedLines, annotations: notes };
  }

  annotateChar(c, isRhymeWord, notes) {
    const entry = this.dictionary.lookup(c);
    if (entry === null) {
      addIfAbsent(notes, `「${c}」字典未收录，标为待考`);
      return { char: c, tone: ToneClass.UNKNOWN, rhyme: null, isRhymeWord, ambiguous: false };
    }
    if (entry.isRushu) {
      if (entry.modernTone >= 1 && entry.modernTone <= 2) {
        addIfAbsent(notes, `「${c}」为入声字（今读平声，按仄计）`);
      } else {
        addIfAbsent(notes, `「${c}」为入声字（诗韵新编判仄声）`);
      }
    }
    return {
      char: c,
      tone: entry.toneClass,
      rhyme: entry.rhyme,
      isRhymeWord,
      ambiguous: entry.ambiguous,
    };
  }
}
