// 渲染整首诗的平仄记号与韵脚标注（与 Kotlin AnnotatedPoemView.kt 对应）

import { ToneClass } from '../engine/model.js';
import { PUNCTUATION } from '../engine/text-splitter.js';
import { el } from './dom.js';

/** 平仄记号样式：〇● 或 平仄 */
export const MarkStyle = Object.freeze({ SYMBOL: 'SYMBOL', TEXT: 'TEXT' });

function badgeSize(fontSize) {
  return fontSize * 0.78;
}

/** 醒目的平仄标记：彩色圆底 + 标记（平=石青空心圆，仄=朱砂实心圆） */
export function toneBadge(tone, style, fontSize) {
  const badge = el('span', { class: 'tone-badge tone-' + tone.toLowerCase() });
  badge.style.setProperty('--badge-size', badgeSize(fontSize) + 'px');
  if (style === MarkStyle.SYMBOL && tone !== ToneClass.UNKNOWN) {
    badge.append(el('span', { class: 'tone-dot ' + (tone === ToneClass.LEVEL ? 'is-level' : 'is-oblique') }));
  } else {
    const text = tone === ToneClass.LEVEL
      ? (style === MarkStyle.SYMBOL ? '〇' : '平')
      : tone === ToneClass.OBLIQUE
        ? (style === MarkStyle.SYMBOL ? '●' : '仄')
        : '？';
    badge.append(el('span', { class: 'tone-glyph', text, style: { fontSize: (fontSize * 0.52).toFixed(1) + 'px' } }));
  }
  return badge;
}

function renderChar(meta, opts) {
  const rhymed = opts.showRhyme && meta.isRhymeWord && !PUNCTUATION.has(meta.char);
  const ch = el('span', { class: 'char' + (rhymed ? ' rhymed' : ''), text: meta.char });
  ch.style.fontSize = opts.fontSize + 'px';
  return ch;
}

function renderLine(line, opts) {
  const rhyme = opts.showRhyme
    ? line.chars.find((meta) => meta.isRhymeWord && meta.rhyme != null)
    : null;
  const row = el('div', { class: 'poem-line' });
  for (const meta of line.chars) {
    const col = el('span', { class: 'poem-char' });
    if (opts.showTone && !PUNCTUATION.has(meta.char)) {
      col.append(toneBadge(meta.tone, opts.markStyle, opts.fontSize));
    } else {
      const spacer = el('span', { class: 'tone-badge tone-spacer' });
      spacer.style.setProperty('--badge-size', badgeSize(opts.fontSize) + 'px');
      col.append(spacer);
    }
    col.append(renderChar(meta, opts));
    row.append(col);
  }
  if (rhyme) {
    const label = el('span', { class: 'rhyme-label', text: `[${rhyme.rhyme}]` });
    label.style.fontSize = (opts.fontSize * 0.5).toFixed(1) + 'px';
    label.style.marginTop = badgeSize(opts.fontSize) + 'px';
    row.append(label);
  }
  return row;
}

/**
 * 渲染整首诗。
 * @param {object} annotated AnnotatedPoem
 * @param {object} opts { showTone, showRhyme, markStyle, fontSize, issueLines?:Set<number> }
 */
export function renderAnnotatedPoem(annotated, opts) {
  const wrap = el('div', { class: 'poem-body' });
  annotated.lines.forEach((line, index) => {
    if (opts.issueLines && opts.issueLines.has(index)) {
      const box = el('div', { class: 'poem-line-issue' });
      const warn = el('span', { class: 'issue-warn', text: '⚠' });
      warn.style.fontSize = (opts.fontSize * 0.9).toFixed(1) + 'px';
      box.append(warn, renderLine(line, opts));
      wrap.append(box);
    } else {
      wrap.append(renderLine(line, opts));
    }
  });
  return wrap;
}

/** 平仄记号图例 */
export function toneLegend(markStyle, showRhyme) {
  const wrap = el('div', { class: 'tone-legend' });
  wrap.append(el('div', { class: 'legend-title', text: '平仄标记说明' }));
  const row = el('div', { class: 'legend-row' });
  const item = (tone, label) => el('span', { class: 'legend-item' },
    toneBadge(tone, markStyle, 16),
    el('span', { class: 'legend-label', text: label }),
  );
  row.append(item(ToneClass.LEVEL, '平声'), item(ToneClass.OBLIQUE, '仄声'), item(ToneClass.UNKNOWN, '待考'));
  wrap.append(row);
  if (showRhyme) {
    wrap.append(el('div', { class: 'legend-note', text: '韵脚字以朱砂圈注，并标注《诗韵新编》韵部（如［七齐］）' }));
  }
  return wrap;
}
