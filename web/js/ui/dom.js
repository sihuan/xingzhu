// 轻量 DOM 工具与通用组件（无框架）

/** 创建元素：el('div', {class:'x', onclick:fn}, child, ...) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

const ICONS = {
  add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  edit: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.9959.9959 0 0 0 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  settings: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  delete: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  search: 'M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  chevron: 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z',
  book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  sort: 'M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
};

export function icon(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', ICONS[name] || '');
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

/** 右上角轻提示 */
export function toast(message) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = el('div', { id: 'toast-root' });
    document.body.append(root);
  }
  const node = el('div', { class: 'toast', text: message, role: 'status' });
  root.append(node);
  requestAnimationFrame(() => node.classList.add('show'));
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 250);
  }, 2400);
}

/** 确认对话框，返回 Promise<boolean> */
export function confirmDialog({ title, text, confirmText = '确定', danger = false }) {
  return new Promise((resolve) => {
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    const close = (value) => {
      document.removeEventListener('keydown', onKey);
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 180);
      resolve(value);
    };
    const overlay = el('div', { class: 'modal-overlay' });
    const dialog = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' });
    dialog.append(
      el('h3', { class: 'modal-title', text: title }),
      el('p', { class: 'modal-text', text }),
      el('div', { class: 'modal-actions' },
        el('button', { class: 'btn btn-ghost', onclick: () => close(false) }, '取消'),
        el('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onclick: () => close(true) }, confirmText),
      ),
    );
    overlay.append(dialog);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  });
}

/** 下拉菜单；trigger 点击后展示 items */
export function dropdown({ trigger, items, align = 'right' }) {
  const wrap = el('div', { class: 'dropdown' });
  const menu = el('div', { class: 'dropdown-menu align-' + align });
  let open = false;
  const setOpen = (v) => {
    open = v;
    menu.classList.toggle('show', v);
    trigger.classList.toggle('active', v);
    if (v) trigger.setAttribute('aria-expanded', 'true');
    else trigger.removeAttribute('aria-expanded');
  };
  for (const item of items) {
    if (item.divider) { menu.append(el('div', { class: 'dropdown-divider' })); continue; }
    menu.append(el('button', {
      class: 'dropdown-item' + (item.selected ? ' selected' : ''),
      onclick: () => { setOpen(false); item.onSelect(); },
    }, el('span', { text: item.label }), item.selected ? icon('check', 16) : null));
  }
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!open); });
  const onDocClick = () => {
    if (open) setOpen(false);
    if (!wrap.isConnected) document.removeEventListener('click', onDocClick);
  };
  document.addEventListener('click', onDocClick);
  menu.addEventListener('click', (e) => e.stopPropagation());
  wrap.append(trigger, menu);
  return wrap;
}
