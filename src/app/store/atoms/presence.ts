import { atom } from 'jotai';

export type PresenceState = 'online' | 'offline' | 'unavailable';

export const presenceMapAtom = atom<Record<string, PresenceState>>({});

export const ownIdleAtom = atom<boolean>(false);
