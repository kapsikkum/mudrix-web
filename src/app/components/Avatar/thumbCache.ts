import { getStoredUserId } from '@/const/accountStorage';

/**
 * Persistent (Cache Storage) cache for homeserver thumbnails. Thumbnails are small and immutable
 * per (mxc, size, method), so a plain keyed store is enough. Keyed by the request URL, which
 * carries no credentials (auth is in a header). Best effort: every call swallows its errors.
 */

const MAX_ENTRIES = 4000;
const TRIM_TO = 3200;
const TRIM_CHECK_EVERY = 100;

export function thumbCacheName(userId: string | null = getStoredUserId()): string {
  return `wz-thumb-cache-${userId ?? 'anon'}`;
}

function hasCacheStorage(): boolean {
  return typeof caches !== 'undefined';
}

let putsSinceTrim = 0;

export async function readCachedThumb(url: string): Promise<Blob | null> {
  if (!hasCacheStorage()) return null;
  try {
    const cache = await caches.open(thumbCacheName());
    const res = await cache.match(url);
    return res ? await res.blob() : null;
  } catch {
    return null;
  }
}

export async function writeCachedThumb(url: string, blob: Blob): Promise<void> {
  if (!hasCacheStorage()) return;
  try {
    const cache = await caches.open(thumbCacheName());
    await cache.put(url, new Response(blob, { headers: { 'content-type': blob.type } }));
    putsSinceTrim += 1;
    if (putsSinceTrim >= TRIM_CHECK_EVERY) {
      putsSinceTrim = 0;
      const keys = await cache.keys();
      if (keys.length > MAX_ENTRIES) {
        // keys() is in insertion order, so this evicts the oldest entries first.
        await Promise.all(keys.slice(0, keys.length - TRIM_TO).map((k) => cache.delete(k)));
      }
    }
  } catch {
    // Non-critical: the next access just refetches.
  }
}

export async function deleteThumbCache(userId?: string | null): Promise<void> {
  if (!hasCacheStorage()) return;
  try {
    await caches.delete(thumbCacheName(userId ?? getStoredUserId()));
  } catch {
    // best effort
  }
}
