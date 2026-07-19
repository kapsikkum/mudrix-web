import { atom } from 'jotai';

export const stickerPickerAtom = atom<{ x: number; y: number } | null>(null);

export const widgetsRefreshAtom = atom(0);
