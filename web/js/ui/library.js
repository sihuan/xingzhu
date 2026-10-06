// 书架页（与 Kotlin LibraryScreen.kt / LibraryViewModel.kt 对应）

import { confirmDialog, dropdown, el, icon, toast } from './dom.js';

export const SortOrder = Object.freeze({
  ADDED_NEWEST: { id: 'ADDED_NEWEST', label: '添加时间 新→旧' },
  ADDED_OLDEST: { id: 'ADDED_OLDEST', label: '添加时间 旧→新' },
  TITLE_ABC: { id: 'TITLE_ABC', label: '标题首字母' },
  AUTHOR_ABC: { id: 'AUTHOR_ABC', label: '作者首字母' },
  DYNASTY: { id: 'DYNASTY', label: '朝代' },
  FORM: { id: 'FORM', label: '体裁' },
});

const DYNASTY_ORDER = ['周', '先秦', '汉', '唐', '五代', '宋', '元', '明', '清'];
const FORM_ORDER = ['诗经', '楚辞', '乐府诗', '四言诗', '五言绝句', '五言律诗', '七言绝句', '七言律诗', '古体诗', '词', '曲'];

const viewState = {
  sortOrder: 'ADDED_NEWEST',
  groupByAuthor: false,
  collapsedAuthors: new Set(),
};

function cmpInsensitive(a, b) {
  const x = (a || '').toUpperCase();
  const y = (b || '').toUpperCase();
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

function rankOf(value, order) {
  const idx = order.indexOf(value || '');
  return idx < 0 ? order.length : idx;
}

export function sortPoems(poems, sortId) {
  const list = [...poems];
  switch (sortId) {
    case 'ADDED_OLDEST': return list.sort((a, b) => (a.addedAt - b.addedAt) || (a.id - b.id));
    case 'TITLE_ABC': return list.sort((a, b) => cmpInsensitive(a.titlePinyin, b.titlePinyin));
    case 'AUTHOR_ABC': return list.sort((a, b) => cmpInsensitive(a.authorPinyin, b.authorPinyin));
    case 'DYNASTY': return list.sort((a, b) => rankOf(a.dynasty, DYNASTY_ORDER) - rankOf(b.dynasty, DYNASTY_ORDER));
    case 'FORM': return list.sort((a, b) => rankOf(a.form, FORM_ORDER) - rankOf(b.form, FORM_ORDER));
    case 'ADDED_NEWEST':
    default: return list.sort((a, b) => (b.addedAt - a.addedAt) || (b.id - a.id));
  }
}

function metaText(poem) {
  return [poem.dynasty, poem.author, poem.form && poem.form.trim() ? poem.form : null]
    .filter(Boolean).join(' · ');
}

function poemCard(poem, app) {
  const card = el('article', { class: 'poem-card', tabindex: '0', role: 'button' });
  card.append(
    el('div', { class: 'poem-card-main' },
      el('h3', { class: 'poem-card-title', text: poem.title }),
      el('p', { class: 'poem-card-meta', text: metaText(poem) }),
    ),
  );
  const del = el('button', {
    class: 'icon-btn card-delete',
    title: '从书架移除',
    'aria-label': `删除《${poem.title}》`,
    onclick: async (e) => {
      e.stopPropagation();
      const ok = await confirmDialog({
        title: '删除诗词',
        text: `确定从书架移除《${poem.title}》吗？`,
        confirmText: '删除',
        danger: true,
      });
      if (ok) {
        await app.lib.delete(poem.id);
        toast(`已移除《${poem.title}》`);
      }
    },
  }, icon('delete', 18));
  card.append(del);
  const open = () => app.navigate(`#/reader/${poem.id}`);
  card.addEventListener('click', open);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  return card;
}

function emptyState(app) {
  return el('div', { class: 'empty-state' },
    el('div', { class: 'empty-mark', text: '册' }),
    el('p', { class: 'empty-title', text: '书架空空如也' }),
    el('p', { class: 'empty-sub', text: '去诗海中添一首吧' }),
    el('button', { class: 'btn btn-primary', onclick: () => app.navigate('#/add') }, '添加诗词'),
  );
}

function renderList(poems, app) {
  if (poems.length === 0) return emptyState(app);

  const sorted = sortPoems(poems, viewState.sortOrder);

  if (!viewState.groupByAuthor) {
    const grid = el('div', { class: 'library-grid' });
    sorted.forEach((p) => grid.append(poemCard(p, app)));
    return grid;
  }

  const groups = new Map();
  for (const p of sorted) {
    if (!groups.has(p.author)) groups.set(p.author, []);
    groups.get(p.author).push(p);
  }

  const wrap = el('div', { class: 'author-groups' });
  for (const [author, group] of groups) {
    const collapsed = viewState.collapsedAuthors.has(author);
    const header = el('button', { class: 'author-header', 'aria-expanded': String(!collapsed) },
      el('span', { class: 'author-chevron' + (collapsed ? '' : ' open') }, icon('chevron', 18)),
      el('span', { class: 'author-name', text: author }),
      el('span', { class: 'author-count', text: `${group.length} 首` }),
    );
    header.addEventListener('click', () => {
      if (collapsed) viewState.collapsedAuthors.delete(author);
      else viewState.collapsedAuthors.add(author);
      rerender(app);
    });
    const section = el('section', { class: 'author-group' }, header);
    if (!collapsed) {
      const grid = el('div', { class: 'library-grid' });
      group.forEach((p) => grid.append(poemCard(p, app)));
      section.append(grid);
    }
    wrap.append(section);
  }
  return wrap;
}

let currentRoot = null;
let unsubscribe = null;
let appRef = null;

function rerender(app = appRef) {
  if (!currentRoot || !app) return;
  currentRoot.replaceChildren(renderList(app.lib.poems, app));
}

export function mountLibrary(root, app) {
  currentRoot = root;
  appRef = app;
  root.classList.add('view-library');

  const toolbar = el('div', { class: 'library-toolbar' });
  const countLabel = el('span', { class: 'toolbar-count' });

  const sortTrigger = el('button', { class: 'btn btn-soft' }, icon('sort', 18), el('span', { text: '排序' }));
  const sortMenu = dropdown({
    trigger: sortTrigger,
    items: Object.values(SortOrder).map((order) => ({
      label: order.label,
      selected: viewState.sortOrder === order.id,
      onSelect: () => {
        viewState.sortOrder = order.id;
        rerender(app);
        mountLibrary.refreshToolbar();
      },
    })),
  });

  const groupBtn = el('button', {
    class: 'btn btn-soft' + (viewState.groupByAuthor ? ' active' : ''),
    onclick: () => {
      viewState.groupByAuthor = !viewState.groupByAuthor;
      groupBtn.classList.toggle('active', viewState.groupByAuthor);
      rerender(app);
    },
  }, icon('book', 18), el('span', { text: '按作者分组' }));

  toolbar.append(countLabel, el('div', { class: 'toolbar-actions' }, sortMenu, groupBtn));

  const listRoot = el('div', { class: 'library-list' });
  root.replaceChildren(toolbar, listRoot);

  currentRoot = listRoot;
  mountLibrary.refreshToolbar = () => {
    countLabel.textContent = `共 ${app.lib.poems.length} 首`;
  };

  unsubscribe = app.lib.subscribe((poems) => {
    mountLibrary.refreshToolbar();
    listRoot.replaceChildren(renderList(poems, app));
  });
  mountLibrary.refreshToolbar();

  return () => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    currentRoot = null;
    delete mountLibrary.refreshToolbar;
  };
}

mountLibrary.refreshToolbar = () => {};
