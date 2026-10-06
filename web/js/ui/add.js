// 添加诗词页（对应 Kotlin AddScreen.kt / AddViewModel.kt）
// 语料全文搜索 + 命中片段高亮 + 展开全诗 + 加入书架。
// Web 端展示全部命中并分页加载（滚动到底自动加载 / 「加载更多」按钮）。

import { el, icon, toast } from './dom.js';

const PAGE_SIZE = 50;

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

function libraryKey(title, author) {
  return title + '\u0000' + author;
}

function libraryKeys(poems) {
  const set = new Set();
  for (const p of poems) set.add(libraryKey(p.title, p.author));
  return set;
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
  const metaLine = el('div', { class: 'results-meta' });
  const resultsEl = el('div', { class: 'search-results' });
  const sentinel = el('div', { class: 'load-more-sentinel' });

  root.replaceChildren(el('div', { class: 'add-head' }, searchBox, statusLine, metaLine), resultsEl);

  let results = [];          // 全部命中的 seed（标题/作者优先）
  let rendered = 0;          // 已渲染条数
  const expanded = new Set();
  let query = '';
  let debounceTimer = null;
  let libKeys = libraryKeys(app.lib.poems);
  const cardNodes = new Map();

  // 滚动到底自动加载
  const observer = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadMore();
    }, { rootMargin: '600px 0px' })
    : null;

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

  function loadMore() {
    if (rendered >= results.length) return;
    rendered = Math.min(rendered + PAGE_SIZE, results.length);
    renderList();
    updateMeta();
  }

  function updateMeta() {
    if (!query.trim() || results.length === 0) { metaLine.replaceChildren(); return; }
    metaLine.replaceChildren(el('span', {
      text: `找到 ${results.length.toLocaleString('zh-CN')} 首 · 已显示 ${Math.min(rendered, results.length).toLocaleString('zh-CN')} 首`,
    }));
  }

  function resultCard(seed, index) {
    const inLibrary = libKeys.has(libraryKey(seed.title, seed.author));
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
        const fresh = resultCard(seed, index);
        const old = cardNodes.get(index);
        if (old && old.parentNode) old.replaceWith(fresh);
        cardNodes.set(index, fresh);
      },
    }, isExpanded ? '收起' : '展开全诗');

    const action = inLibrary
      ? el('span', { class: 'tag-in-library', text: '✓ 已在书架' })
      : el('button', {
        class: 'btn btn-outline',
        onclick: async (e) => {
          await app.lib.addToLibrary(seed);
          toast(`已加入书架《${seed.title}》`);
          e.currentTarget.replaceWith(el('span', { class: 'tag-in-library', text: '✓ 已在书架' }));
        },
      }, '加入书架');

    const node = el('article', { class: 'result-card' },
      el('div', { class: 'result-head' },
        el('h3', { class: 'result-title', text: seed.title }),
        el('p', { class: 'result-meta', text: metaText(seed) }),
      ),
      body,
      el('div', { class: 'result-actions' }, toggle, action),
    );
    cardNodes.set(index, node);
    return node;
  }

  function renderList() {
    cardNodes.clear();
    const list = el('div', { class: 'result-list' });
    const shown = results.slice(0, rendered);
    shown.forEach((seed, index) => list.append(resultCard(seed, index)));
    resultsEl.replaceChildren(list);

    if (rendered < results.length) {
      const more = el('div', { class: 'load-more' },
        el('button', { class: 'btn btn-soft', onclick: loadMore },
          `加载更多（剩余 ${(results.length - rendered).toLocaleString('zh-CN')} 首）`));
      resultsEl.append(more);
      resultsEl.append(sentinel);
      if (observer) observer.observe(sentinel);
    } else {
      if (observer) observer.unobserve(sentinel);
    }
  }

  function renderResults() {
    metaLine.replaceChildren();
    if (!corpus && !corpusError) { resultsEl.replaceChildren(); return; }
    if (!query.trim()) {
      resultsEl.replaceChildren(el('div', { class: 'hint-box' },
        el('p', { text: '输入题目或作者，从诗经至清诗（7 万余首）中查找' })));
      return;
    }
    if (results.length === 0) {
      resultsEl.replaceChildren(el('div', { class: 'hint-box' }, el('p', { text: '没有找到相关诗词' })));
      return;
    }
    updateMeta();
    renderList();
  }

  function performSearch() {
    query = searchInput.value;
    if (!corpus) { results = []; rendered = 0; renderResults(); return; }
    results = app.lib.searchCorpus(query, corpus);
    rendered = Math.min(PAGE_SIZE, results.length);
    expanded.clear();
    renderResults();
  }

  const onInput = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performSearch, 300);
  };
  searchInput.addEventListener('input', onInput);

  // 书架变化时刷新「已在书架」状态
  const unsubscribe = app.lib.subscribe((poems) => {
    libKeys = libraryKeys(poems);
    if (query.trim() && results.length > 0 && rendered > 0) renderList();
  });

  updateStatus();
  ensureCorpus(app, updateStatus, () => {
    updateStatus();
    if (searchInput.value.trim()) performSearch();
  });
  renderResults();

  return () => {
    clearTimeout(debounceTimer);
    if (observer) observer.disconnect();
    unsubscribe();
  };
}
