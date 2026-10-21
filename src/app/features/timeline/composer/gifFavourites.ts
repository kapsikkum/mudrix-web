import { STORAGE_KEY_GIF_FAVOURITES } from '@/const/storageKeys';
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

export function writeFavourites(list: GifItem[]): void {
  try {
    localStorage.setItem(
      accountStorageKey(STORAGE_KEY_GIF_FAVOURITES),
      JSON.stringify(list.slice(0, FAVOURITES_CAP))
    );
  } catch {
    // ignore
  }
}

export function favouriteKey(item: GifItem): string {
  return `${item.provider}:${item.sendUrl}`;
}

export function isFavourited(item: GifItem): boolean {
  const key = favouriteKey(item);
  return readFavourites().some((f) => favouriteKey(f) === key);
}

/** Reads the current list, toggles `item` in or out, persists and returns the new list. */
export function toggleFavourite(item: GifItem): GifItem[] {
  const key = favouriteKey(item);
  const current = readFavourites();
  const exists = current.some((f) => favouriteKey(f) === key);
  const next = exists ? current.filter((f) => favouriteKey(f) !== key) : [item, ...current];
  writeFavourites(next);
  return next;
}
