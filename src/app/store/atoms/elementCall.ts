import { atom } from 'jotai';
import type { Room } from 'matrix-js-sdk';
import type { CallEmbed } from '@/app/plugins/call';

export type ElementCallPhase = 'idle' | 'joining' | 'joined';

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
  popOut: boolean;
  fullscreen: boolean;
  incoming: IncomingElementCall | null;
}

export const ELEMENT_CALL_INITIAL_STATE: ElementCallUiState = {
  roomId: null,
  phase: 'idle',
  voiceOnly: false,
  isMuted: false,
  isDeafened: false,
  isVideoMuted: false,
  popOut: false,
  fullscreen: false,
  incoming: null,
};

export const elementCallUiAtom = atom<ElementCallUiState>(ELEMENT_CALL_INITIAL_STATE);

export const elementCallEmbedAtom = atom<CallEmbed | null>(null);

export const isInElementCallAtom = atom((get) => get(elementCallUiAtom).roomId !== null);

export interface ElementCallActions {
  start: (
    room: Room,
    opts?: { voiceOnly?: boolean; popOut?: boolean }
  ) => Promise<CallEmbed | undefined>;
  hangup: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => void;
  togglePopOut: () => void;
  toggleFullscreen: () => void;
}

export const elementCallActionsAtom = atom<ElementCallActions | null>(null);
