// 阅读页（与 Kotlin ReaderScreen.kt / ReaderViewModel.kt 对应）
// 逐字平仄 + 韵脚圈注 + 设置面板（Web 端用右侧抽屉）。

import { splitSentences } from '../engine/text-splitter.js';
import { MarkStyle, renderAnnotatedPoem, toneLegend } from './annotated-poem-view.js';
import { saveSettings } from '../data/settings.js';
import { el, icon } from './dom.js';

function renderBody(poem, app) {
  const s = app.settings;
  if (poem.annotation) {
    return renderAnnotatedPoem(poem.annotation, {
      showTone: s.showTone,
      showRhyme: s.showRhyme,
      markStyle: s.markStyle,
      fontSize: s.fontSize,
    });
  }
  // 标注缺失时的兜底：纯文本
  const col = el('div', { class: 'plain-poem' });
  for (const line of splitSentences(poem.contentText)) {
    col.append(el('p', {
      class: 'plain-line',
      text: line,
      style: {
        fontSize: s.fontSize + 'px',
        lineHeight: (s.fontSize * 1.8).toFixed(1) + 'px',
        letterSpacing: '4px',
      },
    }));
  }
  return col;
}

function renderNotes(poem, app) {
  const s = app.settings;
  const notes = (poem.annotation && poem.annotation.annotations) || [];
  if (!s.showTone && notes.length === 0) return null;
  const wrap = el('div', { class: 'reader-notes' });
  if (s.showTone) wrap.append(toneLegend(s.markStyle, s.showRhyme));
  if (notes.length > 0) {
    wrap.append(el('h4', { class: 'notes-title', text: '标注说明' }));
    notes.forEach((note) => wrap.append(el('p', { class: 'note', text: note })));
  }
  return wrap;
}

function switchRow(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', class: 'switch' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'setting-row' }, el('span', { text: label }), input);
}

function buildSettingsPanel(app, onChange, onClose) {
  const s = app.settings;
  const panel = el('aside', { class: 'settings-panel', 'aria-label': '阅读设置' });
  const head = el('div', { class: 'settings-head' },
    el('h3', { text: '阅读设置' }),
    el('button', { class: 'icon-btn', 'aria-label': '关闭', onclick: onClose }, icon('close', 20)),
  );

  const chips = el('div', { class: 'chip-row' });
  const chip = (label, value) => el('button', {
    class: 'chip' + (s.markStyle === value ? ' selected' : ''),
    onclick: () => { s.markStyle = value; saveSettings(s); onChange(); },
  }, label);
  chips.append(chip('〇 ●', MarkStyle.SYMBOL), chip('平 仄', MarkStyle.TEXT));

  const slider = el('input', { type: 'range', class: 'slider', min: '18', max: '34', step: '1' });
  slider.value = String(s.fontSize);
  const sizeLabel = el('span', { class: 'setting-value', text: `当前 ${Math.round(s.fontSize)}px` });
  slider.addEventListener('input', () => {
    s.fontSize = Number(slider.value);
    sizeLabel.textContent = `当前 ${Math.round(s.fontSize)}px`;
    saveSettings(s);
    onChange();
  });

  panel.append(
    head,
    switchRow('显示平仄', s.showTone, (v) => { s.showTone = v; saveSettings(s); onChange(); }),
    switchRow('显示韵脚', s.showRhyme, (v) => { s.showRhyme = v; saveSettings(s); onChange(); }),
    el('div', { class: 'setting-label', text: '平仄记号样式' }),
    chips,
    el('div', { class: 'setting-label', text: '正文字号' }),
    slider,
    sizeLabel,
    el('div', { class: 'settings-legend' }, toneLegend(s.markStyle, s.showRhyme)),
  );
  return panel;
}

export function mountReader(root, app, poemId) {
  root.classList.add('view-reader');

  const bodyEl = el('div', { class: 'reader-body' });
  let cleanupSub = null;

  const rerender = () => {
    const poem = app.lib.getPoem(poemId);
    bodyEl.replaceChildren();
    if (!poem) {
      bodyEl.append(el('div', { class: 'hint-box' }, el('p', { text: '未找到该诗词' })));
      return;
    }
    const header = el('header', { class: 'reader-header' },
      el('h1', { class: 'reader-title', text: poem.title }),
      el('p', { class: 'reader-meta', text: [poem.dynasty, poem.author, poem.form].filter(Boolean).join(' · ') }),
    );
    const article = el('article', { class: 'reader-article' }, header, renderBody(poem, app));
    const notes = renderNotes(poem, app);
    if (notes) article.append(notes);
    bodyEl.append(article);
  };

  const backBtn = el('button', { class: 'icon-btn', 'aria-label': '返回书架', onclick: () => app.navigate('#/library') }, icon('back', 22));
  const settingsBtn = el('button', { class: 'icon-btn', 'aria-label': '阅读设置' }, icon('settings', 22));
  const topbar = el('div', { class: 'reader-topbar' },
    el('div', { class: 'reader-topbar-left' }, backBtn),
    el('div', { class: 'reader-topbar-right' }, settingsBtn),
  );

  const scrim = el('div', { class: 'settings-scrim' });
  const panel = buildSettingsPanel(app, () => { rerender(); }, () => closeSettings());
  const drawer = el('div', { class: 'settings-drawer' }, panel);
  const closeSettings = () => {
    drawer.classList.remove('open');
    scrim.classList.remove('show');
  };
  settingsBtn.addEventListener('click', () => {
    drawer.classList.add('open');
    scrim.classList.add('show');
  });
  scrim.addEventListener('click', closeSettings);

  root.replaceChildren(topbar, bodyEl, scrim, drawer);

  rerender();
  cleanupSub = app.lib.subscribe(() => rerender());

  const onKey = (e) => { if (e.key === 'Escape') closeSettings(); };
  document.addEventListener('keydown', onKey);

  return () => {
    if (cleanupSub) cleanupSub();
    document.removeEventListener('keydown', onKey);
  };
}
