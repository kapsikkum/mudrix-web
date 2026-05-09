import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

export const currentRoomIdAtom = atom<string | null>(null);

export const currentSpaceIdAtom = atomWithStorage<string | null>('wizardchat-current-space', null);

// Map of roomId -> room (updated by MatrixClient events)
export const roomsUpdatedAtom = atom(0); // increment to trigger re-renders
