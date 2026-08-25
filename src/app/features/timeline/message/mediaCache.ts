import type { IEncryptedFile } from 'matrix-encrypt-attachment';

const DB_NAME = 'wz-media-cache';
const STORE_NAME = 'decrypted-media';
const DB_VERSION = 1;

interface CacheRecord {
  data: ArrayBuffer;
  mimeType: string;
}

// In-memory blob URL cache
const blobUrlCache = new Map<string, { blobUrl: string; mimeType: string }>();
const MAX_MEMORY_ENTRIES = 2000;

export function getCachedBlobUrl(key: string): string | null {
  const entry = blobUrlCache.get(key);
  if (!entry) return null;
  blobUrlCache.delete(key);
  blobUrlCache.set(key, entry);
  return entry.blobUrl;
}

export function setCachedBlobUrl(key: string, blobUrl: string, mimeType: string): void {
  const existing = blobUrlCache.get(key);
  if (existing) {
    URL.revokeObjectURL(existing.blobUrl);
  }
  if (blobUrlCache.size >= MAX_MEMORY_ENTRIES) {
    const lruKey = blobUrlCache.keys().next().value;
    if (lruKey !== undefined) {
      const evicted = blobUrlCache.get(lruKey);
      if (evicted) URL.revokeObjectURL(evicted.blobUrl);
      blobUrlCache.delete(lruKey);
    }
  }
  blobUrlCache.set(key, { blobUrl, mimeType });
}

// IndexedDB persistent cache
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getMediaCacheKey(file: IEncryptedFile & { url: string }): string {
  const raw = `${file.v}:${file.url}:${file.iv}:${file.key.k}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `enc:${Math.abs(hash).toString(36)}`;
}

export async function getCachedMedia(key: string): Promise<CacheRecord | null> {
  try {
    const db = await openDB();
    return await new Promise<CacheRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
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
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ data, mimeType } satisfies CacheRecord, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Non-critical — next access will re-download and re-decrypt
  }
}
