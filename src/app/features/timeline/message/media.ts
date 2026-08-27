import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { getCachedBlobUrl } from './mediaCache';
import { mayBeAnimated } from '../utils/imageAnimation';

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

function isAnimatedContent(content: Record<string, unknown>): boolean {
  const info = content.info as Record<string, unknown> | undefined;
  const flag = info?.is_animated;
  if (typeof flag === 'boolean') return flag;
  if (flag === 'true') return true;

  const msc4230Flag = info?.['org.matrix.msc4230.is_animated'];
  if (typeof msc4230Flag === 'boolean') return msc4230Flag;
  if (msc4230Flag === 'true') return true;
  const mimetype = typeof info?.mimetype === 'string' ? info.mimetype : undefined;
  return mayBeAnimated(mimetype);
}

export function getMediaAnimates(event: MatrixEvent): boolean {
  const content = event.getContent();
  return isAnimatedContent(content as Record<string, unknown>);
}
