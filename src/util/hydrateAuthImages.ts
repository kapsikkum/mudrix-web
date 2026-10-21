import type { MatrixClient } from 'matrix-js-sdk';
import { fetchMediaBlobUrl, mediaBlobCacheKey } from '@/app/components/Avatar';
import { deleteCachedBlobUrl, getCachedBlobUrl } from '@/app/features/timeline/message/mediaCache';

const AUTH_MEDIA_RE = /\/_matrix\/client\/v1\/media\/(?:download|thumbnail)\/([^/]+)\/([^/?]+)/;

function mxcFromAuthMediaUrl(src: string): string | null {
  try {
    const m = AUTH_MEDIA_RE.exec(new URL(src).pathname);
    return m ? `mxc://${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

// Inline images (custom emoji, pack emoji) point at authenticated media, which a plain <img>
// cannot load. They are fetched with the access token and given a blob URL; a failed fetch or a
// dead cached URL is retried, and if it never works the image is left without a src so the
// placeholder glyph shows instead of the browser's broken-image icon.
function loadAuthImg(img: HTMLImageElement, mxc: string, client: MatrixClient): void {
  // Already downloaded: use it straight away, so an image that is re-created (hover, re-render)
  // does not flash its placeholder while it is fetched again.
  const cached = getCachedBlobUrl(mediaBlobCacheKey(mxc));
  if (cached) {
    img.src = cached;
    // Skip the loading placeholder: the data is already in memory, and waiting for the load event
    // makes the image flash on slower webviews.
    img.dataset.mediaLoaded = 'true';
  }
  const attempt = (n: number) => {
    if (n > 0) deleteCachedBlobUrl(mediaBlobCacheKey(mxc));
    fetchMediaBlobUrl(mxc, client, n === 0 ? 2 : 0)
      .then((url) => {
        if (!img.isConnected) return;
        if (url && url.startsWith('blob:')) {
          img.src = url;
          return;
        }
        if (n < 2) window.setTimeout(() => attempt(n + 1), n === 0 ? 1000 : 3000);
      })
      .catch(() => {
        if (img.isConnected && n < 2) window.setTimeout(() => attempt(n + 1), 1000);
      });
  };
  let failures = 0;
  img.addEventListener('error', () => {
    img.removeAttribute('src');
    failures += 1;
    if (failures <= 2) attempt(failures);
  });
  if (!cached) attempt(0);
}

/** Marks images as loaded (for the placeholder styling) and loads authenticated/pack media. */
export function hydrateAuthImages(root: ParentNode, client: MatrixClient): void {
  for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
    if (img.dataset.mediaLoadHooked === 'done') continue;
    img.dataset.mediaLoadHooked = 'done';
    if (img.complete && img.naturalWidth > 0) {
      img.dataset.mediaLoaded = 'true';
    } else {
      img.addEventListener('load', () => {
        img.dataset.mediaLoaded = 'true';
      });
    }
  }

  for (const img of root.querySelectorAll<HTMLImageElement>('img[data-media-mxc]:not([src])')) {
    if (img.dataset.mediaMxcDone === 'done') continue;
    img.dataset.mediaMxcDone = 'done';
    const mxc = img.dataset.mediaMxc;
    if (mxc) loadAuthImg(img, mxc, client);
  }

  for (const img of root.querySelectorAll<HTMLImageElement>(
    'img[src*="/_matrix/client/v1/media/"]'
  )) {
    if (img.dataset.mxAuthMedia === 'done') continue;
    img.dataset.mxAuthMedia = 'done';
    const mxc = mxcFromAuthMediaUrl(img.src);
    if (!mxc) continue;
    img.removeAttribute('src');
    loadAuthImg(img, mxc, client);
  }
}
