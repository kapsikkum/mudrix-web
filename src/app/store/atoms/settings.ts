import type { CustomTheme } from '@/theme/customThemes';
import { atom } from 'jotai';
import type { UiDensity } from '@/theme/uiDensity';
import { atomWithStorage } from 'jotai/utils';
import type { SoundKind } from '@/util/notificationSounds';
import { DEFAULT_THEME } from '@/theme/themes.css';
import {
  DEFAULT_EMOJI_STYLE,
  DEFAULT_EMOJI_ONLY_SIZE,
  type EmojiStyle,
  type EmojiOnlySize,
} from '@/util/emojiStyle';
import {
  STORAGE_KEY_THEME,
  STORAGE_KEY_CUSTOM_THEMES,
  STORAGE_KEY_MESSAGE_LAYOUT,
  STORAGE_KEY_MESSAGE_LAYOUT_MOBILE,
  STORAGE_KEY_PREFERENCES,
  STORAGE_KEY_KEYBINDS,
  STORAGE_KEY_LANGUAGE,
  STORAGE_KEY_DEVELOPER_MODE,
  STORAGE_KEY_MIC_MUTED,
  STORAGE_KEY_DEAFENED,
} from '@/const/storageKeys';

/** 'classic' is shown as "Bubble"; the id stays so saved settings keep working. */
export type MessageLayout = 'classic' | 'modern' | 'compact';
/** A built-in theme name, or `custom:<id>` for a theme the user made. */
export type ThemeName = string;
/** Screen share picker (Windows desktop): the height to share at; 'source' keeps the native size. */
export type ScreenShareQuality = '720' | '1080' | 'source';
export type ScreenShareFps = 15 | 30 | 60;
export type MediaVisibility = 'always' | 'private' | 'never';

/** YouTube link embeds: asked once, then on (cards that can play) or off (no embed at all). */
export type YouTubeEmbeds = 'ask' | 'on' | 'off';
export type GifProviderPreference = 'giphy' | 'klipy';
export type TimeFormatPreference = 'auto' | '12h' | '24h';
export type DateFormatPreference = 'long' | 'dmy' | 'mdy' | 'ymd';
export type ReducedMotion = 'system' | 'on' | 'off';
export type ChatDensity = 'compact' | 'default' | 'spacious';
export type { UiDensity } from '@/theme/uiDensity';

export interface Keybinds {
  toggleMute: string;
  toggleDeafen: string;
  toggleVideo: string;
  disconnect: string;
  pushToTalk: string;
}

export type RoomListStyle = 'matrix' | 'modern';

export interface Preferences {
  slidingSync: boolean;
  typingIndicators: boolean;
  notificationSounds: boolean;
  notificationSoundPack: string;
  /** Legacy mention pack; migrated into soundOverrides.mention (see soundOverridesAtom). */
  notificationMentionSoundPack: string;
  notificationSoundVolume: number;
  notificationBanners: boolean;
  sendReadReceipts: boolean;
  prettifyLinks: boolean;
  showPresence: boolean;
  showRoomAvatars: boolean;
  /** 'matrix': avatars on every room. 'modern': plain channel rows, with voice channels and a per-space order. */
  roomListStyle: RoomListStyle;
  /** Set once the first-run wizard has asked (or the person picked a style in Appearance). */
  roomListStyleChosen: boolean;
  /** Per-space choice that wins over roomListStyle in that space. Each person sets their own. */
  roomListStyleBySpace: Record<string, RoomListStyle>;
  /** Let someone who manages a space move you between its voice channels while you are in a call. */
  allowVoiceMoves: boolean;
  /** In the modern style, join every room of a space you join, and rooms added to it later. */
  autoJoinSpaceRooms: boolean;
  autoplayGifs: boolean;
  /** Show images sent together as one gallery instead of one message each. */
  groupImages: boolean;
  mediaVisibility: MediaVisibility;
  youtubeEmbeds: YouTubeEmbeds;
  /** Look up and show the homeserver software (Synapse, Tuwunel, ...) on profile cards. */
  showHomeserverSoftware: boolean;
  /** Desktop app, Carbon theme: use the operating system's accent colour. */
  useSystemAccent: boolean;
  reducedMotion: ReducedMotion;
  chatFontSize: number;
  chatDensity: ChatDensity;
  uiDensity: UiDensity;
  reducedMotionApplied: boolean | null;
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
  /** Input/output device ids; '' is the system default. */
  audioInputDevice: string;
  audioOutputDevice: string;
  videoInputDevice: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  /** Per sound: a pack id, or 'off'. A missing key follows notificationSoundPack. */
  soundOverrides: Partial<Record<SoundKind, string>>;
  /** Last choices in the screen share picker (Windows desktop app). */
  screenShareQuality: ScreenShareQuality;
  screenShareFps: ScreenShareFps;
  screenShareAudio: boolean;
  screenShareCursor: boolean;
  pushToTalk: boolean;
}

export const themeAtom = atomWithStorage<ThemeName>(STORAGE_KEY_THEME, DEFAULT_THEME);

export const customThemesAtom = atomWithStorage<CustomTheme[]>(STORAGE_KEY_CUSTOM_THEMES, []);

export const messageLayoutAtom = atomWithStorage<MessageLayout>(
  STORAGE_KEY_MESSAGE_LAYOUT,
  'modern'
);

/** Message layout used on phones; null until chosen, when phones follow the main layout. */
export const messageLayoutMobileAtom = atomWithStorage<MessageLayout | null>(
  STORAGE_KEY_MESSAGE_LAYOUT_MOBILE,
  null
);

