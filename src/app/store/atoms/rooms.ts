import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import {
  STORAGE_KEY_CURRENT_SPACE,
  STORAGE_KEY_SPACE_ORDER,
  STORAGE_KEY_PINNED_SUBSPACES,
} from '@/const/storageKeys';

export const currentRoomIdAtom = atom<string | null>(null);

export const favouriteRoomsAtom = atom<ReadonlySet<string>>(new Set<string>());

export const currentSpaceIdAtom = atomWithStorage<string | null>(STORAGE_KEY_CURRENT_SPACE, null);

export const spaceOrderAtom = atomWithStorage<string[]>(STORAGE_KEY_SPACE_ORDER, []);

export const pinnedSubSpacesAtom = atomWithStorage<string[]>(STORAGE_KEY_PINNED_SUBSPACES, []);
