import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { decryptMediaFile, getEncryptedFile } from '../encryptedMedia';
import { fetchMediaBlobUrl } from '@/app/components/Avatar/fetchMediaBlobUrl';
import { isTauri, saveDesktopDownload } from '@/util/desktop';

export interface SaveAllResult {
  saved: number;
  failed: number;
  /** Where the last file went (desktop/mobile shell only). */
  lastPath: string | null;
}

function fileNameFor(event: MatrixEvent, index: number): string {
  const content = event.getContent() as Record<string, unknown>;
  const name = (content.filename as string | undefined) ?? (content.body as string | undefined);
  // `body` may be a caption rather than a file name; only trust it when it looks like one.
  if (name && /\.[a-z0-9]{2,5}$/i.test(name)) return name;
  const mime = (content.info as Record<string, unknown> | undefined)?.mimetype as
    | string
    | undefined;
  const ext = mime?.split('/')[1]?.replace('jpeg', 'jpg').replace(/\+.*$/, '') || 'png';
  return `image-${index + 1}.${ext}`;
}

/** The original (full-size) file of an image event as an object URL the caller must revoke. */
async function fullImageUrl(client: MatrixClient, event: MatrixEvent): Promise<string> {
  const content = event.getContent() as Record<string, unknown>;
  const encFile = getEncryptedFile(content);
  if (encFile) {
    const mime = (content.info as Record<string, unknown> | undefined)?.mimetype as
      | string
      | undefined;
    return URL.createObjectURL(await decryptMediaFile(client, encFile, mime));
  }
  const mxc = content.url as string | undefined;
  const cachedUrl = mxc ? await fetchMediaBlobUrl(mxc, client) : null;
  if (!cachedUrl) throw new Error('Image unavailable');
  // The fetch cache owns that URL; copy it so revoking ours cannot break the timeline.
  return URL.createObjectURL(await (await fetch(cachedUrl)).blob());
}

function browserDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Saves every image of a gallery, one at a time. In the desktop and mobile shells each goes to
 * the Downloads folder; in a browser each starts a normal download (the browser may ask once
 * before allowing several).
 */
export async function saveGalleryImages(
  client: MatrixClient,
  events: MatrixEvent[]
): Promise<SaveAllResult> {
  const result: SaveAllResult = { saved: 0, failed: 0, lastPath: null };
  for (const [i, event] of events.entries()) {
    let url: string | null = null;
    try {
      url = await fullImageUrl(client, event);
      const filename = fileNameFor(event, i);
      if (isTauri()) {
        result.lastPath = await saveDesktopDownload(url, filename);
      } else {
        browserDownload(url, filename);
        // Give the browser a moment per file; firing many downloads at once gets some dropped.
        await new Promise((r) => setTimeout(r, 250));
      }
      result.saved += 1;
    } catch (err) {
      console.warn('[gallery] save failed', event.getId(), err);
      result.failed += 1;
    } finally {
      const revoke = url;
      // A browser download reads the URL after click(); revoke a little later.
      if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 30_000);
    }
  }
  return result;
}
