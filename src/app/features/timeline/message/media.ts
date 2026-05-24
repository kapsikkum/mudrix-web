import type { MatrixClient } from 'matrix-js-sdk';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { getCachedBlobUrl } from './mediaCache';

export function getMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  setState: (url: string) => void
): string | null {
  if (!mxcUrl) return null;

  const cacheKey = `mxc:${mxcUrl}`;
  const cached = getCachedBlobUrl(cacheKey);
  if (cached) return cached;

  fetchMediaBlobUrl(mxcUrl, client, 1).then((url) => {
    if (url) setState(url);
  });
  return null;
}
