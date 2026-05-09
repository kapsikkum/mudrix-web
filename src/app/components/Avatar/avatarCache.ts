const blobCache = new Map<string, string>();
const MAX_CACHE_SIZE = 100;

function evictOldest() {
  if (blobCache.size >= MAX_CACHE_SIZE) {
    const oldest = blobCache.keys().next().value;
    if (oldest !== undefined) {
      const blobUrl = blobCache.get(oldest);
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      blobCache.delete(oldest);
    }
  }
}

export async function fetchAvatarBlobUrl(
  mxcUrl: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  retries = 2
): Promise<string | null> {
  if (blobCache.has(mxcUrl)) return blobCache.get(mxcUrl)!;

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
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        return null;
      }

      evictOldest();
      const blobUrl = URL.createObjectURL(await res.blob());
      blobCache.set(mxcUrl, blobUrl);
      return blobUrl;
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

export function getCachedBlobUrl(mxcUrl: string): string | undefined {
  return blobCache.get(mxcUrl);
}

export async function fetchMediaBlobUrl(
  mxcUrl: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  retries = 2
): Promise<string | null> {
  // Use a namespaced cache key so avatar thumbnails and full-size media
  // don't collide when the same mxc URL is requested at different sizes.
  const cacheKey = `full:${mxcUrl}`;
  if (blobCache.has(cacheKey)) return blobCache.get(cacheKey)!;

  for (let i = 0; i <= retries; i++) {
    try {
      // Pass no width/height/method so the homeserver returns the original file.
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
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        return null;
      }

      evictOldest();
      const blobUrl = URL.createObjectURL(await res.blob());
      blobCache.set(cacheKey, blobUrl);
      return blobUrl;
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 500));
    }
  }
  return null;
}

export function clearAvatarCache(mxcUrl?: string): void {
  if (mxcUrl) {
    const blobUrl = blobCache.get(mxcUrl);
    if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    blobCache.delete(mxcUrl);
  } else {
    for (const blobUrl of blobCache.values()) {
      if (blobUrl?.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
    }
    blobCache.clear();
  }
}
