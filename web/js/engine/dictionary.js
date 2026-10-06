// 《诗韵新编》字典（与 Kotlin ShiYunXinBianDictionary.kt 对应）
//
// 数据来源：
// - kxhc1983.txt：新华字典 1983 拼音（带声调）字表（mozillazg/pinyin-data）
// - rushu.txt：入声字表（取自平水韵入声十七韵的并集）
//
// 平仄判定：阴平(1)/阳平(2) → 平；上(3)/去(4) → 仄；入声字 → 仄；
// 韵部判定：按普通话韵母映射到《诗韵新编》十八韵。

import { ToneClass } from './model.js';

const TONE_MARKS = {
  'ā': ['a', 1], 'á': ['a', 2], 'ǎ': ['a', 3], 'à': ['a', 4],
  'ē': ['e', 1], 'é': ['e', 2], 'ě': ['e', 3], 'è': ['e', 4],
  'ī': ['i', 1], 'í': ['i', 2], 'ǐ': ['i', 3], 'ì': ['i', 4],
  'ō': ['o', 1], 'ó': ['o', 2], 'ǒ': ['o', 3], 'ò': ['o', 4],
  'ū': ['u', 1], 'ú': ['u', 2], 'ǔ': ['u', 3], 'ù': ['u', 4],
  'ǖ': ['ü', 1], 'ǘ': ['ü', 2], 'ǚ': ['ü', 3], 'ǜ': ['ü', 4],
};

// 五支韵：zhi/chi/shi/ri/zi/ci/si 的 "i" 是舌尖元音，独立成韵
const ZHI_CHI_SHI_RI = new Set(['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si']);

// 多音字在诗词语境中的常用读音（kXHC1983 首读音可能不适合诗词）
const POETRY_OVERRIDES = {
  '思': 'sī',   // 低头思故乡（sāi 是"于思"义）
  '更': 'gèng', // 更上一层楼（去声）
  '觉': 'jué',  // 春眠不觉晓（入声）
  '雀': 'què',  // 登鹳雀楼（入声）
  '还': 'huán', // 还乡
  '行': 'xíng',
  '长': 'cháng',
  '重': 'chóng',
  '中': 'zhōng',
  '空': 'kōng',
  '朝': 'zhāo',
  '看': 'kān',
  '应': 'yīng',
  '兴': 'xīng',
  '分': 'fēn',
  '当': 'dāng',
  '相': 'xiāng',
  '将': 'jiāng',
  '为': 'wéi',
  '间': 'jiān',
  '教': 'jiāo',
  '曲': 'qū',
  '绿': 'lǜ',
  '调': 'tiáo',
  '胜': 'shèng',
  '处': 'chù',
  '地': 'dì',   // 地上/天地读 dì（去声）
  '育': 'yù',   // 养育/孕育读 yù
  '不': 'bù',   // 规范读 bù（去声）；kXHC 首选 bú 是变调
  '过': 'guò',  // 轻舟已过读 guò（去声）
};

const INITIALS = ['zh', 'ch', 'sh', ...'bpmfdtnlgkhjqxrzcs'];

const KXHC_LINE = /^U\+([0-9A-Fa-f]+):\s*(\S+)\s*#\s*\S+$/;

/** 去声调符号，返回 { syllable, tone }；tone 0 = 轻声/无调 */
export function normalizeReading(raw) {
  let tone = 0;
  let sb = '';
  for (const c of raw) {
    const t = TONE_MARKS[c];
    if (t) {
      sb += t[0];
      if (tone === 0) tone = t[1];
    } else {
      sb += c;
    }
  }
  return { syllable: canonicalize(sb), tone };
}

/** y/w 首转换为元音等价形式；j/q/x/u 与 y+u 的 u 视为 ü */
export function canonicalize(s) {
  if (s.startsWith('yuan')) return 'üan' + s.slice(4);
  if (s.startsWith('yue')) return 'üe' + s.slice(3);
  if (s.startsWith('yun')) return 'ün' + s.slice(3);
  if (s.startsWith('yu')) return 'ü' + s.slice(2);
  if (s.startsWith('ying')) return 'ing' + s.slice(4);
  if (s.startsWith('yin')) return 'in' + s.slice(3);
  if (s.startsWith('yi')) return 'i' + s.slice(2);
  if (s.startsWith('yong')) return 'iong' + s.slice(4);
  if (s.startsWith('you')) return 'iou' + s.slice(3);
  if (s.startsWith('yang')) return 'iang' + s.slice(4);
  if (s.startsWith('yan')) return 'ian' + s.slice(3);
  if (s.startsWith('yao')) return 'iao' + s.slice(3);
  if (s.startsWith('ya')) return 'ia' + s.slice(2);
  if (s.startsWith('ye')) return 'ie' + s.slice(2);
  if (s.startsWith('weng')) return 'ueng' + s.slice(4);
  if (s.startsWith('wang')) return 'uang' + s.slice(4);
  if (s.startsWith('wan')) return 'uan' + s.slice(3);
  if (s.startsWith('wai')) return 'uai' + s.slice(3);
  if (s.startsWith('wen')) return 'uen' + s.slice(3);
  if (s.startsWith('wei')) return 'uei' + s.slice(3);
  if (s.startsWith('wo')) return 'uo' + s.slice(2);
  if (s.startsWith('wa')) return 'ua' + s.slice(2);
  if (s.startsWith('wu')) return 'u' + s.slice(2);
  if (s[0] === 'j' && s[1] === 'u') return 'jü' + s.slice(2);
  if (s[0] === 'q' && s[1] === 'u') return 'qü' + s.slice(2);
  if (s[0] === 'x' && s[1] === 'u') return 'xü' + s.slice(2);
  // 声母后的拼音简写：iu→iou（十二侯）、ui→uei（八微）、un→uen（十五痕）
  if (s.length > 2 && s.endsWith('iu')) return s.slice(0, -2) + 'iou';
  if (s.length > 2 && s.endsWith('ui')) return s.slice(0, -2) + 'uei';
  if (s.length > 2 && s.endsWith('un')) return s.slice(0, -2) + 'uen';
  return s;
}

