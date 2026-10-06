// 引擎一致性测试：把 Kotlin :engine 的单元测试用例移植到 JS 端口，验证行为一致。
// 运行：node web/tools/engine-test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ToneClass } from '../js/engine/model.js';
import { cleanInput, splitSentences } from '../js/engine/text-splitter.js';
import { ShiYunXinBianDictionary, canonicalize } from '../js/engine/dictionary.js';
import { PingZeEngine } from '../js/engine/pingze-engine.js';
import { IssueType, PingZeChecker } from '../js/engine/pingze-checker.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const kxhc = readFileSync(join(root, 'data/kxhc1983.txt'), 'utf8');
const rushu = readFileSync(join(root, 'data/rushu.txt'), 'utf8');

const dict = ShiYunXinBianDictionary.build(kxhc, rushu);
const engine = new PingZeEngine(dict);

let passed = 0;
let failed = 0;
const failures = [];

function eq(actual, expected, label) {
  if (actual === expected) { passed++; return; }
  failed++;
  failures.push(`${label}\n    期望: ${JSON.stringify(expected)}\n    实际: ${JSON.stringify(actual)}`);
}
function ok(cond, label) {
  if (cond) { passed++; return; }
  failed++;
  failures.push(label);
}

function entry(ch, label) {
  const e = dict.lookup(ch);
  ok(e != null, `${label}: 「${ch}」应在字典中`);
  return e;
}

// ── TextSplitter ───────────────────────────────────────────
{
  const lines = splitSentences('床前明月光，疑是地上霜。举头望明月，低头思故乡。');
  eq(lines.length, 4, 'split: 句数');
  eq(lines[0], '床前明月光，', 'split: 首句');
  eq(lines[3], '低头思故乡。', 'split: 末句');
  eq(splitSentences('白日依山尽，黄河入海流。欲穷千里目').length, 3, 'split: 无尾标点');
  eq(splitSentences('  ').length, 0, 'split: 空白');
}

// ── 字典 ───────────────────────────────────────────────────
{
  eq(entry('光', 'rhyme').rhyme, '十六唐', 'rhyme 光');
  eq(entry('前', 'rhyme').rhyme, '十四寒', 'rhyme 前');
  eq(entry('月', 'rhyme').rhyme, '四皆', 'rhyme 月');
  eq(entry('语', 'rhyme').rhyme, '十一鱼', 'rhyme 语');
  eq(entry('思', 'rhyme').rhyme, '五支', 'rhyme 思');
  eq(entry('日', 'rhyme').rhyme, '五支', 'rhyme 日');
  eq(entry('乡', 'rhyme').rhyme, '十六唐', 'rhyme 乡');
  eq(entry('宫', 'rhyme').rhyme, '十八东', 'rhyme 宫');
  eq(entry('楼', 'rhyme').rhyme, '十二侯', 'rhyme 楼');

  eq(entry('光', 'tone').toneClass, ToneClass.LEVEL, 'tone 光');
  eq(entry('前', 'tone').toneClass, ToneClass.LEVEL, 'tone 前');
  eq(entry('是', 'tone').toneClass, ToneClass.OBLIQUE, 'tone 是');
  eq(entry('上', 'tone').toneClass, ToneClass.OBLIQUE, 'tone 上');

  for (const ch of ['白', '日', '月', '入', '目', '急', '雪']) {
    const e = entry(ch, 'rushu');
    ok(e.isRushu, `rushu: 「${ch}」应为入声`);
    eq(e.toneClass, ToneClass.OBLIQUE, `rushu: 「${ch}」仄`);
  }

  ok(entry('上', 'amb').ambiguous, 'ambiguous 上 = true');
  ok(!entry('前', 'amb').ambiguous, 'ambiguous 前 = false');

  eq(canonicalize('yue'), 'üe', 'canon yue');
  eq(canonicalize('yuan'), 'üan', 'canon yuan');
  eq(canonicalize('yun'), 'ün', 'canon yun');
  eq(canonicalize('ju'), 'jü', 'canon ju');
  eq(canonicalize('lü'), 'lü', 'canon lü');
  eq(canonicalize('weng'), 'ueng', 'canon weng');
  eq(canonicalize('yong'), 'iong', 'canon yong');
  eq(canonicalize('qiu'), 'qiou', 'canon qiu');
  eq(canonicalize('liu'), 'liou', 'canon liu');
  eq(canonicalize('hui'), 'huei', 'canon hui');
  eq(canonicalize('shui'), 'shuei', 'canon shui');
  eq(canonicalize('chun'), 'chuen', 'canon chun');
  eq(canonicalize('xun'), 'xün', 'canon xun');

  eq(entry('秋', 'shorthand').rhyme, '十二侯', 'rhyme 秋');
  eq(entry('流', 'shorthand').rhyme, '十二侯', 'rhyme 流');
  eq(entry('回', 'shorthand').rhyme, '八微', 'rhyme 回');
  eq(entry('水', 'shorthand').rhyme, '八微', 'rhyme 水');
  eq(entry('春', 'shorthand').rhyme, '十五痕', 'rhyme 春');
  eq(entry('问', 'shorthand').rhyme, '十五痕', 'rhyme 问');
}

