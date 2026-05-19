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


