import type { IEncryptedFile } from '@/app/features/timeline/encryptedMedia';

export type GifProviderId = 'giphy' | 'klipy';

export const GIF_PROVIDER_IDS: readonly GifProviderId[] = ['giphy', 'klipy'];

export interface GifItem {
  id: string;
  title: string;
  /** URL shown in the picker grid. */
  thumbUrl: string;
  /** URL downloaded and re-uploaded when the GIF is sent. */
  sendUrl: string;
  width: number;
  height: number;
  provider: GifProviderId;
  /**
   * Set when favourited directly from a message already on the homeserver (e.g. via the
   * timeline's favourite-star button) instead of from a provider search. When present,
   * sending this favourite reuses the existing mxc:// upload instead of downloading
   * sendUrl and re-uploading it - thumbUrl is then this same mxc:// URL too, since it
   * needs an authenticated fetch rather than a plain <img src>.
   */
  mxcUrl?: string;
  mxcInfo?: { mimetype?: string; size?: number; is_animated?: boolean };
  /** Encrypted-room GIF: the message's encrypted file descriptor, reused as-is when sending. */
  mxcFile?: IEncryptedFile & { url: string };
}

export interface GifPage {
  items: GifItem[];
  /** Cursor (Giphy: offset, Klipy: 1-based page) for the next request, or null when exhausted. */
  nextCursor: number | null;
}

export interface GifRequestOptions {
  cursor?: number;
  signal?: AbortSignal;
}

export interface GifProvider {
  id: GifProviderId;
  displayName: string;
  /** CDN hosts the GIF media is loaded from (API calls go to api.giphy.com / api.klipy.com). */
  hosts: string[];
  trending(opts?: GifRequestOptions): Promise<GifPage>;
  search(query: string, opts?: GifRequestOptions): Promise<GifPage>;
}

export class GifRateLimitedError extends Error {
  constructor() {
    super('rate limited');
    this.name = 'GifRateLimitedError';
  }
}

/** No API key for this provider was embedded in this build. */
export class GifNotConfiguredError extends Error {
  constructor() {
    super('no API key configured in this build');
    this.name = 'GifNotConfiguredError';
  }
}

export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
