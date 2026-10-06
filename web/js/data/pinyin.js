// 拼音工具：标题/作者首字母（大写），用于书架按首字母排序。
// 数据来自《诗韵新编》字典（kxhc1983 首读音），与 Android 端 pinyin4j 行为一致。
import { isHanzi } from '../engine/model.js';

export function firstLetters(text, dictionary) {
  let out = '';
  for (const ch of Array.from(text || '')) {
    const letter = dictionary.firstLetter(ch);
    if (letter) {
      out += letter;
    } else if (isHanzi(ch)) {
      // 字典未收录的汉字：无法取拼音，退化为原字（排序时不至于丢失）
      out += ch.toUpperCase();
    } else {
      out += ch.toUpperCase();
    }
  }
  return out;
}
