import { STORAGE_KEY_GIF_FAVOURITES, STORAGE_KEY_GIF_FAVOURITES_AT } from '@/const/storageKeys';
import { accountStorageKey } from '@/const/accountStorage';
import type { GifItem, GifProviderId } from './gifProviders';

export const FAVOURITES_CAP = 200;

function isProviderId(value: unknown): value is GifProviderId {
  return value === 'giphy' || value === 'klipy';
}

function legacyFavourite(url: string): GifItem {
  // Legacy favourites only stored a URL and were always Giphy.
  return {
    id: url,
    title: '',
    thumbUrl: url,
    sendUrl: url,
    width: 0,
    height: 0,
    provider: 'giphy',
  };
}

export function parseFavourite(entry: unknown): GifItem | null {
  if (typeof entry === 'string') return entry ? legacyFavourite(entry) : null;
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;
  if (typeof obj.sendUrl === 'string' && obj.sendUrl) {
    const provider = isProviderId(obj.provider) ? obj.provider : 'giphy';
    const mxcUrl = typeof obj.mxcUrl === 'string' && obj.mxcUrl ? obj.mxcUrl : undefined;
    const mxcInfo =
      obj.mxcInfo && typeof obj.mxcInfo === 'object'
        ? (obj.mxcInfo as GifItem['mxcInfo'])
        : undefined;
    return {
      id: typeof obj.id === 'string' ? obj.id : obj.sendUrl,
      title: typeof obj.title === 'string' ? obj.title : '',
      thumbUrl: typeof obj.thumbUrl === 'string' && obj.thumbUrl ? obj.thumbUrl : obj.sendUrl,
      sendUrl: obj.sendUrl,
      width: Number(obj.width) || 0,
      height: Number(obj.height) || 0,
      provider,
      mxcUrl,
      mxcInfo,
      mxcFile:
        obj.mxcFile && typeof obj.mxcFile === 'object'
          ? (obj.mxcFile as GifItem['mxcFile'])
          : undefined,
    };
  }
  // Oldest format: a raw Giphy gif object.
  const images = obj.images as Record<string, { url?: string }> | undefined;
  const url = images?.downsized?.url ?? images?.original?.url ?? images?.fixed_width?.url ?? '';
  return url ? legacyFavourite(url) : null;
}

export function readFavourites(): GifItem[] {
  try {
    const raw = localStorage.getItem(accountStorageKey(STORAGE_KEY_GIF_FAVOURITES));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const items: GifItem[] = [];
    for (const entry of parsed) {
      const item = parseFavourite(entry);
      if (!item) continue;
      const key = favouriteKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}

export const FAVOURITES_CHANGED_EVENT = 'mudrix:gif-favourites-changed';

export function readFavouritesUpdatedAt(): number {
  try {
    return Number(localStorage.getItem(accountStorageKey(STORAGE_KEY_GIF_FAVOURITES_AT))) || 0;
  } catch {
    return 0;
  }
}

/** `updatedAt` is passed when applying a remote copy; otherwise this is a local edit (now). */
export function writeFavourites(list: GifItem[], updatedAt?: number): void {
  try {
    const trimmed = list.slice(0, FAVOURITES_CAP);
    const serialised = JSON.stringify(trimmed);
    const key = accountStorageKey(STORAGE_KEY_GIF_FAVOURITES);
    // The picker re-writes its list on mount; only a real change counts as an edit.
    if (updatedAt === undefined && localStorage.getItem(key) === serialised) return;
    localStorage.setItem(key, serialised);
    localStorage.setItem(
      accountStorageKey(STORAGE_KEY_GIF_FAVOURITES_AT),
      String(updatedAt ?? Date.now())
    );
    if (updatedAt === undefined) window.dispatchEvent(new Event(FAVOURITES_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** Event content field recording which provider GIF a sent message came from. */
export const GIF_SOURCE_FIELD = 'xyz.mudrix.gif';

export function readGifSource(
  content: Record<string, unknown>
): { provider: GifProviderId; id: string } | null {
  const src = content[GIF_SOURCE_FIELD] as Record<string, unknown> | undefined;
  if (!src || typeof src.id !== 'string' || !src.id || !isProviderId(src.provider)) return null;
  return { provider: src.provider, id: src.id };
}

/** Where the GIF lives on the homeserver, when it was favourited from a message. */
function mediaUrl(item: GifItem): string | undefined {
  return item.mxcFile?.url ?? item.mxcUrl;
}

export function favouriteKey(item: GifItem): string {
  return `${item.provider}:${item.id}`;
}

/** Same GIF: the same provider item, or the same uploaded media. */
export function sameGif(a: GifItem, b: GifItem): boolean {
  if (favouriteKey(a) === favouriteKey(b)) return true;
  const url = mediaUrl(a);
  return url !== undefined && url === mediaUrl(b);
}

export function isFavourited(item: GifItem): boolean {
  return readFavourites().some((f) => sameGif(f, item));
}

/** Reads the current list, toggles `item` in or out, persists and returns the new list. */
export function toggleFavourite(item: GifItem): GifItem[] {
  const current = readFavourites();
  const exists = current.some((f) => sameGif(f, item));
  const next = exists ? current.filter((f) => !sameGif(f, item)) : [item, ...current];
  writeFavourites(next);
  return next;
}
