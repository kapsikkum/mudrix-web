import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { STORAGE_KEY_CURRENT_SPACE } from '@/const/storageKeys';

export const currentRoomIdAtom = atom<string | null>(null);

export const currentSpaceIdAtom = atomWithStorage<string | null>(STORAGE_KEY_CURRENT_SPACE, null);

// Map of roomId -> room (updated by MatrixClient events)
export const roomsUpdatedAtom = atom(0); // increment to trigger re-renders
