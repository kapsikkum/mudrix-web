import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { userIdAtom } from './auth';

export type PresenceState = 'online' | 'offline' | 'unavailable';

export type PresenceOverride = 'auto' | PresenceState;

export const presenceMapAtom = atom<Record<string, PresenceState>>({});

export const ownIdleAtom = atom<boolean>(false);

export const presenceOverrideAtom = atomWithStorage<PresenceOverride>(
  'wz_presence_override',
  'auto'
);

export const ownPresenceAtom = atom<PresenceState | undefined>((get) => {
  const uid = get(userIdAtom);
  return uid ? get(presenceMapAtom)[uid] : undefined;
});
