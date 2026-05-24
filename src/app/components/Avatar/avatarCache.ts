import type { MatrixClient } from 'matrix-js-sdk';
import { getCachedBlobUrl, setCachedBlobUrl } from '@/app/features/timeline/message/mediaCache';

function getMxcCacheKey(mxcUrl: string): string {
  return `mxc:${mxcUrl}`;
}

export async function fetchAvatarBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  retries = 2
): Promise<string | null> {
  const cacheKey = getMxcCacheKey(mxcUrl);
  const cached = getCachedBlobUrl(cacheKey);
  if (cached) return cached;

  for (let i = 0; i <= retries; i++) {
    try {
      const httpUrl = client.mxcUrlToHttp(mxcUrl, 64, 64, 'crop', false, true, true) as
        | string
        | null;
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

export async function fetchMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  retries = 2
): Promise<string | null> {
  const cacheKey = getMxcCacheKey(mxcUrl);
  const cached = getCachedBlobUrl(cacheKey);
  if (cached) return cached;

  for (let i = 0; i <= retries; i++) {
    try {
      const httpUrl = client.mxcUrlToHttp(
        mxcUrl,
        undefined,
        undefined,
        undefined,
        false,
        true,
        true
      ) as string | null;
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
