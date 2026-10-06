// 习作格律检测页（与 Kotlin PoemCheckScreen.kt / PoemCheckViewModel.kt 对应）

import { cleanInput } from '../engine/text-splitter.js';
import { IssueType, PingZeChecker } from '../engine/pingze-checker.js';
import { ToneClass, isHanzi } from '../engine/model.js';
import { MarkStyle, renderAnnotatedPoem } from './annotated-poem-view.js';
import { el, icon, toast } from './dom.js';

function analyze(text, app) {
  const form = PingZeChecker.detectForm(text);
  const annotated = app.engine.annotatePoem(0, form || '古体', text);
  const issues = form ? PingZeChecker.check(annotated) : [];
  const unknownCount = annotated.lines.reduce((sum, line) =>
    sum + line.chars.filter((c) => c.tone === ToneClass.UNKNOWN && isHanzi(c.char)).length, 0);
  const issueLines = new Set();
  for (const issue of issues) {
    if (issue.type === IssueType.MISMATCH_IN_COUPLET || issue.type === IssueType.MISMATCH_BETWEEN_COUPLETS) {
      issueLines.add(issue.lineIndex);
      issueLines.add(issue.lineIndex + 1);
    } else {
      issueLines.add(issue.lineIndex);
    }
  }
  for (const idx of [...issueLines]) {
    if (idx < 0 || idx >= annotated.lines.length) issueLines.delete(idx);
  }
  return { form, annotated, issues, unknownCount, issueLines, analyzed: true };
}

export function mountCheck(root, app) {
  root.classList.add('view-check');

  const input = el('textarea', {
    class: 'check-input',
    rows: '6',
    placeholder: '粘贴你的诗作（支持五绝/七绝/五律/七律，请用 ，。 断句）',
    spellcheck: 'false',
  });
  input.addEventListener('input', () => {
    const cleaned = cleanInput(input.value);
    if (cleaned !== input.value) {
      const pos = input.selectionStart;
      input.value = cleaned;
      input.setSelectionRange(Math.min(pos, cleaned.length), Math.min(pos, cleaned.length));
    }
  });

  const analyzeBtn = el('button', { class: 'btn btn-primary btn-block' }, icon('edit', 18), '分析');
  const resultEl = el('div', { class: 'check-result' });

  const card = el('section', { class: 'check-card' },
    el('h2', { class: 'check-heading', text: '习作格律检测' }),
    el('p', { class: 'check-hint', text: '自动识别近体诗体裁（五绝/七绝/五律/七律），检测孤平、三平尾、三仄尾、失对、失粘、出韵。' }),
    input,
    analyzeBtn,
  );
  root.replaceChildren(card, resultEl);

  analyzeBtn.addEventListener('click', () => {
    const text = cleanInput(input.value);
    if (!text.trim()) {
      toast('请先输入诗作');
      return;
    }
    renderResult(analyze(text, app));
  });

  function renderResult(state) {
    if (!state) { resultEl.replaceChildren(); return; }
    const { form, annotated, issues, unknownCount, issueLines } = state;

    const meta = el('p', {
      class: 'check-form',
      text: form ? `体裁：${form}` : '该作品非近体诗，仅展示平仄与韵脚',
    });

    const body = renderAnnotatedPoem(annotated, {
      showTone: true,
      showRhyme: true,
      markStyle: MarkStyle.SYMBOL,
      fontSize: 20,
      issueLines,
    });

    const result = el('div', { class: 'check-output' }, meta, body);

    if (form) {
      const list = el('div', { class: 'issue-list' });
      if (issues.length === 0) {
        list.append(el('p', { class: 'issue-none', text: '✓ 未发现格律问题' }));
      } else {
        list.append(el('h3', { class: 'issue-title', text: '格律提示' }));
        for (const issue of issues) {
          list.append(el('p', { class: 'issue-item', text: `• ${issue.message}` }));
        }
      }
      if (unknownCount > 0) {
        list.append(el('p', { class: 'issue-unknown', text: `另有 ${unknownCount} 字无法判定平仄（待考，未作判断）` }));
      }
      result.append(list);
    } else if (unknownCount > 0) {
      result.append(el('p', { class: 'issue-unknown', text: `另有 ${unknownCount} 字无法判定平仄（待考，未作判断）` }));
    }

    resultEl.replaceChildren(result);
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
