import type { MatrixClient } from 'matrix-js-sdk';
import { logger } from './log';
import { routeToOutput } from '@/util/notificationSounds';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { getSoundboardDevicePrefs, soundboardRuntime } from './runtime';
import {
  SOUNDBOARD_MAX_DURATION_MS,
  SOUNDBOARD_MAX_SIZE_BYTES,
  type SoundboardMimetype,
} from './types';
import { addSoundboardPlaying, clearSoundboardPlaying, removeSoundboardPlaying } from './playing';

/** Decoded-enough clips kept for instant replay (the blob behind an object URL). */
const CACHE_SIZE = 20;
/** A little over the upload limit, so a server re-encoding a clip does not make it unplayable. */
const MAX_DOWNLOAD_BYTES = SOUNDBOARD_MAX_SIZE_BYTES * 1.5;
/** A clip never plays longer than this, whatever its file says. */
const MAX_PLAY_MS = SOUNDBOARD_MAX_DURATION_MS + 1000;
const MAX_CONCURRENT = 4;
const REVOKE_DELAY_MS = 15_000;

const cache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
const active = new Map<string, HTMLAudioElement>();
let playCounter = 0;

function remember(url: string, objectUrl: string): void {
  cache.delete(url);
  cache.set(url, objectUrl);
  while (cache.size > CACHE_SIZE) {
    const oldest = cache.keys().next().value as string;
    const evicted = cache.get(oldest);
    cache.delete(oldest);
    // Revoke late: the evicted clip may still be playing.
    if (evicted) window.setTimeout(() => URL.revokeObjectURL(evicted), REVOKE_DELAY_MS);
  }
}

async function download(
  client: MatrixClient | null,
  url: string,
  mimetype: SoundboardMimetype
): Promise<string> {
  const isMxc = url.startsWith('mxc://');
  let httpUrl = url;
  const headers: Record<string, string> = {};
  if (isMxc) {
    if (!client) throw new Error('no client');
    // Authenticated media (MSC3916): the download endpoint needs the access token.
    httpUrl = mxcUrlToHttp(client, url, undefined, undefined, undefined, false, true, true);
    if (!httpUrl) throw new Error('bad mxc url');
    const token = client.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(httpUrl, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const length = Number(res.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_DOWNLOAD_BYTES) throw new Error('clip too large');
  const raw = await res.blob();
  if (raw.size > MAX_DOWNLOAD_BYTES) throw new Error('clip too large');
  // Servers often answer application/octet-stream; the element wants the real type.
  return URL.createObjectURL(new Blob([raw], { type: mimetype }));
}

/** Downloads (or reuses) a clip and returns an object URL for it. Rejects on any failure. */
export function loadClip(
  client: MatrixClient | null,
  url: string,
  mimetype: SoundboardMimetype
): Promise<string> {
  const cached = cache.get(url);
  if (cached) {
    remember(url, cached);
    return Promise.resolve(cached);
  }
  let pending = inFlight.get(url);
  if (!pending) {
    pending = download(client, url, mimetype)
      .then((objectUrl) => {
        remember(url, objectUrl);
        return objectUrl;
      })
      .finally(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  return pending;
}

/** Warms the cache for a clip about to be used. Never throws. */
export function prefetchClip(
  client: MatrixClient | null,
  url: string,
  mimetype: SoundboardMimetype
): void {
  loadClip(client, url, mimetype).catch(() => {});
}

export interface LocalPlayRequest {
  client: MatrixClient | null;
  /** Who pressed it (shown in the "playing" list). */
  senderId: string;
  soundId: string;
  name: string;
  emoji?: string;
  /** mxc:// URI or an http(s) URL of a bundled clip. */
  url: string;
  mimetype: SoundboardMimetype;
  /** The clip's own gain, 0..1. */
  volume: number;
  durationMs?: number;
}

/**
 * Plays a clip on this device at the soundboard volume, on the chosen speaker. Resolves to false
 * (never rejects) when it did not play: soundboard off, too many clips at once, download failed.
 */
export async function playClipLocal(req: LocalPlayRequest): Promise<boolean> {
  try {
    if (active.size >= MAX_CONCURRENT) return false;
    const objectUrl = await loadClip(req.client, req.url, req.mimetype);
    // Things may have changed while the clip downloaded.
    const prefs = getSoundboardDevicePrefs();
    if (!prefs.enabled || soundboardRuntime.deafened || active.size >= MAX_CONCURRENT) return false;

    const audio = new Audio(objectUrl);
    const gain =
      Math.min(1, Math.max(0, req.volume)) * (Math.min(100, Math.max(0, prefs.volume)) / 100);
    audio.volume = gain;
    routeToOutput(audio);

    playCounter += 1;
    const key = `${req.senderId}:${req.soundId}:${playCounter}`;
    const declared = req.durationMs && req.durationMs > 0 ? req.durationMs : MAX_PLAY_MS;
    const durationMs = Math.min(declared, MAX_PLAY_MS);
    active.set(key, audio);
    addSoundboardPlaying({
      key,
      senderId: req.senderId,
      soundId: req.soundId,
      name: req.name,
      emoji: req.emoji,
      startedAt: Date.now(),
      durationMs,
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      active.delete(key);
      removeSoundboardPlaying(key);
      audio.pause();
    };
    // A file claiming 5 s but actually running longer is cut off.
    const timer = window.setTimeout(finish, durationMs + 400);
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    await audio.play().catch(() => finish());
    return !done;
  } catch (err) {
    logger.warn('[soundboard] could not play a clip', err);
    return false;
  }
}

/** Stops every clip now (call ended, deafened, soundboard turned off). */
export function stopAllSoundboard(): void {
  active.forEach((audio) => {
    try {
      audio.pause();
    } catch {
      // ignore
    }
  });
  active.clear();
  clearSoundboardPlaying();
}
