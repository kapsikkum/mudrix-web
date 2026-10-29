import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import type { Room } from 'matrix-js-sdk';
import type { CallSession } from 'mudrix-rtc';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import {
  STORAGE_KEY_CALL_RTC_OVERRIDE,
  STORAGE_KEY_CALL_USER_AUDIO,
  STORAGE_KEY_CALL_SHOW_REACTIONS,
  STORAGE_KEY_CALL_VOLUMES,
  STORAGE_KEY_SHARE_SCREEN_AUDIO,
} from '@/const/storageKeys';
import { isVoiceRoom } from '@/util/matrix';
import { atomWithAccountStorage } from './accountStorage';
import { currentRoomIdAtom } from './rooms';
import { keybindsAtom, pushToTalkEnabledAtom } from './settings';

export type CallPhase = 'idle' | 'joining' | 'joined';

export type CallPresentation = 'hidden' | 'tile' | 'room' | 'fullscreen';

export type CallView = 'hidden' | 'docked' | 'tile' | 'fullscreen';

export interface IncomingCall {
  roomId: string;
  callerId: string;
  callerName: string;
  voiceOnly: boolean;
}

export interface CallUiState {
  roomId: string | null;
  phase: CallPhase;
  voiceOnly: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isSpotlight: boolean;
  presentation: CallPresentation;
  incoming: IncomingCall | null;
}

export const CALL_INITIAL_STATE: CallUiState = {
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

export const callUiAtom = atom<CallUiState>(CALL_INITIAL_STATE);

/** The running call: the engine in rtc/ (MatrixRTC membership + a LiveKit connection). */
export const callSessionAtom = atom<CallSession | null>(null);

/** A call being started in this room, before its session exists (the server check is still running). */
export const pendingCallRoomIdAtom = atom<string | null>(null);

/** The room of a call that was just left, until the membership is gone. */
export const leavingCallRoomIdAtom = atom<string | null>(null);

/** The call's side panel, when one is open. */
export const callPanelAtom = atom<'reactions' | null>(null);

export const showNonVideoParticipantsAtom = atom(true);

export const showOwnScreenShareAtom = atom(true);

export interface CallUserAudio {
  volume: number;
  muted: boolean;
  streamVolume?: number;
}

/** Per-person call volume, mute and stream volume, kept per account. */
export const callUserAudioAtom = atomWithAccountStorage<Record<string, CallUserAudio>>(
  STORAGE_KEY_CALL_USER_AUDIO,
  {}
);

export interface CallVolumes {
  input: number;
  output: number;
}

/** Whether other people's reactions and raised hands show on their tiles. */
export const callShowReactionsAtom = atomWithStorage<boolean>(
  STORAGE_KEY_CALL_SHOW_REACTIONS,
  true
);

export const callVolumesAtom = atomWithStorage<CallVolumes>(STORAGE_KEY_CALL_VOLUMES, {
  input: 1,
  output: 1,
});

export const shareScreenAudioAtom = atomWithStorage<boolean>(STORAGE_KEY_SHARE_SCREEN_AUDIO, true);

export const isInCallAtom = atom((get) => get(callUiAtom).roomId !== null);

export const callRoomIdAtom = atom((get) => get(callUiAtom).roomId);

export const callIsVoiceRoomAtom = atom((get) => {
  const room = get(callSessionAtom)?.matrixRoom;
  return !!room && isVoiceRoom(room);
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

export const callEffectiveViewAtom = atom<CallView>((get) => {
  const { roomId, presentation } = get(callUiAtom);
  if (roomId === null) return 'hidden';
  if (presentation === 'hidden') return 'hidden';
  if (presentation === 'tile') return 'tile';
  if (get(currentRoomIdAtom) !== roomId) return 'hidden';
  if (presentation === 'fullscreen' || get(callDedicatedScreenAtom)) return 'fullscreen';
  return get(callIsVoiceRoomAtom) ? 'fullscreen' : 'docked';
});

export interface CallActions {
  start: (
    room: Room,
    opts?: { voiceOnly?: boolean; presentation?: CallPresentation }
  ) => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  setMicrophone: (enabled: boolean) => void;
  toggleDeafen: () => void;
  toggleVideo: () => void;
  toggleScreenshare: () => void;
  setSpotlight: (spotlight: boolean) => void;
  /** With an emoji, sends that reaction; without, opens the reactions panel. */
  openReactions: (emoji?: string) => void;
  openSettings: () => void;
  setPresentation: (presentation: CallPresentation) => void;
}

export const callActionsAtom = atom<CallActions | null>(null);

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

export interface CommandActions {
  placeCall?: (roomId: string) => Promise<void> | void;
  joinVoice?: (roomId: string) => Promise<void> | void;
  hangup?: () => void;
}

export const commandActionsAtom = atom<CommandActions | null>(null);

/** Push to talk is on and has a key bound. */
export const pushToTalkModeAtom = atom(
  (get) => get(pushToTalkEnabledAtom) && !!get(keybindsAtom).pushToTalk
);

/** The push-to-talk key is held down right now. */
export const pushToTalkHeldAtom = atom(false);
