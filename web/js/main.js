// 应用入口：加载字典 → 初始化书架 → 启动 hash 路由

import { ShiYunXinBianDictionary } from './engine/dictionary.js';
import { PingZeEngine } from './engine/pingze-engine.js';
import { Library } from './data/repository.js';
import { loadSettings } from './data/settings.js';
import { el } from './ui/dom.js';
import { mountLibrary } from './ui/library.js';
import { mountAdd } from './ui/add.js';
import { mountReader } from './ui/reader.js';
import { mountCheck } from './ui/check.js';

const DATA = {
  kxhc: 'data/kxhc1983.txt',
  rushu: 'data/rushu.txt',
};

const NAV = [
  { hash: '#/library', label: '书架', match: ['#/library', '#/reader'] },
  { hash: '#/add', label: '添加诗词', match: ['#/add'] },
  { hash: '#/check', label: '习作检测', match: ['#/check'] },
];

let app = null;
let cleanup = null;

function setActiveNav(hash) {
  const path = hash.split('/').slice(0, 2).join('/');
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const key = a.getAttribute('data-nav');
    const entry = NAV.find((n) => n.hash === key);
    const active = entry ? entry.match.some((m) => hash.startsWith(m)) : false;
    a.classList.toggle('active', active);
  });
}

function renderRoute() {
  if (!app) return;
  const view = document.getElementById('view');
  if (cleanup) { cleanup(); cleanup = null; }
  const hash = location.hash || '#/library';
  view.className = 'view';
  view.replaceChildren();
  setActiveNav(hash);

  const readerMatch = /^#\/reader\/(\d+)$/.exec(hash);
  if (readerMatch) {
    cleanup = mountReader(view, app, Number(readerMatch[1])) || null;
    return;
  }
  if (hash === '#/add') { cleanup = mountAdd(view, app) || null; return; }
  if (hash === '#/check') { cleanup = mountCheck(view, app) || null; return; }
  cleanup = mountLibrary(view, app) || null;
}

function showLoading(message) {
  const view = document.getElementById('view');
  view.replaceChildren(el('div', { class: 'boot-screen' },
    el('div', { class: 'boot-mark', text: '行箸' }),
    el('div', { class: 'boot-status' }, el('span', { class: 'spinner' }), el('span', { text: message })),
  ));
}

function showFatal(message) {
  const view = document.getElementById('view');
  view.replaceChildren(el('div', { class: 'boot-screen' },
    el('div', { class: 'boot-mark', text: '行箸' }),
    el('div', { class: 'boot-error', text: message }),
  ));
}

/** 注册 Service Worker：首次访问缓存应用外壳 + 字典 + 语料，之后可离线使用 */
function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const status = document.getElementById('offline-status');
  if (!status) return;

  const setStatus = (text, cls) => {
    status.hidden = false;
    status.textContent = text;
    status.className = 'offline-status' + (cls ? ' ' + cls : '');
  };
  const ready = () => setStatus('可离线使用 ✓', 'ready');

  navigator.serviceWorker.addEventListener('message', (event) => {
    const msg = event.data || {};
    if (msg.type === 'corpus-progress') setStatus(`离线缓存语料 ${msg.loaded}/${msg.total}`);
    else if (msg.type === 'offline-ready') ready();
  });
  navigator.serviceWorker.addEventListener('controllerchange', ready);

  if (navigator.serviceWorker.controller) {
    ready();
    navigator.serviceWorker.controller.postMessage('ping');
  } else {
    setStatus('正在准备离线缓存…');
  }

  navigator.serviceWorker.register('sw.js', { scope: './' }).catch((err) => {
    console.warn('Service Worker 注册失败：', err);
    status.hidden = true;
  });
}

async function boot() {
  try {
    setupServiceWorker();

    showLoading('正在加载《诗韵新编》字典…');
    const dict = await ShiYunXinBianDictionary.fromUrls(DATA.kxhc, DATA.rushu);

    showLoading('正在准备书架…');
    const engine = new PingZeEngine(dict);
    const lib = new Library(engine, dict);
    await lib.init();
    await lib.ensureCorpusSeeded();

    app = {
      dict,
      engine,
      lib,
      settings: loadSettings(),
      navigate(hash) {
        if (location.hash === hash) renderRoute();
        else location.hash = hash;
      },
    };

    window.addEventListener('hashchange', renderRoute);
    if (!location.hash) location.hash = '#/library';
    renderRoute();
  } catch (err) {
    console.error(err);
    showFatal(`启动失败：${err && err.message ? err.message : err}\n\n请确认通过 HTTP 服务访问（而非直接双击 index.html），并已放置 data/ 目录。`);
  }
}

boot();