// ── 拼音首字母（书架排序） ─────────────────────────────────
{
  eq(dict.firstLetter('一'), 'Y', 'pinyin 一');
  eq(dict.firstLetter('静'), 'J', 'pinyin 静');
  eq(dict.firstLetter('望'), 'W', 'pinyin 望');
  eq(dict.firstLetter('山'), 'S', 'pinyin 山');
  eq(dict.firstLetter('二'), 'E', 'pinyin 二');
  eq(dict.firstLetter('月'), 'Y', 'pinyin 月');
  eq(dict.firstLetter('五'), 'W', 'pinyin 五');
  eq(dict.firstLetter('杜'), 'D', 'pinyin 杜');
  eq(dict.firstLetter('春'), 'C', 'pinyin 春');
}

// ── 标注引擎 ───────────────────────────────────────────────
{
  const poem = engine.annotatePoem(1, '五言绝句', '床前明月光，疑是地上霜。举头望明月，低头思故乡。');
  eq(poem.lines.length, 4, 'annotate 静夜思: 句数');
  const guang = poem.lines[0].chars.find((c) => c.char === '光');
  ok(guang.isRhymeWord, '静夜思: 光为韵脚');
  eq(guang.tone, ToneClass.LEVEL, '静夜思: 光平');
  eq(guang.rhyme, '十六唐', '静夜思: 光韵部');
  const shuang = poem.lines[1].chars.find((c) => c.char === '霜');
  ok(shuang.isRhymeWord, '静夜思: 霜为韵脚');
  eq(shuang.rhyme, '十六唐', '静夜思: 霜韵部');
  const yue = poem.lines[2].chars.find((c) => c.char === '月');
  ok(yue.isRhymeWord, '静夜思: 月为韵脚');
  eq(yue.tone, ToneClass.OBLIQUE, '静夜思: 月仄');
  eq(yue.rhyme, '四皆', '静夜思: 月韵部');
  ok(poem.annotations.some((n) => n.includes('入声')), '静夜思: 有入声注释');

  const p2 = engine.annotatePoem(2, '五言绝句', '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。');
  eq(p2.lines[0].chars.find((c) => c.char === '白').tone, ToneClass.OBLIQUE, '登鹳雀楼: 白仄');
  const mu = p2.lines[2].chars.find((c) => c.char === '目');
  ok(mu.isRhymeWord, '登鹳雀楼: 目为韵脚');
  eq(mu.tone, ToneClass.OBLIQUE, '登鹳雀楼: 目仄');
  const lou = p2.lines[3].chars.find((c) => c.char === '楼');
  ok(lou.isRhymeWord, '登鹳雀楼: 楼为韵脚');
  eq(lou.tone, ToneClass.LEVEL, '登鹳雀楼: 楼平');
  eq(lou.rhyme, '十二侯', '登鹳雀楼: 楼韵部');

  // 字典未收录的增补平面字 → 待考
  const p3 = engine.annotatePoem(3, '五绝', '床前明\u{20000}光。');
  const weird = p3.lines[0].chars.find((c) => c.char.codePointAt(0) === 0x20000);
  eq(weird.tone, ToneClass.UNKNOWN, '未知字: 待考');
  ok(p3.annotations.some((n) => n.includes('待考')), '未知字: 有待考注释');
}

// ── 文本清洗 ───────────────────────────────────────────────
{
  const raw = '遥望长城意气豪，风云激越浪滔滔。\n 雁鸿东返栖湖泊，骐骥西来适枥槽。\t 家国兴荣一任重，算筹玄妙亦功高。\u3000廉颇老矣丹心在，愿请长缨助战鏖。';
  eq(cleanInput(raw), '遥望长城意气豪，风云激越浪滔滔。雁鸿东返栖湖泊，骐骥西来适枥槽。家国兴荣一任重，算筹玄妙亦功高。廉颇老矣丹心在，愿请长缨助战鏖。', 'cleanInput 空白/控制符');
  eq(cleanInput('\uFEFF雁\u200B鸿\u200D东返栖湖泊'), '雁鸿东返栖湖泊', 'cleanInput 零宽/BOM');
  eq(cleanInput(''), '', 'cleanInput 空');
  eq(cleanInput(' \n\t\u3000'), '', 'cleanInput 纯空白');
}

// ── 格律检测 ───────────────────────────────────────────────
const L = ToneClass.LEVEL, OB = ToneClass.OBLIQUE, UNK = ToneClass.UNKNOWN;

