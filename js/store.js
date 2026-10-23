// Remembers things between visits, on the phone only:
// settings in localStorage, the intro/outro files in IndexedDB.
const KEY = 'dhun:settings:v1';

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
}

let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('no indexedDB')); return; }
      const req = indexedDB.open('dhun', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('media');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction('media', mode);
    const req = fn(t.objectStore('media'));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// value: { kind: 'image'|'video', name, dur, blob }
export async function putMedia(key, value) {
  try { await tx('readwrite', (s) => s.put(value, key)); } catch (e) { /* storage full or blocked */ }
}

export async function getMedia(key) {
  try { return await tx('readonly', (s) => s.get(key)); } catch (e) { return null; }
}

export async function deleteMedia(key) {
  try { await tx('readwrite', (s) => s.delete(key)); } catch (e) { /* ignore */ }
}
