import type { IndexedDBStore, MatrixClient } from 'matrix-js-sdk';
import type { Keybinds, MessageLayout, Preferences, ThemeName } from '@/app/store/atoms';
import { DEFAULT_PREFERENCES } from '@/app/store/atoms/settings';
import { EMOJI_ONLY_SIZES, EMOJI_STYLES } from '@/util/emojiStyle';
import { THEMES } from '@/theme/themes.css';
import { CUSTOM_THEME_PREFIX, sanitizeCustomThemes, type CustomTheme } from '@/theme/customThemes';
import {
  STORAGE_KEY_KEYBINDS,
  STORAGE_KEY_LANGUAGE,
  STORAGE_KEY_MESSAGE_LAYOUT,
  STORAGE_KEY_PREFERENCES,
  STORAGE_KEY_THEME,
  STORAGE_KEY_CUSTOM_THEMES,
} from '@/const/storageKeys';

/**
 * Privacy model: this is Matrix *account data*. Other users can never read it (it is not part of
 * any room or profile), but it is not end-to-end encrypted, so the homeserver admin can. Only
 * non-secret appearance/behaviour choices belong here. Never add tokens, keys, GIF favourites
 * (an encrypted GIF favourite carries its decryption key) or anything that identifies private
 * rooms. Anything other users should see goes in the extended profile instead, deliberately.
 */
export const SETTINGS_ACCOUNT_DATA_TYPE = 'io.gitlab.wizardchat.settings';

/** Preferences that describe this device (screen size, ...) and so are not synced. */
const DEVICE_ONLY_PREFERENCES: ReadonlySet<keyof Preferences> = new Set(['uiZoom']);

export interface SyncedSettings {
  theme: ThemeName;
  customThemes: CustomTheme[];
  messageLayout: MessageLayout;
  language: string;
  preferences: Partial<Preferences>;
  keybinds: Keybinds;
}

const MESSAGE_LAYOUTS: MessageLayout[] = ['classic', 'modern', 'compact'];
const ENUM_VALUES: Partial<Record<keyof Preferences, readonly string[]>> = {
  mediaVisibility: ['always', 'private', 'never'],
  youtubeEmbeds: ['ask', 'on', 'off'],
  gifProvider: ['giphy', 'klipy'],
  timeFormat: ['auto', '12h', '24h'],
  dateFormat: ['long', 'dmy', 'mdy', 'ymd'],
  emojiStyle: EMOJI_STYLES,
  emojiOnlySize: EMOJI_ONLY_SIZES,
  systemDarkTheme: Object.keys(THEMES),
  systemLightTheme: Object.keys(THEMES),
};

type AccountDataEventKey = Parameters<MatrixClient['getAccountData']>[0];

export function isSyncedPreference(key: string): key is keyof Preferences {
  return key in DEFAULT_PREFERENCES && !DEVICE_ONLY_PREFERENCES.has(key as keyof Preferences);
}

/** Keeps only known, synced preference keys whose value has the right type and an allowed value. */
export function sanitizePreferences(raw: unknown): Partial<Preferences> {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_PREFERENCES)) {
    if (!isSyncedPreference(key) || !(key in input)) continue;
    const value = input[key];
    const expected = DEFAULT_PREFERENCES[key];
    if (typeof value !== typeof expected) continue;
    if (typeof value === 'number' && !Number.isFinite(value)) continue;
    const allowed = ENUM_VALUES[key];
    const isCustomThemePick =
      (key === 'systemDarkTheme' || key === 'systemLightTheme') &&
      typeof value === 'string' &&
      /^custom:[a-z0-9]{6,32}$/.test(value);
    if (allowed && !isCustomThemePick && !allowed.includes(value as string)) continue;
    out[key] = value;
  }
  return out as Partial<Preferences>;
}

function sanitizeKeybinds(raw: unknown): Keybinds | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const out: Keybinds = { toggleMute: '', toggleDeafen: '', toggleVideo: '', disconnect: '' };
  let found = false;
  for (const key of Object.keys(out) as (keyof Keybinds)[]) {
    const value = input[key];
    if (typeof value === 'string' && value.length <= 64) {
      out[key] = value;
      found = true;
    }
  }
  return found ? out : undefined;
}