export const keybindsAtom = atomWithStorage<Keybinds>(STORAGE_KEY_KEYBINDS, {
  toggleMute: '',
  toggleDeafen: '',
  toggleVideo: '',
  disconnect: '',
  pushToTalk: '',
});

export const DEFAULT_PREFERENCES: Preferences = {
  slidingSync: false,
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
  roomListStyle: 'matrix',
  roomListStyleChosen: false,
  roomListStyleBySpace: {},
  allowVoiceMoves: true,
  autoJoinSpaceRooms: true,
  autoplayGifs: false,
  groupImages: true,
  mediaVisibility: 'always',
  youtubeEmbeds: 'ask',
  showHomeserverSoftware: true,
  useSystemAccent: false,
  reducedMotion: 'system',
  chatFontSize: 15,
  chatDensity: 'default',
  uiDensity: 'default',
  reducedMotionApplied: null,
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
  profileEffects: true,
  emojiStyle: DEFAULT_EMOJI_STYLE,
  emojiOnlySize: DEFAULT_EMOJI_ONLY_SIZE,
  emoticonsToEmoji: true,
  messageSendAnimation: false,
  audioInputDevice: '',
  audioOutputDevice: '',
  videoInputDevice: '',
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  soundOverrides: {},
  screenShareQuality: '1080',
  screenShareFps: 30,
  screenShareAudio: true,
  screenShareCursor: true,
  pushToTalk: false,
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

export const slidingSyncAtom = preferenceFieldAtom('slidingSync');
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
export const roomListStyleAtom = preferenceFieldAtom('roomListStyle');
export const roomListStyleChosenAtom = preferenceFieldAtom('roomListStyleChosen');
export const allowVoiceMovesAtom = preferenceFieldAtom('allowVoiceMoves');
export const autoJoinSpaceRoomsAtom = preferenceFieldAtom('autoJoinSpaceRooms');
export const roomListStyleBySpaceAtom = preferenceFieldAtom('roomListStyleBySpace');
/** The style in force for the list on screen: the space's own choice if there is one. */
export const activeRoomListStyleAtom = atom<RoomListStyle>('matrix');
/** Whether room rows show avatars: never in the modern style. */
export const roomAvatarsVisibleAtom = atom((get) =>
  get(activeRoomListStyleAtom) === 'modern' ? false : get(showRoomAvatarsAtom)
);
export const autoplayGifsAtom = preferenceFieldAtom('autoplayGifs');
export const groupImagesAtom = preferenceFieldAtom('groupImages');
export const mediaVisibilityAtom = preferenceFieldAtom('mediaVisibility');
export const youtubeEmbedsAtom = preferenceFieldAtom('youtubeEmbeds');
export const showHomeserverSoftwareAtom = preferenceFieldAtom('showHomeserverSoftware');
export const useSystemAccentAtom = preferenceFieldAtom('useSystemAccent');
export const reducedMotionAtom = preferenceFieldAtom('reducedMotion');
export const chatFontSizeAtom = preferenceFieldAtom('chatFontSize');
export const chatDensityAtom = preferenceFieldAtom('chatDensity');
export const uiDensityAtom = preferenceFieldAtom('uiDensity');
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
export const profileEffectsAtom = preferenceFieldAtom('profileEffects');
export const emojiStyleAtom = preferenceFieldAtom('emojiStyle');
export const emojiOnlySizeAtom = preferenceFieldAtom('emojiOnlySize');
export const emoticonsToEmojiAtom = preferenceFieldAtom('emoticonsToEmoji');
export const messageSendAnimationAtom = preferenceFieldAtom('messageSendAnimation');
export const audioInputDeviceAtom = preferenceFieldAtom('audioInputDevice');
export const audioOutputDeviceAtom = preferenceFieldAtom('audioOutputDevice');
export const videoInputDeviceAtom = preferenceFieldAtom('videoInputDevice');
export const noiseSuppressionAtom = preferenceFieldAtom('noiseSuppression');
export const echoCancellationAtom = preferenceFieldAtom('echoCancellation');
export const autoGainControlAtom = preferenceFieldAtom('autoGainControl');
export const screenShareQualityAtom = preferenceFieldAtom('screenShareQuality');
export const screenShareFpsAtom = preferenceFieldAtom('screenShareFps');
export const screenShareAudioAtom = preferenceFieldAtom('screenShareAudio');
export const screenShareCursorAtom = preferenceFieldAtom('screenShareCursor');

/**
 * Per-sound pack overrides. Reads fold in the legacy notificationMentionSoundPack as the mention
 * override; writes clear it so removing the override sticks.
 */
export const soundOverridesAtom = atom(
  (get) => {
    const prefs = get(preferencesAtom);
    const overrides = prefs.soundOverrides ?? DEFAULT_PREFERENCES.soundOverrides;
    const legacy = prefs.notificationMentionSoundPack;
    return legacy && !overrides.mention ? { ...overrides, mention: legacy } : overrides;
  },
  (_get, set, value: Preferences['soundOverrides']) =>
    set(preferencesAtom, (prev) => ({
      ...prev,
      soundOverrides: value,
      notificationMentionSoundPack: '',
    }))
);

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
export const pushToTalkEnabledAtom = preferenceFieldAtom('pushToTalk');

const rawStringStorage = {
  getItem: (key: string, init: string) => localStorage.getItem(key) ?? init,
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

export const languageAtom = atomWithStorage<string>(STORAGE_KEY_LANGUAGE, 'en', rawStringStorage);

export const developerModeAtom = atomWithStorage<boolean>(STORAGE_KEY_DEVELOPER_MODE, false);

export const micMutedAtom = atomWithStorage<boolean>(STORAGE_KEY_MIC_MUTED, false);

export const deafenedAtom = atomWithStorage<boolean>(STORAGE_KEY_DEAFENED, false);
