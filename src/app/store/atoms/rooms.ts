import { atom } from 'jotai';
import {
  STORAGE_KEY_CURRENT_SPACE,
  STORAGE_KEY_SPACE_ORDER,
  STORAGE_KEY_PINNED_SUBSPACES,
} from '@/const/storageKeys';
import { atomWithAccountStorage } from './accountStorage';

export const currentRoomIdAtom = atom<string | null>(null);

export const favouriteRoomsAtom = atom<ReadonlySet<string>>(new Set<string>());

export const currentSpaceIdAtom = atomWithAccountStorage<string | null>(
  STORAGE_KEY_CURRENT_SPACE,
  null
);

export const spaceOrderAtom = atomWithAccountStorage<string[]>(STORAGE_KEY_SPACE_ORDER, []);

export const pinnedSubSpacesAtom = atomWithAccountStorage<string[]>(
  STORAGE_KEY_PINNED_SUBSPACES,
  []
);