function buildPoem(lineTones, rhymes = null) {
  return {
    poemId: 0,
    form: '五言绝句',
    lines: lineTones.map((tones, li) => ({
      text: '',
      chars: tones.map((t, ci) => ({
        char: String.fromCodePoint(0x7532 + li * 10 + ci),
        tone: t,
        rhyme: rhymes ? rhymes[li] : null,
        isRhymeWord: ci === tones.length - 1,
        ambiguous: false,
      })),
    })),
  };
}

{
  eq(PingZeChecker.detectForm('床前明月光，疑是地上霜。举头望明月，低头思故乡。'), '五言绝句', 'detect 五绝');
  eq(PingZeChecker.detectForm('国破山河在，城春草木深。感时花溅泪，恨别鸟惊心。烽火连三月，家书抵万金。白头搔更短，浑欲不胜簪。'), '五言律诗', 'detect 五律');
  eq(PingZeChecker.detectForm('朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。'), '七言绝句', 'detect 七绝');
  eq(PingZeChecker.detectForm('风急天高猿啸哀，渚清沙白鸟飞回。无边落木萧萧下，不尽长江滚滚来。万里悲秋常作客，百年多病独登台。艰难苦恨繁霜鬓，潦倒新停浊酒杯。'), '七言律诗', 'detect 七律');
  eq(PingZeChecker.detectForm('春花秋月何时了？往事知多少。'), null, 'detect 词 null');
  eq(PingZeChecker.detectForm('床前明月光'), null, 'detect 单句 null');
  eq(PingZeChecker.detectForm(''), null, 'detect 空 null');
}

{
  const good = buildPoem([
    [OB, OB, L, L, OB],
    [L, L, OB, OB, L],
    [L, L, L, OB, OB],
    [OB, OB, OB, L, L],
  ]);
  eq(PingZeChecker.check(good).length, 0, 'check 正确五绝无问题');

  const lonely = buildPoem([
    [OB, OB, L, L, OB],
    [OB, L, OB, OB, L],
    [L, L, L, OB, OB],
    [OB, OB, OB, L, L],
  ]);
  const lonelyIssue = PingZeChecker.check(lonely).find((i) => i.type === IssueType.LONELY_LEVEL);
  ok(lonelyIssue && lonelyIssue.lineIndex === 1, 'check 孤平 lineIndex=1');

  const tripleLevel = buildPoem([
    [OB, OB, L, L, OB],
    [L, L, OB, OB, L],
    [OB, OB, L, L, L],
    [OB, OB, OB, L, L],
  ]);
  ok(PingZeChecker.check(tripleLevel).some((i) => i.type === IssueType.TRIPLE_LEVEL_TAIL), 'check 三平尾');

  const tripleOblique = buildPoem([
    [OB, OB, L, L, OB],
    [L, L, OB, OB, L],
    [L, L, L, OB, OB],
    [L, L, OB, OB, OB],
  ]);
  ok(PingZeChecker.check(tripleOblique).some((i) => i.type === IssueType.TRIPLE_OBLIQUE_TAIL), 'check 三仄尾');

  const mismatch = buildPoem([
    [L, L, OB, OB, L],
    [L, L, OB, OB, L],
    [L, L, L, OB, OB],
    [OB, OB, OB, L, L],
  ]);
  ok(PingZeChecker.check(mismatch).some((i) => i.type === IssueType.MISMATCH_IN_COUPLET), 'check 失对');

  const sticky = buildPoem([
    [OB, OB, L, L, OB],
    [L, L, OB, OB, L],
    [OB, OB, L, L, OB],
    [L, L, OB, OB, L],
  ]);
  ok(PingZeChecker.check(sticky).some((i) => i.type === IssueType.MISMATCH_BETWEEN_COUPLETS), 'check 失粘');

  const rhymePoem = buildPoem([
    [OB, OB, L, L, OB],
    [L, L, OB, OB, L],
    [L, L, L, OB, OB],
    [OB, OB, OB, L, L],
  ], ['十二侯', '十二侯', '十二侯', '十六唐']);
  const rhymeIssues = PingZeChecker.check(rhymePoem).filter((i) => i.type === IssueType.RHYME_MISMATCH);
  eq(rhymeIssues.length, 1, 'check 出韵 1 条');
  eq(rhymeIssues[0].lineIndex, 3, 'check 出韵 lineIndex=3');

  const unknown = buildPoem([
    [OB, OB, UNK, L, OB],
    [L, L, OB, OB, L],
    [L, L, L, OB, OB],
    [OB, OB, OB, L, L],
  ]);
  ok(!PingZeChecker.check(unknown).some((i) =>
    i.type === IssueType.MISMATCH_IN_COUPLET || i.type === IssueType.MISMATCH_BETWEEN_COUPLETS), 'check UNKNOWN 跳过对位');
}

// ── 结果 ───────────────────────────────────────────────────
console.log(`\n引擎一致性测试：${passed} 通过, ${failed} 失败\n`);
if (failed > 0) {
  for (const f of failures) console.log('  ✗ ' + f);
  process.exit(1);
}
console.log('全部通过 ✓');
