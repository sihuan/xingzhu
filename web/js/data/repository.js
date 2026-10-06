// 书架仓库（与 Kotlin PoemRepository.kt + Room 对应）
// 用 IndexedDB 持久化；内存快照 + 订阅，替代 Room 的 Flow。

import { firstLetters } from './pinyin.js';
import { loadSeeds, loadSearchCorpus } from './corpus.js';

const DB_NAME = 'xingzhu';
const DB_VERSION = 1;
const STORE = 'poems';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('addedAt', 'addedAt', { unique: false });
        os.createIndex('titleAuthor', ['title', 'author'], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

function request(req) {
  return { __req: req };
}

export class Library {
  constructor(engine, dictionary) {
    this.engine = engine;
    this.dictionary = dictionary;
    this.db = null;
    this.poems = [];
    this.listeners = new Set();
  }

  async init() {
    this.db = await openDB();
    await this.refresh();
  }

  /** 订阅书架变化；返回取消订阅函数 */
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.poems);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) fn(this.poems);
  }

  async refresh() {
    this.poems = await tx(this.db, 'readonly', (store) => request(store.getAll()));
    this.emit();
  }

  async count() {
    return tx(this.db, 'readonly', (store) => request(store.count()));
  }

  getPoem(id) {
    return this.poems.find((p) => p.id === id) || null;
  }

  async findByTitleAuthor(title, author) {
    return this.poems.find((p) => p.title === title && p.author === author) || null;
  }

  /** 首次启动：把精选种子自动加入书架；并为旧数据回填拼音 */
  async ensureCorpusSeeded() {
    if ((await this.count()) === 0) {
      const seeds = await loadSeeds();
      for (const seed of seeds) await this.addToLibrary(seed);
    }
    await this.backfillPinyin();
  }

  async backfillPinyin() {
    const missing = this.poems.filter((p) => !p.titlePinyin || !p.authorPinyin);
    for (const poem of missing) {
      await tx(this.db, 'readwrite', (store) => request(store.put({
        ...poem,
        titlePinyin: firstLetters(poem.title, this.dictionary),
        authorPinyin: firstLetters(poem.author, this.dictionary),
      })));
    }
    if (missing.length > 0) await this.refresh();
  }

  /** 按题目/作者/全文搜索；标题/作者命中优先，全文命中在后，共取前 50 条 */
  searchCorpus(query, corpus) {
    const q = query.trim();
    if (!q) return [];
    const head = [];
    const tail = [];
    for (const poem of corpus) {
      if (poem.title.includes(q) || poem.author.includes(q)) {
        head.push(poem);
        if (head.length >= 50) return head;
      } else if (poem.content.includes(q)) {
        tail.push(poem);
      }
    }
    return head.concat(tail.slice(0, 50 - head.length));
  }

  isInLibrary(seed) {
    return this.poems.some((p) => p.title === seed.title && p.author === seed.author);
  }

  /** 加入书架（同题目+作者已存在则不重复插入），并同步生成平仄/韵脚标注缓存与拼音 */
  async addToLibrary(seed) {
    const existing = await this.findByTitleAuthor(seed.title, seed.author);
    if (existing) return existing.id;
    const entity = {
      title: seed.title,
      author: seed.author,
      dynasty: seed.dynasty || null,
      form: seed.form || '',
      contentText: seed.content,
      annotation: null,
      addedAt: Date.now(),
      titlePinyin: firstLetters(seed.title, this.dictionary),
      authorPinyin: firstLetters(seed.author, this.dictionary),
    };
    const annotated = this.engine.annotatePoem(0, seed.form || '', seed.content);
    entity.annotation = annotated;
    const id = await tx(this.db, 'readwrite', (store) => request(store.add(entity)));
    await this.refresh();
    return id;
  }

  async delete(id) {
    await tx(this.db, 'readwrite', (store) => request(store.delete(id)));
    await this.refresh();
  }

  /** 加载搜索词库（带进度） */
  loadSearchCorpus(onProgress) {
    return loadSearchCorpus(onProgress);
  }
}
