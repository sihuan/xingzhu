// 添加诗词页（与 Kotlin AddScreen.kt / AddViewModel.kt 对应）
// 语料全文搜索 + 命中片段高亮 + 展开全诗 + 加入书架。

import { el, icon, toast } from './dom.js';

// 模块级缓存：语料只加载一次
let corpus = null;
let corpusError = null;
let loadPromise = null;
let progress = { loaded: 0, total: 8 };

function ensureCorpus(app, onProgress, onDone) {
  if (corpus || corpusError) { onDone(); return; }
  if (!loadPromise) {
    loadPromise = app.lib.loadSearchCorpus((loaded, total) => {
      progress = { loaded, total };
      onProgress();
    })
      .then((items) => { corpus = items; })
      .catch((err) => { corpusError = err.message || String(err); })
      .finally(() => onDone());
  }
}

/** 取正文首句作为预览（无标点时截取前 40 字） */
function contentPreview(content) {
  let cut = -1;
  for (const ch of '。！？；') {
    const idx = content.indexOf(ch);
    if (idx >= 0 && (cut < 0 || idx < cut)) cut = idx;
  }
  const end = cut >= 0 ? cut + 1 : Math.min(content.length, 40);
  return content.slice(0, end);
}

/** 取正文中首次命中关键词附近的片段 */
function matchedSnippet(content, query) {
  const q = query.trim();
  if (!q) return null;
  const idx = content.indexOf(q);
  if (idx < 0) return null;
  const start = Math.max(idx - 10, 0);
  const end = Math.min(idx + q.length + 10, content.length);
  return content.slice(start, end);
}

/** 高亮片段中的关键词，返回 DocumentFragment */
function highlightFragment(text, keyword) {
  const frag = document.createDocumentFragment();
  if (!keyword) { frag.append(text); return frag; }
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf(keyword, i);
    if (idx < 0) { frag.append(text.slice(i)); break; }
    frag.append(text.slice(i, idx));
    frag.append(el('mark', { text: keyword }));
    i = idx + keyword.length;
  }
  return frag;
}

function metaText(seed) {
  return [seed.dynasty, seed.author, seed.form && seed.form.trim() ? seed.form : null]
    .filter(Boolean).join(' · ');
}

export function mountAdd(root, app) {
  root.classList.add('view-add');

  const searchInput = el('input', {
    class: 'search-input',
    type: 'search',
    placeholder: '按题目、作者或全文搜索（诗经至清诗，共 7 万余首）',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const searchBox = el('div', { class: 'search-box' }, icon('search', 20), searchInput);
  const statusLine = el('div', { class: 'corpus-status' });
  const resultsEl = el('div', { class: 'search-results' });

  root.replaceChildren(el('div', { class: 'add-head' }, searchBox, statusLine), resultsEl);

  // 每个结果卡的展开状态
  let results = [];
  const expanded = new Set();
  let query = '';
  let debounceTimer = null;

  const updateStatus = () => {
    if (corpusError) {
      statusLine.replaceChildren(el('span', { class: 'status-error', text: `语料加载失败：${corpusError}` }));
    } else if (!corpus) {
      statusLine.replaceChildren(
        el('span', { class: 'spinner' }),
        el('span', { text: `正在加载语料…（${progress.loaded}/${progress.total}）` }),
      );
    } else {
      statusLine.replaceChildren(el('span', { text: `语料就绪，共 ${corpus.length.toLocaleString('zh-CN')} 首` }));
    }
  };

  const performSearch = () => {
    query = searchInput.value;
    if (!corpus) { results = []; renderResults(); return; }
    const found = app.lib.searchCorpus(query, corpus);
    results = found.map((seed) => ({ seed, inLibrary: app.lib.isInLibrary(seed) }));
    renderResults();
  };

  const onInput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performSearch, 300);
  };
  searchInput.addEventListener('input', onInput);

  function renderResults() {
    if (!corpus && !corpusError) return;
    if (!query.trim()) {
      resultsEl.replaceChildren(el('div', { class: 'hint-box' },
        el('p', { text: '输入题目或作者，从诗经至清诗（7 万余首）中查找' })));
      return;
    }
    if (results.length === 0) {
      resultsEl.replaceChildren(el('div', { class: 'hint-box' }, el('p', { text: '没有找到相关诗词' })));
      return;
    }
    const list = el('div', { class: 'result-list' });
    results.forEach((item, index) => {
      list.append(resultCard(item, index));
    });
    resultsEl.replaceChildren(list);
  }

  function resultCard(item, index) {
    const { seed } = item;
    const isExpanded = expanded.has(index);
    const snippet = matchedSnippet(seed.content, query);
    const body = el('p', { class: 'result-content' });
    if (isExpanded) {
      body.textContent = seed.content;
    } else if (snippet != null) {
      body.append(highlightFragment(snippet, query.trim()));
      body.classList.add('is-snippet');
    } else {
      body.textContent = contentPreview(seed.content);
    }

    const toggle = el('button', {
      class: 'btn btn-text',
      onclick: () => {
        if (expanded.has(index)) expanded.delete(index); else expanded.add(index);
        renderResults();
      },
    }, isExpanded ? '收起' : '展开全诗');

    const action = item.inLibrary
      ? el('span', { class: 'tag-in-library', text: '✓ 已在书架' })
      : el('button', {
        class: 'btn btn-outline',
        onclick: async () => {
          await app.lib.addToLibrary(seed);
          toast(`已加入书架《${seed.title}》`);
        },
      }, '加入书架');

    return el('article', { class: 'result-card' },
      el('div', { class: 'result-head' },
        el('h3', { class: 'result-title', text: seed.title }),
        el('p', { class: 'result-meta', text: metaText(seed) }),
      ),
      body,
      el('div', { class: 'result-actions' }, toggle, action),
    );
  }

  // 书架变化时刷新"已在书架"状态
  const unsubscribe = app.lib.subscribe((poems) => {
    if (!query.trim() || results.length === 0) return;
    let changed = false;
    for (const item of results) {
      const now = app.lib.isInLibrary(item.seed);
      if (now !== item.inLibrary) { item.inLibrary = now; changed = true; }
    }
    if (changed) renderResults();
  });

  updateStatus();
  ensureCorpus(app, updateStatus, () => {
    updateStatus();
    if (searchInput.value.trim()) performSearch();
  });
  renderResults();

  return () => {
    clearTimeout(debounceTimer);
    unsubscribe();
  };
}
