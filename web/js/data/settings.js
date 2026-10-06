// 阅读设置持久化（对应 Android ReaderScreen 的 rememberSaveable，Web 端持久到 localStorage）
const KEY = 'xingzhu.reader.settings';

export const DEFAULT_SETTINGS = Object.freeze({
  showTone: true,
  showRhyme: true,
  markStyle: 'SYMBOL',
  fontSize: 24,
});

export function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 隐私模式下忽略 */
  }
}
