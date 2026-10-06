// 行箸 Web · Service Worker
// 首次访问即把「应用外壳 + 字典 + 全部语料」缓存到本地，之后可离线使用。

const VERSION = 'xingzhu-v3';
const STATIC_CACHE = `${VERSION}-static`;
const DATA_CACHE = `${VERSION}-data`;

// 应用外壳（缺失会中断安装）
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/engine/model.js',
  './js/engine/text-splitter.js',
  './js/engine/dictionary.js',
  './js/engine/pingze-engine.js',
  './js/engine/pingze-checker.js',
  './js/data/corpus.js',
  './js/data/repository.js',
  './js/data/pinyin.js',
  './js/data/settings.js',
  './js/ui/dom.js',
  './js/ui/annotated-poem-view.js',
  './js/ui/library.js',
  './js/ui/add.js',
  './js/ui/reader.js',
  './js/ui/check.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// 《诗韵新编》字典
const DICTIONARY = ['./data/kxhc1983.txt', './data/rushu.txt'];

// 语料（7.6 万余首，gzip）
const CORPUS = [
  './data/corpus/poems.json',
  './data/corpus/caocao.json.gz',
  './data/corpus/chuci.json.gz',
  './data/corpus/qing.json.gz',
  './data/corpus/shijing.json.gz',
  './data/corpus/song_ci.json.gz',
  './data/corpus/tang.json.gz',
  './data/corpus/wudai.json.gz',
  './data/corpus/yuanqu.json.gz',
];

async function broadcast(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) client.postMessage(message);
}

/** 强制从网络取（绕过 HTTP 缓存）并写入 Cache Storage */
async function precache(cache, urls, { tolerant = false } = {}) {
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (!res || !res.ok) throw new Error(`${url}: ${res && res.status}`);
      await cache.put(url, res);
    } catch (err) {
      if (!tolerant) throw err;
    }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const staticCache = await caches.open(STATIC_CACHE);
    const dataCache = await caches.open(DATA_CACHE);

    await precache(staticCache, APP_SHELL);
    await precache(dataCache, DICTIONARY, { tolerant: true });

    const total = CORPUS.length;
    let loaded = 0;
    await Promise.all(CORPUS.map(async (url) => {
      try { await precache(dataCache, [url]); } catch (err) { /* 大文件失败不阻塞安装 */ }
      loaded += 1;
      await broadcast({ type: 'corpus-progress', loaded, total });
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
    await broadcast({ type: 'offline-ready' });
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'ping') {
    event.source && event.source.postMessage({ type: 'offline-ready' });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 第三方（如 Google Fonts）走网络，不缓存
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(req));
    return;
  }
  event.respondWith(cacheFirst(req, url));
});

/** 导航：优先网络（拿到新页面则更新缓存），离线回退到已缓存的 index.html */
async function networkFirstNavigation(req) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type === 'basic') {
      await cache.put('./index.html', fresh.clone());
    }
    return fresh;
  } catch (err) {
    return (await cache.match('./index.html')) ||
      (await cache.match('./')) ||
      new Response('离线，且尚未完成缓存。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

/** 其余同源资源：缓存优先（首次命中网络后写入），实现离线可用 */
async function cacheFirst(req, url) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === 'basic') {
      const cache = await caches.open(url.pathname.includes('/data/') ? DATA_CACHE : STATIC_CACHE);
      await cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    return new Response('离线，且该资源未缓存。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
