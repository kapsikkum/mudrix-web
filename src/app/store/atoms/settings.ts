import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { DEFAULT_THEME } from '@/theme/themes.css';
import {
  DEFAULT_EMOJI_STYLE,
  DEFAULT_EMOJI_ONLY_SIZE,
  type EmojiStyle,
  type EmojiOnlySize,
} from '@/util/emojiStyle';
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
export type ThemeName = 'Carbon' | 'Parrot' | 'Hallow' | 'Ethereal';
export type MediaVisibility = 'always' | 'private' | 'never';
export type GifProviderPreference = 'giphy' | 'klipy';
export type TimeFormatPreference = 'auto' | '12h' | '24h';
export type DateFormatPreference = 'long' | 'dmy' | 'mdy' | 'ymd';

export interface Keybinds {
  toggleMute: string;
  toggleDeafen: string;
  toggleVideo: string;
  disconnect: string;
}

export interface Preferences {
  typingIndicators: boolean;
  notificationSounds: boolean;
  notificationSoundPack: string;
  notificationMentionSoundPack: string;
  notificationSoundVolume: number;
  notificationBanners: boolean;
  sendReadReceipts: boolean;
  prettifyLinks: boolean;
  showPresence: boolean;
  showRoomAvatars: boolean;
  autoplayGifs: boolean;
  mediaVisibility: MediaVisibility;
  themedAppIcon: boolean;
  gifProvider: GifProviderPreference;
  followSystemTheme: boolean;
  systemDarkTheme: ThemeName;
  systemLightTheme: ThemeName;
  uiZoom: number;
  hideMembershipEvents: boolean;
  hideProfileEvents: boolean;
  timeFormat: TimeFormatPreference;
  dateFormat: DateFormatPreference;
  compactMessages: boolean;
  /** Animated Mudrix profile effects (falling stars, snow, ...) on profile cards. */
  profileEffects: boolean;
  /** Which colour emoji font renders emoji (default Twemoji, like Element Web). */
  emojiStyle: EmojiStyle;
  /** Font size of emoji-only messages. */
  emojiOnlySize: EmojiOnlySize;
  /** Turn plain-text emoticons (:) :D XD) into Unicode emoji when sending. */
  emoticonsToEmoji: boolean;
  /** Slide-in animation for new messages (off: a message just appears). */
  messageSendAnimation: boolean;
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

export const DEFAULT_PREFERENCES: Preferences = {
  typingIndicators: true,
  notificationSounds: true,
  notificationSoundPack: 'element',
  notificationMentionSoundPack: '',
  notificationSoundVolume: 70,
  notificationBanners: false,
  sendReadReceipts: true,
  prettifyLinks: false,
  showPresence: false,
  showRoomAvatars: true,
  autoplayGifs: false,
  mediaVisibility: 'always',
  themedAppIcon: false,
  gifProvider: 'giphy',
  followSystemTheme: false,
  systemDarkTheme: 'Carbon',
  systemLightTheme: 'Ethereal',
  uiZoom: 100,
  hideMembershipEvents: false,
  hideProfileEvents: true,
  timeFormat: 'auto',
  dateFormat: 'long',
  compactMessages: false,
  profileEffects: true,
  emojiStyle: DEFAULT_EMOJI_STYLE,
  emojiOnlySize: DEFAULT_EMOJI_ONLY_SIZE,
  emoticonsToEmoji: true,
  messageSendAnimation: false,
};

export const preferencesAtom = atomWithStorage<Preferences>(
  STORAGE_KEY_PREFERENCES,
  DEFAULT_PREFERENCES
);

function preferenceFieldAtom<K extends keyof Preferences>(key: K) {
  return atom(
    (get) => get(preferencesAtom)[key] ?? DEFAULT_PREFERENCES[key],
    (_get, set, value: Preferences[K]) =>
      set(preferencesAtom, (prev) => ({ ...prev, [key]: value }))
  );
}

export const typingIndicatorsAtom = preferenceFieldAtom('typingIndicators');
export const notificationSoundsAtom = preferenceFieldAtom('notificationSounds');
export const notificationSoundPackAtom = preferenceFieldAtom('notificationSoundPack');
export const notificationMentionSoundPackAtom = preferenceFieldAtom('notificationMentionSoundPack');
export const notificationSoundVolumeAtom = preferenceFieldAtom('notificationSoundVolume');
export const notificationBannersAtom = preferenceFieldAtom('notificationBanners');
export const sendReadReceiptsAtom = preferenceFieldAtom('sendReadReceipts');
export const prettifyLinksAtom = preferenceFieldAtom('prettifyLinks');
export const showPresenceAtom = preferenceFieldAtom('showPresence');
export const showRoomAvatarsAtom = preferenceFieldAtom('showRoomAvatars');
export const autoplayGifsAtom = preferenceFieldAtom('autoplayGifs');
export const mediaVisibilityAtom = preferenceFieldAtom('mediaVisibility');
export const themedAppIconAtom = preferenceFieldAtom('themedAppIcon');
export const gifProviderAtom = preferenceFieldAtom('gifProvider');
export const followSystemThemeAtom = preferenceFieldAtom('followSystemTheme');
export const systemDarkThemeAtom = preferenceFieldAtom('systemDarkTheme');
export const systemLightThemeAtom = preferenceFieldAtom('systemLightTheme');
export const uiZoomAtom = preferenceFieldAtom('uiZoom');
export const hideMembershipEventsAtom = preferenceFieldAtom('hideMembershipEvents');
export const hideProfileEventsAtom = preferenceFieldAtom('hideProfileEvents');
export const timeFormatAtom = preferenceFieldAtom('timeFormat');
export const dateFormatAtom = preferenceFieldAtom('dateFormat');
export const compactMessagesAtom = preferenceFieldAtom('compactMessages');
export const profileEffectsAtom = preferenceFieldAtom('profileEffects');
export const emojiStyleAtom = preferenceFieldAtom('emojiStyle');
export const emojiOnlySizeAtom = preferenceFieldAtom('emojiOnlySize');
export const emoticonsToEmojiAtom = preferenceFieldAtom('emoticonsToEmoji');
export const messageSendAnimationAtom = preferenceFieldAtom('messageSendAnimation');

const prefersDarkQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

/** Live view of the OS colour scheme (true = dark). */
export const systemPrefersDarkAtom = (() => {
  const base = atom<boolean>(prefersDarkQuery?.matches ?? true);
  base.onMount = (set) => {
    if (!prefersDarkQuery) return undefined;
    set(prefersDarkQuery.matches);
    const listener = (e: MediaQueryListEvent) => set(e.matches);
    prefersDarkQuery.addEventListener('change', listener);
    return () => prefersDarkQuery.removeEventListener('change', listener);
  };
  return base;
})();

/** The theme actually applied: the manual choice, or the system-mapped one when following the OS. */
export const effectiveThemeAtom = atom<ThemeName>((get) => {
  if (!get(followSystemThemeAtom)) return get(themeAtom);
  return get(systemPrefersDarkAtom) ? get(systemDarkThemeAtom) : get(systemLightThemeAtom);
});

const rawStringStorage = {
  getItem: (key: string, init: string) => localStorage.getItem(key) ?? init,
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const languageAtom = atomWithStorage<string>(STORAGE_KEY_LANGUAGE, 'en', rawStringStorage);

export const developerModeAtom = atomWithStorage<boolean>(STORAGE_KEY_DEVELOPER_MODE, false);

export const micMutedAtom = atomWithStorage<boolean>(STORAGE_KEY_MIC_MUTED, false);

export const deafenedAtom = atomWithStorage<boolean>(STORAGE_KEY_DEAFENED, false);