/** The synced subset of the current local preferences, filled with defaults for missing keys. */
export function syncablePreferences(prefs: Partial<Preferences>): Partial<Preferences> {
  return sanitizePreferences({ ...DEFAULT_PREFERENCES, ...prefs });
}

export function parseSettings(raw: unknown): Partial<SyncedSettings> {
  if (!raw || typeof raw !== 'object') return {};
  const content = raw as Record<string, unknown>;
  const settings: Partial<SyncedSettings> = {};

  if (
    typeof content.theme === 'string' &&
    (content.theme in THEMES ||
      new RegExp(`^${CUSTOM_THEME_PREFIX}[a-z0-9]{6,32}$`).test(content.theme))
  ) {
    settings.theme = content.theme as ThemeName;
  }

  if (Array.isArray(content.customThemes)) {
    settings.customThemes = sanitizeCustomThemes(content.customThemes);
  }

  if (
    typeof content.messageLayout === 'string' &&
    (MESSAGE_LAYOUTS as string[]).includes(content.messageLayout)
  ) {
    settings.messageLayout = content.messageLayout as MessageLayout;
  }

  if (typeof content.language === 'string' && content.language.trim() !== '') {
    settings.language = content.language;
  }

  const preferences = sanitizePreferences(content.preferences);
  if (Object.keys(preferences).length > 0) settings.preferences = preferences;

  const keybinds = sanitizeKeybinds(content.keybinds);
  if (keybinds) settings.keybinds = keybinds;

  return settings;
}

export function readSettingsFromClient(client: MatrixClient): Partial<SyncedSettings> {
  const event = client.getAccountData(SETTINGS_ACCOUNT_DATA_TYPE as AccountDataEventKey);
  if (!event) return {};
  return parseSettings(event.getContent());
}

function readStoredJson(key: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function writeSettingsToLocalStorage(settings: Partial<SyncedSettings>): void {
  if (settings.theme) localStorage.setItem(STORAGE_KEY_THEME, settings.theme);
  if (settings.customThemes) {
    localStorage.setItem(STORAGE_KEY_CUSTOM_THEMES, JSON.stringify(settings.customThemes));
  }
  if (settings.messageLayout)
    localStorage.setItem(STORAGE_KEY_MESSAGE_LAYOUT, settings.messageLayout);
  if (settings.language) localStorage.setItem(STORAGE_KEY_LANGUAGE, settings.language);
  if (settings.preferences) {
    localStorage.setItem(
      STORAGE_KEY_PREFERENCES,
      JSON.stringify({ ...readStoredJson(STORAGE_KEY_PREFERENCES), ...settings.preferences })
    );
  }
  if (settings.keybinds) {
    localStorage.setItem(STORAGE_KEY_KEYBINDS, JSON.stringify(settings.keybinds));
  }
}

function stable(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value ?? null);
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(',')}}`;
}

export function settingsEqual(a: Partial<SyncedSettings>, b: Partial<SyncedSettings>): boolean {
  return stable(a) === stable(b);
}

export async function applySavedSettingsToLocalStorage(store: IndexedDBStore): Promise<void> {
  try {
    const saved = await store.getSavedSync();
    const raw = saved?.accountData?.find((e) => e.type === SETTINGS_ACCOUNT_DATA_TYPE);
    if (!raw) return;
    const settings = parseSettings(raw.content);
    // The saved sync is only refreshed by classic sync, so under sliding sync it goes stale. The
    // sync mode decides how the client starts, so a value already set on this device wins over it;
    // the live account data still applies once connected.
    if (settings.preferences && readStoredJson(STORAGE_KEY_PREFERENCES).slidingSync !== undefined) {
      delete settings.preferences.slidingSync;
    }
    writeSettingsToLocalStorage(settings);
  } catch {
    // best effort — the live sync applies settings once connected
  }
}
