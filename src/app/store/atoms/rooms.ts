import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { STORAGE_KEY_CURRENT_SPACE, STORAGE_KEY_SPACE_ORDER } from '@/const/storageKeys';

export const currentRoomIdAtom = atom<string | null>(null);

export const currentSpaceIdAtom = atomWithStorage<string | null>(STORAGE_KEY_CURRENT_SPACE, null);

// Persisted user-defined ordering of spaces in the sidebar
export const spaceOrderAtom = atomWithStorage<string[]>(STORAGE_KEY_SPACE_ORDER, []);
