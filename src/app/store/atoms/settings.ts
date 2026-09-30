import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { DEFAULT_THEME } from '@/theme/themes.css';
import {
  STORAGE_KEY_THEME,
  STORAGE_KEY_MESSAGE_LAYOUT,
  STORAGE_KEY_PREFERENCES,
  STORAGE_KEY_KEYBINDS,
  STORAGE_KEY_LANGUAGE,
  STORAGE_KEY_DEVELOPER_MODE,
  STORAGE_KEY_MIC_MUTED,
  STORAGE_KEY_DEAFENED,
} from '@/const/storageKeys';

export type MessageLayout = 'classic' | 'modern';
export type ThemeName = 'Carbon' | 'Parrot' | 'Ethereal';
export type MediaVisibility = 'always' | 'private' | 'never';

export interface Keybinds {
  toggleMute: string;
  toggleDeafen: string;
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
  autoplayGifs: boolean;
  mediaVisibility: MediaVisibility;
}

export const themeAtom = atomWithStorage<ThemeName>(STORAGE_KEY_THEME, DEFAULT_THEME as ThemeName);

export const messageLayoutAtom = atomWithStorage<MessageLayout>(
  STORAGE_KEY_MESSAGE_LAYOUT,
  'modern'
);

export const keybindsAtom = atomWithStorage<Keybinds>(STORAGE_KEY_KEYBINDS, {
  toggleMute: '',
  toggleDeafen: '',
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
  autoplayGifs: false,
  mediaVisibility: 'always',
});

function preferenceFieldAtom<K extends keyof Preferences>(key: K) {
  return atom(
    (get) => get(preferencesAtom)[key],
    (_get, set, value: Preferences[K]) =>
      set(preferencesAtom, (prev) => ({ ...prev, [key]: value }))
  );
}

export const typingIndicatorsAtom = preferenceFieldAtom('typingIndicators');
export const notificationSoundsAtom = preferenceFieldAtom('notificationSounds');
export const notificationBannersAtom = preferenceFieldAtom('notificationBanners');
export const sendReadReceiptsAtom = preferenceFieldAtom('sendReadReceipts');
export const prettifyLinksAtom = preferenceFieldAtom('prettifyLinks');
export const showPresenceAtom = preferenceFieldAtom('showPresence');
export const autoplayGifsAtom = preferenceFieldAtom('autoplayGifs');
export const mediaVisibilityAtom = preferenceFieldAtom('mediaVisibility');

const rawStringStorage = {
  getItem: (key: string, init: string) => localStorage.getItem(key) ?? init,
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const languageAtom = atomWithStorage<string>(STORAGE_KEY_LANGUAGE, 'en', rawStringStorage);

export const developerModeAtom = atomWithStorage<boolean>(STORAGE_KEY_DEVELOPER_MODE, false);

export const micMutedAtom = atomWithStorage<boolean>(STORAGE_KEY_MIC_MUTED, false);

export const deafenedAtom = atomWithStorage<boolean>(STORAGE_KEY_DEAFENED, false);
