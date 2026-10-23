import { useCallback, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  themeAtom,
  customThemesAtom,
  messageLayoutAtom,
  messageLayoutMobileAtom,
  languageAtom,
  preferencesAtom,
  keybindsAtom,
} from '@/app/store/atoms';
import { useSyncReady } from '@/app/hooks/useSync';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import i18n from '@/i18n';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import {
  SETTINGS_ACCOUNT_DATA_TYPE,
  type SyncedSettings,
  parseSettings,
  readSettingsFromClient,
  settingsEqual,
  syncablePreferences,
} from '@/client/settingsSync';

const PUSH_DEBOUNCE_MS = 500;

type WritableAccountDataEventKey = Parameters<MatrixClient['setAccountData']>[0];

/**
 * Mirrors theme, layout, language, every preference and keybinds to private account data (see
 * settingsSync.ts for what is deliberately left out and who can read it).
 */
export function useSettingsSync(client: MatrixClient | null): void {
  const [theme, setTheme] = useAtom(themeAtom);
  const [customThemes, setCustomThemes] = useAtom(customThemesAtom);
  const [messageLayout, setMessageLayout] = useAtom(messageLayoutAtom);
  const [messageLayoutMobile, setMessageLayoutMobile] = useAtom(messageLayoutMobileAtom);
  const [language, setLanguage] = useAtom(languageAtom);
  const [preferences, setPreferences] = useAtom(preferencesAtom);
  const [keybinds, setKeybinds] = useAtom(keybindsAtom);
  const syncReady = useSyncReady();
  const [remoteKnown, setRemoteKnown] = useState(false);

  const applyRemote = useCallback(
    (settings: Partial<SyncedSettings>) => {
      if (settings.customThemes) setCustomThemes(settings.customThemes);
      if (settings.theme) setTheme(settings.theme);
      if (settings.messageLayout) setMessageLayout(settings.messageLayout);
      if (settings.messageLayoutMobile) setMessageLayoutMobile(settings.messageLayoutMobile);
      if (settings.language && SUPPORTED_LANGUAGES.some((l) => l.code === settings.language)) {
        setLanguage(settings.language);
        if (i18n.language !== settings.language) i18n.changeLanguage(settings.language);
      }
      const remotePrefs = settings.preferences;
      if (remotePrefs) setPreferences((prev) => ({ ...prev, ...remotePrefs }));
      if (settings.keybinds) setKeybinds(settings.keybinds);
    },
    [
      setTheme,
      setCustomThemes,
      setMessageLayout,
      setMessageLayoutMobile,
      setLanguage,
      setPreferences,
      setKeybinds,
    ]
  );

  // Pull: server → local, live via account data events
  useMatrixEvent(client, 'accountData', (event: MatrixEvent) => {
    if (event.getType() !== SETTINGS_ACCOUNT_DATA_TYPE) return;
    const settings = parseSettings(event.getContent());
    if (Object.keys(settings).length > 0) {
      applyRemote(settings);
    }
    setRemoteKnown(true);
  });

  // Account data is always processed before the sync state reaches PREPARED,
  useEffect(() => {
    if (!client || !syncReady || remoteKnown) return;
    const settings = readSettingsFromClient(client);
    if (Object.keys(settings).length > 0) {
      applyRemote(settings);
    }
    setRemoteKnown(true);
  }, [client, syncReady, remoteKnown, applyRemote]);

  useEffect(() => {
    if (!client || !syncReady || !remoteKnown) return;
    const timer = setTimeout(() => {
      const next: Partial<SyncedSettings> = {
        theme,
        customThemes,
        messageLayout,
        ...(messageLayoutMobile ? { messageLayoutMobile } : {}),
        language,
        preferences: syncablePreferences(preferences),
        keybinds,
      };
      const current = readSettingsFromClient(client);
      if (settingsEqual(next, current)) return;
      client
        .setAccountData(SETTINGS_ACCOUNT_DATA_TYPE as WritableAccountDataEventKey, next)
        .catch(() => {
          // Non-fatal — the local value stays applied and the next change retries
        });
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    client,
    syncReady,
    remoteKnown,
    theme,
    customThemes,
    messageLayout,
    messageLayoutMobile,
    language,
    preferences,
    keybinds,
  ]);
}
