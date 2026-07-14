/**
 * IndexedDB 图片缓存
 * 将远程图片缓存到本地 IndexedDB，下次加载直接使用，无需再次请求网络
 */
const DB_NAME = 'clocktower-image-cache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = e => resolve(e.target.result);
      request.onerror = e => reject(e.target.error);
    });
  }
  return dbPromise;
}

/**
 * 从缓存读取图片，返回 object URL；未命中返回 null
 */
export async function getCachedImage(key) {
  try {
    const db = await openDB();
    return new Promise(resolve => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        const blob = req.result;
        resolve(blob ? URL.createObjectURL(blob) : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * 将远程图片缓存到 IndexedDB，返回 object URL
 */
export async function cacheImage(key, url) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return url;
    const blob = await response.blob();
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, key);
    } catch {
      // 写入失败不影响返回
    }
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}
