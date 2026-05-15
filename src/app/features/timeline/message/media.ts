import type { MatrixClient } from 'matrix-js-sdk';
import { getCachedBlobUrl, fetchMediaBlobUrl } from '@/app/components/Avatar';

export function getMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  setState: (url: string) => void
): string | null {
  if (!mxcUrl) return null;
  // Check both the full-size cache key and the legacy thumbnail key
  const cached = getCachedBlobUrl(`full:${mxcUrl}`) ?? getCachedBlobUrl(mxcUrl);
  if (cached) return cached;
  fetchMediaBlobUrl(mxcUrl, client, 1).then((url) => {
    if (url) setState(url);
  });
  return null;
}
