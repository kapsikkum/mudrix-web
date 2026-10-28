import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { STORAGE_KEY_YOUTUBE_CONSENT } from '@/const/storageKeys';
import { mudrixKey } from '@/util/namespace';

/**
 * Watch together is carried by room events in the call's room, sent only when someone starts,
 * plays, pauses or seeks (a handful per video), so the room history stays small. Everyone in the
 * call sees the same events and plays the video to the same position.
 */
export const WATCH_EVENT_TYPE = mudrixKey('watch');

export interface WatchState {
  videoId: string;
  startedBy: string;
  playing: boolean;
  /** Seconds into the video at `at`. */
  position: number;
  /** When `position` was true, on this device's clock. */
  at: number;
}

export type WatchMessage =
  | { t: 'state'; videoId: string; startedBy: string; playing: boolean; position: number }
  | { t: 'stop' };

export interface WatchActions {
  start: (videoId: string) => void;
  update: (playing: boolean, position: number) => void;
  stop: () => void;
}

export const watchStateAtom = atom<WatchState | null>(null);
export const watchActionsAtom = atom<WatchActions | null>(null);
export const watchDialogOpenAtom = atom(false);

/** The video this device has opted in to loading: nothing from YouTube loads before that. */
export const watchingVideoIdAtom = atom<string | null>(null);

export const youtubeConsentAtom = atomWithStorage(STORAGE_KEY_YOUTUBE_CONSENT, false);

export function youtubeWatchUrl(videoId: string, seconds = 0): string {
  const t = Math.floor(seconds);
  return `https://www.youtube.com/watch?v=${videoId}${t > 0 ? `&t=${t}s` : ''}`;
}

export function expectedPosition(state: WatchState, now = Date.now()): number {
  return state.playing ? state.position + (now - state.at) / 1000 : state.position;
}

const ID_RE = /^[\w-]{11}$/;

export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (ID_RE.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id =
      url.searchParams.get('v') ??
      /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname)?.[1] ??
      null;
  }
  return id && ID_RE.test(id) ? id : null;
}

/** An event's content as a message, or null when it is not a well-formed one. */
export function parseWatchMessage(content: unknown): WatchMessage | null {
  if (!content || typeof content !== 'object') return null;
  const msg = content as Record<string, unknown>;
  if (msg.t === 'stop') return { t: 'stop' };
  if (
    msg.t !== 'state' ||
    typeof msg.videoId !== 'string' ||
    !ID_RE.test(msg.videoId) ||
    typeof msg.startedBy !== 'string' ||
    typeof msg.playing !== 'boolean' ||
    typeof msg.position !== 'number' ||
    !Number.isFinite(msg.position)
  ) {
    return null;
  }
  return {
    t: 'state',
    videoId: msg.videoId,
    startedBy: msg.startedBy,
    playing: msg.playing,
    position: Math.max(0, msg.position),
  };
}
