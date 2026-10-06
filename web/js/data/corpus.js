// 内置语料加载（与 Kotlin CorpusLoader.kt 对应）
// 搜索词库按集存储为 .json.gz，浏览器端用 DecompressionStream 解压。

export const CORPUS_BASE = 'data/corpus';

const SEED_FILE = 'poems.json';
// 与 Android assets/corpus 内 .json 文件一致，按文件名字典序
const CORPUS_FILES = ['caocao', 'chuci', 'qing', 'shijing', 'song_ci', 'tang', 'wudai', 'yuanqu'];

let seedPromise = null;
let searchPromise = null;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载失败：${url}（HTTP ${res.status}）`);
  return res.json();
}

async function fetchGzJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载失败：${url}（HTTP ${res.status}）`);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 gzip 解压，请使用较新的 Chrome / Edge / Firefox / Safari。');
  }
  const stream = res.body.pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

/** 精选 10 首，首次启动自动加入书架 */
export function loadSeeds() {
  if (!seedPromise) {
    seedPromise = fetchJson(`${CORPUS_BASE}/${SEED_FILE}`);
  }
  return seedPromise;
}

/**
 * 搜索词库：诗经/楚辞/曹操集/全唐/宋词/五代/元曲/清，按集文件合并。
 * @param {(loaded:number,total:number)=>void} [onProgress]
 */
export function loadSearchCorpus(onProgress) {
  if (!searchPromise) {
    let loaded = 0;
    const total = CORPUS_FILES.length;
    if (onProgress) onProgress(0, total);
    const tasks = CORPUS_FILES.map((name) =>
      fetchGzJson(`${CORPUS_BASE}/${name}.json.gz`).then((items) => {
        loaded++;
        if (onProgress) onProgress(loaded, total);
        return items;
      }));
    searchPromise = Promise.all(tasks).then((chunks) => chunks.flat());
  }
  return searchPromise;
}

export function corpusFileCount() {
  return CORPUS_FILES.length;
}