/** 声母剥离后映射韵部 */
export function rhymeGroup(syllable) {
  if (ZHI_CHI_SHI_RI.has(syllable)) return '五支';
  const final = stripInitial(syllable);
  switch (final) {
    case 'a': case 'ia': case 'ua': return '一麻';
    case 'o': case 'uo': return '二波';
    case 'yo': return '二波'; // 语气词"哟 yō"，近似归二波，避免韵部缺失
    case 'e': return '三歌';
    case 'ie': case 'üe': return '四皆';
    case 'i': return '七齐';
    case 'er': return '六儿';
    case 'ei': case 'uei': return '八微';
    case 'ai': case 'uai': return '九开';
    case 'u': return '十姑';
    case 'ü': return '十一鱼';
    case 'ou': case 'iou': return '十二侯';
    case 'ao': case 'iao': return '十三豪';
    case 'an': case 'ian': case 'uan': case 'üan': return '十四寒';
    case 'en': case 'in': case 'uen': case 'ün': return '十五痕';
    case 'ang': case 'iang': case 'uang': return '十六唐';
    case 'eng': case 'ing': case 'ueng': return '十七庚';
    case 'ong': case 'iong': return '十八东';
    default: return null;
  }
}

function stripInitial(syllable) {
  for (const initial of INITIALS) {
    if (syllable.length > initial.length && syllable.startsWith(initial)) {
      return syllable.slice(initial.length);
    }
  }
  return syllable;
}

/** 从原始读音（含声调）取拼音首字母，如 "yī"→"Y"、"zhòu"→"Z" */
function initialOfReading(raw) {
  if (!raw) return null;
  const c = raw[0];
  const base = TONE_MARKS[c] ? TONE_MARKS[c][0][0] : c;
  return base === 'ü' ? 'Y' : base.toUpperCase();
}

export class ShiYunXinBianDictionary {
  constructor(entries, rushuSet) {
    this.entries = entries;
    this.rushuSet = rushuSet;
  }

  lookup(char) {
    const entry = this.entries.get(char);
    if (!entry) return null;
    const isRushu = this.rushuSet.has(char);
    const toneClass = isRushu
      ? ToneClass.OBLIQUE
      : (entry.tone === 0 || entry.tone <= 2) ? ToneClass.LEVEL : ToneClass.OBLIQUE;
    return {
      toneClass,
      rhyme: entry.rhyme,
      isRushu,
      ambiguous: entry.ambiguous,
      modernTone: entry.tone,
    };
  }

  /** 首字母（大写）用于书架排序；未收录返回 null */
  firstLetter(char) {
    const entry = this.entries.get(char);
    return entry && entry.initial ? entry.initial : null;
  }

  static build(kxhcText, rushuText) {
    const rushuSet = new Set(Array.from(rushuText).filter((c) => !/\s/u.test(c)));

    const entries = new Map();
    for (const rawLine of kxhcText.split('\n')) {
      const m = KXHC_LINE.exec(rawLine.trim());
      if (!m) continue;
      const char = String.fromCodePoint(parseInt(m[1], 16));
      const readings = m[2].split(',');
      const { syllable, tone } = normalizeReading(readings[0]);
      entries.set(char, {
        tone,
        rhyme: rhymeGroup(syllable),
        ambiguous: readings.length > 1,
        initial: initialOfReading(readings[0]),
      });
    }
    for (const [char, reading] of Object.entries(POETRY_OVERRIDES)) {
      const { syllable, tone } = normalizeReading(reading);
      entries.set(char, {
        tone,
        rhyme: rhymeGroup(syllable),
        ambiguous: true,
        initial: initialOfReading(reading),
      });
    }
    return new ShiYunXinBianDictionary(entries, rushuSet);
  }

  static async fromUrls(kxhcUrl, rushuUrl) {
    const [kxhcRes, rushuRes] = await Promise.all([fetch(kxhcUrl), fetch(rushuUrl)]);
    if (!kxhcRes.ok) throw new Error(`字典加载失败：${kxhcUrl} (${kxhcRes.status})`);
    if (!rushuRes.ok) throw new Error(`入声表加载失败：${rushuUrl} (${rushuRes.status})`);
    const [kxhcText, rushuText] = await Promise.all([kxhcRes.text(), rushuRes.text()]);
    return ShiYunXinBianDictionary.build(kxhcText, rushuText);
  }
}
