import type { MatrixClient } from 'matrix-js-sdk';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';

export function getMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  setState: (url: string) => void
): string | null {
  if (!mxcUrl) return null;
  fetchMediaBlobUrl(mxcUrl, client, 1).then((url) => {
    if (url) setState(url);
  });
  return null;
}
