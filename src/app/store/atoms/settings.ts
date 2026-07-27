import { atomWithStorage } from 'jotai/utils';
import { DEFAULT_THEME } from '@/theme/themes.css';
import {
  STORAGE_KEY_THEME,
  STORAGE_KEY_MESSAGE_LAYOUT,
  STORAGE_KEY_PREFERENCES,
  STORAGE_KEY_KEYBINDS,
  STORAGE_KEY_LANGUAGE,
  STORAGE_KEY_ROOM_SORT,
  STORAGE_KEY_DEVELOPER_MODE,
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
  notificationBanners: boolean;
  sendReadReceipts: boolean;
  prettifyLinks: boolean;
  showPresence: boolean;
  composerMenuPoll: boolean;
  composerMenuEmoji: boolean;
  composerMenuSticker: boolean;
  composerMenuGif: boolean;
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
  notificationBanners: false,
  sendReadReceipts: true,
  prettifyLinks: false,
  showPresence: false,
  composerMenuPoll: true,
  composerMenuEmoji: false,
  composerMenuSticker: false,
  composerMenuGif: false,
});

const rawStringStorage = {
  getItem: (key: string, init: string) => localStorage.getItem(key) ?? init,
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const languageAtom = atomWithStorage<string>(STORAGE_KEY_LANGUAGE, 'en', rawStringStorage);

export type RoomSort = 'name' | 'recentActivity';
export const roomSortAtom = atomWithStorage<RoomSort>(STORAGE_KEY_ROOM_SORT, 'name');

export const developerModeAtom = atomWithStorage<boolean>(STORAGE_KEY_DEVELOPER_MODE, false);
