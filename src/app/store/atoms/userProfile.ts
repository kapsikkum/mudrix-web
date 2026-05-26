import { atom } from 'jotai';

export interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface UserProfileState {
  userId: string;
  roomId?: string | null;
  anchorRect: AnchorRect;
}

export const userProfileAtom = atom<UserProfileState | null>(null);
