import { atomWithStorage } from 'jotai/utils';
import { DEFAULT_THEME } from '@/theme/themes.css';
import {
  STORAGE_KEY_THEME,
  STORAGE_KEY_MESSAGE_LAYOUT,
  STORAGE_KEY_PREFERENCES,
  STORAGE_KEY_KEYBINDS,
} from '@/const/storageKeys';

export type MessageLayout = 'classic' | 'modern';
export type ThemeName = 'Carbon' | 'Parrot' | 'Ethereal';

export interface Keybinds {
  toggleMute: string;
  toggleVideo: string;
  disconnect: string;
}

export interface Preferences {
  typingIndicators: boolean;
  notificationSounds: boolean;
  sendReadReceipts: boolean;
}

export const themeAtom = atomWithStorage<ThemeName>(STORAGE_KEY_THEME, DEFAULT_THEME as ThemeName);

export const messageLayoutAtom = atomWithStorage<MessageLayout>(
  STORAGE_KEY_MESSAGE_LAYOUT,
  'modern'
);

export const keybindsAtom = atomWithStorage<Keybinds>(STORAGE_KEY_KEYBINDS, {
  toggleMute: '',
  toggleVideo: '',
  disconnect: '',
});

export const preferencesAtom = atomWithStorage<Preferences>(STORAGE_KEY_PREFERENCES, {
  typingIndicators: true,
  notificationSounds: true,
  sendReadReceipts: true,
});
