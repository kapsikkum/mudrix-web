import { atom } from 'jotai';
import { userIdAtom } from './auth';
import { STORAGE_KEY_PRESENCE_OVERRIDE } from '@/const/storageKeys';
import { atomWithAccountStorage } from './accountStorage';

export type PresenceState = 'online' | 'offline' | 'unavailable';

export type PresenceOverride = 'auto' | PresenceState;

export const presenceMapAtom = atom<Record<string, PresenceState>>({});

export const presenceOverrideAtom = atomWithAccountStorage<PresenceOverride>(
  STORAGE_KEY_PRESENCE_OVERRIDE,
  'auto'
);

export const ownPresenceAtom = atom<PresenceState | undefined>((get) => {
  const uid = get(userIdAtom);
  return uid ? get(presenceMapAtom)[uid] : undefined;
});
