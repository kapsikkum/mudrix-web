import type { IEncryptedFile } from 'matrix-encrypt-attachment';
import { getStoredUserId } from '@/const/accountStorage';

export function mediaCacheDbName(userId: string | null = getStoredUserId()): string {
  return `mudrix-media-cache-${userId ?? 'anon'}`;
}

const DB_VERSION = 2;
const DATA_STORE = 'decrypted-media';
const META_STORE = 'decrypted-media-meta';

interface CacheRecord {
  data: ArrayBuffer;
  mimeType: string;
}

interface MetaRecord {
  key: string;
  mimeType: string;
  size: number;
  lastAccess: number;
}

const MAX_CACHE_BYTES = 100 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 400;

// In-memory blob URL cache. A blob URL keeps its whole blob alive, so what is held is limited by size
// as well as by count: the least recently used go first, and are freed.
const blobUrlCache = new Map<string, { blobUrl: string; mimeType: string; size: number }>();
const MAX_MEMORY_ENTRIES = 2000;
const MAX_MEMORY_BYTES = 384 * 1024 * 1024;
let blobUrlBytes = 0;

/** How long a removed URL is kept alive, so a picture or video still on screen is not pulled away. */
const REVOKE_DELAY_MS = 30_000;

export function getCachedBlobUrl(key: string): string | null {
  const entry = blobUrlCache.get(key);
  if (!entry) return null;
  blobUrlCache.delete(key);
  blobUrlCache.set(key, entry);
  return entry.blobUrl;
}

function dropBlobUrl(key: string, revokeNow: boolean): void {
  const entry = blobUrlCache.get(key);
  if (!entry) return;
  blobUrlCache.delete(key);
  blobUrlBytes -= entry.size;
  if (revokeNow) URL.revokeObjectURL(entry.blobUrl);
  else setTimeout(() => URL.revokeObjectURL(entry.blobUrl), REVOKE_DELAY_MS);
}

/** `size` is the blob's size in bytes, so the cache can keep to its budget; 0 when not known. */
export function setCachedBlobUrl(key: string, blobUrl: string, mimeType: string, size = 0): void {
  const existing = blobUrlCache.get(key);
  if (existing && existing.blobUrl !== blobUrl) dropBlobUrl(key, true);
  else if (existing) dropBlobUrl(key, false);
  blobUrlCache.set(key, { blobUrl, mimeType, size });
  blobUrlBytes += size;
  while (
    blobUrlCache.size > 1 &&
    (blobUrlCache.size > MAX_MEMORY_ENTRIES || blobUrlBytes > MAX_MEMORY_BYTES)
  ) {
    const lruKey = blobUrlCache.keys().next().value;
    if (lruKey === undefined || lruKey === key) break;
    dropBlobUrl(lruKey, true);
  }
}

/** Forgets a cached URL and frees it (after a short while, or at once with `revoke`). */
export function deleteCachedBlobUrl(key: string, revoke = false): void {
  dropBlobUrl(key, revoke);
}
let dbPromise: Promise<IDBDatabase> | null = null;
let openDbName: string | null = null;

export function clearMediaCache(): Promise<void> {
  for (const entry of blobUrlCache.values()) {
    URL.revokeObjectURL(entry.blobUrl);
  }
  blobUrlCache.clear();
  blobUrlBytes = 0;

  const pending = dbPromise;
  dbPromise = null;
  openDbName = null;
  if (!pending) return Promise.resolve();

  const close = pending.then((db) => db.close()).catch(() => {});
  return Promise.race([close, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
}

function openDB(): Promise<IDBDatabase> {
  const name = mediaCacheDbName();
  if (dbPromise && openDbName === name) return dbPromise;
  if (dbPromise) {
    const previous = dbPromise;
    dbPromise = null;
    void previous.then((db) => db.close()).catch(() => {});
  }

  openDbName = name;
  dbPromise = openDb(name);
  return dbPromise;
}

function openDb(name: string): Promise<IDBDatabase> {
  // The cache used to be named wz-media-cache-*; drop the orphaned copy (it only held re-downloadable media).
  try {
    indexedDB.deleteDatabase(name.replace(/^mudrix-/, 'wz-'));
  } catch {
    // best effort
  }
  const promise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of Array.from(db.objectStoreNames)) {
        db.deleteObjectStore(store);
      }
      db.createObjectStore(META_STORE, { keyPath: 'key' });
      db.createObjectStore(DATA_STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        if (openDbName === name) {
          dbPromise = null;
          openDbName = null;
        }
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  }).catch((err) => {
    if (openDbName === name) {
      dbPromise = null;
      openDbName = null;
    }
    throw err;
  });

  return promise;
}

export function getMediaCacheKey(file: IEncryptedFile & { url: string }): string {
  return `enc:${file.url}:${file.iv}`;
}

export async function getCachedMedia(key: string): Promise<CacheRecord | null> {
  try {
    const db = await openDB();
    return await new Promise<CacheRecord | null>((resolve, reject) => {
      const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
      tx.onabort = () => reject(tx.error);

      const metaReq = tx.objectStore(META_STORE).get(key);
      metaReq.onerror = () => reject(metaReq.error);
      metaReq.onsuccess = () => {
        const meta = metaReq.result as MetaRecord | undefined;
        if (!meta) {
          resolve(null);
          return;
        }
        const dataReq = tx.objectStore(DATA_STORE).get(key);
        dataReq.onerror = () => reject(dataReq.error);
        dataReq.onsuccess = () => {
          const data = dataReq.result as ArrayBuffer | undefined;
          if (!data) {
            tx.objectStore(META_STORE).delete(key);
            resolve(null);
            return;
          }
          tx.objectStore(META_STORE).put({ ...meta, lastAccess: Date.now() });
          resolve({ data, mimeType: meta.mimeType });
        };
      };
    });
  } catch {
    return null;
  }
}

export async function setCachedMedia(
  key: string,
  data: ArrayBuffer,
  mimeType: string
): Promise<void> {
  if (data.byteLength > MAX_CACHE_BYTES) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
      const meta: MetaRecord = {
        key,
        mimeType,
        size: data.byteLength,
        lastAccess: Date.now(),
      };
      tx.objectStore(DATA_STORE).put(data, key);
      tx.objectStore(META_STORE).put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });

    await enforceCacheLimits(db, key);
  } catch {
    // Non-critical — next access will re-download and re-decrypt
  }
}

async function enforceCacheLimits(db: IDBDatabase, keepKey: string): Promise<void> {
  const metas = await readAllMeta(db);

  let totalBytes = metas.reduce((sum, meta) => sum + (meta.size || 0), 0);
  if (metas.length <= MAX_CACHE_ENTRIES && totalBytes <= MAX_CACHE_BYTES) return;

  metas.sort((a, b) => a.lastAccess - b.lastAccess);
  const evict: string[] = [];
  for (const meta of metas) {
    if (evict.length + 1 >= metas.length) break;
    if (totalBytes <= MAX_CACHE_BYTES && metas.length - evict.length <= MAX_CACHE_ENTRIES) break;
    if (meta.key === keepKey) continue;
    evict.push(meta.key);
    totalBytes -= meta.size || 0;
  }
  if (evict.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    for (const key of evict) {
      tx.objectStore(META_STORE).delete(key);
      tx.objectStore(DATA_STORE).delete(key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function readAllMeta(db: IDBDatabase): Promise<MetaRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const out: MetaRecord[] = [];
    const req = tx.objectStore(META_STORE).openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push(cursor.value as MetaRecord);
        cursor.continue();
      } else {
        resolve(out);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
