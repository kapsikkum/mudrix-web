import { atom } from 'jotai';

export interface CallState {
  incoming: boolean;
  active: boolean;
  callerId: string | null;
  callerName: string | null;
  status: string;
  isMuted: boolean;
  roomId: string | null;
}

export const CALL_INITIAL_STATE: CallState = {
  incoming: false,
  active: false,
  callerId: null,
  callerName: null,
  status: '',
  isMuted: false,
  roomId: null,
};

export const callStateAtom = atom<CallState>(CALL_INITIAL_STATE);

export const placeCallAtom = atom<((roomId: string) => void) | null>(null);

export interface CommandActions {
  placeCall?: (roomId: string) => Promise<void> | void;
  joinVoice?: (roomId: string, domain: string) => Promise<void> | void;
  hangup?: () => void;
  leaveVoice?: () => Promise<void> | void;
}

export const commandActionsAtom = atom<CommandActions | null>(null);
