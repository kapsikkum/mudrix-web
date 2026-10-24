import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { Room } from 'matrix-js-sdk';
import type { CallEmbed } from '@/app/plugins/call';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import { STORAGE_KEY_CALL_RTC_OVERRIDE } from '@/const/storageKeys';
import { isVoiceRoom } from '@/util/matrix';
import { currentRoomIdAtom } from './rooms';

export type ElementCallPhase = 'idle' | 'joining' | 'joined';

export type ElementCallPresentation = 'hidden' | 'tile' | 'room' | 'fullscreen';

export type ElementCallView = 'hidden' | 'docked' | 'tile' | 'fullscreen';

export interface IncomingElementCall {
  roomId: string;
  callerId: string;
  callerName: string;
  voiceOnly: boolean;
}

export interface ElementCallUiState {
  roomId: string | null;
  phase: ElementCallPhase;
  voiceOnly: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isSpotlight: boolean;
  presentation: ElementCallPresentation;
  incoming: IncomingElementCall | null;
}

export const ELEMENT_CALL_INITIAL_STATE: ElementCallUiState = {
  roomId: null,
  phase: 'idle',
  voiceOnly: false,
  isMuted: false,
  isDeafened: false,
  isVideoMuted: false,
  isScreenSharing: false,
  isSpotlight: true,
  presentation: 'hidden',
  incoming: null,
};

export const elementCallUiAtom = atom<ElementCallUiState>(ELEMENT_CALL_INITIAL_STATE);

export const elementCallEmbedAtom = atom<CallEmbed | null>(null);

export const isInElementCallAtom = atom((get) => get(elementCallUiAtom).roomId !== null);

export const elementCallRoomIdAtom = atom((get) => get(elementCallUiAtom).roomId);

export const elementCallIsVoiceRoomAtom = atom((get) => {
  const embed = get(elementCallEmbedAtom);
  return !!embed && isVoiceRoom(embed.room);
});

/**
 * Phones and touch tablets: a call there is a screen of its own, not a strip above the chat. Tracks
 * the media query while something is subscribed.
 */
export const callDedicatedScreenAtom = atom(
  typeof window !== 'undefined' && window.matchMedia(PANEL_OVERLAY_QUERY).matches
);
callDedicatedScreenAtom.onMount = (set) => {
  const query = window.matchMedia(PANEL_OVERLAY_QUERY);
  const update = () => set(query.matches);
  update();
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
};

export const elementCallEffectiveViewAtom = atom<ElementCallView>((get) => {
  const { roomId, presentation } = get(elementCallUiAtom);
  if (roomId === null) return 'hidden';
  if (presentation === 'hidden') return 'hidden';
  if (presentation === 'tile') return 'tile';
  if (get(currentRoomIdAtom) !== roomId) return 'hidden';
  if (presentation === 'fullscreen' || get(callDedicatedScreenAtom)) return 'fullscreen';
  return get(elementCallIsVoiceRoomAtom) ? 'fullscreen' : 'docked';
});

export interface ElementCallActions {
  start: (
    room: Room,
    opts?: { voiceOnly?: boolean; presentation?: ElementCallPresentation }
  ) => Promise<CallEmbed | undefined>;
  hangup: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => void;
  toggleScreenshare: () => void;
  setSpotlight: (spotlight: boolean) => void;
  /** With an emoji, sends that reaction; without, opens Element Call's own picker. */
  openReactions: (emoji?: string) => void;
  openSettings: () => void;
  setPresentation: (presentation: ElementCallPresentation) => void;
}

export const elementCallActionsAtom = atom<ElementCallActions | null>(null);

const sessionOverrideStorage = {
  getItem: (key: string, init: string | null) => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as string | null) : init;
    } catch {
      return init;
    }
  },
  setItem: (key: string, value: string | null) => {
    if (value === null) {
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, JSON.stringify(value));
    }
  },
  removeItem: (key: string) => sessionStorage.removeItem(key),
};

export const callRtcOverrideDomainAtom = atomWithStorage<string | null>(
  STORAGE_KEY_CALL_RTC_OVERRIDE,
  null,
  sessionOverrideStorage
);
