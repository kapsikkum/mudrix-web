import type { MatrixClient } from 'matrix-js-sdk';
import { getCachedBlobUrl, setCachedBlobUrl } from '@/app/features/timeline/message/mediaCache';

function getMxcCacheKey(mxcUrl: string): string {
  return `mxc:${mxcUrl}`;
}

const inflight = new Map<string, Promise<string | null>>();

async function fetchBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  getHttpUrl: () => string | null,
  retries: number
): Promise<string | null> {
  const cacheKey = getMxcCacheKey(mxcUrl);
  const cached = getCachedBlobUrl(cacheKey);
  if (cached) return cached;

  const existing = inflight.get(cacheKey);
  if (existing) return existing;

  const promise = doFetch(client, getHttpUrl, retries, cacheKey);
  inflight.set(cacheKey, promise);
  promise.finally(() => {
    if (inflight.get(cacheKey) === promise) inflight.delete(cacheKey);
  });

  return promise;
}

async function doFetch(
  client: MatrixClient,
  getHttpUrl: () => string | null,
  retries: number,
  cacheKey: string
): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const httpUrl = getHttpUrl();
      if (!httpUrl) return null;

      const res = await fetch(httpUrl, {
        headers: { Authorization: `Bearer ${client.getAccessToken()}` },
      });

      if (!res.ok) {
        if (i < retries) {
          await new Promise((r) => setTimeout(r, 500 * (i + 1)));
          continue;
        }
        return null;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      setCachedBlobUrl(cacheKey, blobUrl, blob.type);
      return blobUrl;
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}

export function fetchAvatarBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  retries = 2
): Promise<string | null> {
  return fetchBlobUrl(
    mxcUrl,
    client,
    () => {
      return client.mxcUrlToHttp(mxcUrl, 64, 64, 'crop', false, true, true) as string | null;
    },
    retries
  );
}

export function fetchMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  retries = 2
): Promise<string | null> {
  return fetchBlobUrl(
    mxcUrl,
    client,
    () => {
      return client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false, true, true) as
        | string
        | null;
    },
    retries
  );
}
