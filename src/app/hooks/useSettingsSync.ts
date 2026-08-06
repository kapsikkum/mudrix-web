import { useCallback, useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { themeAtom, messageLayoutAtom, languageAtom } from '@/app/store/atoms';
import { useSyncReady } from '@/app/hooks/useSync';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import {
  SETTINGS_ACCOUNT_DATA_TYPE,
  type SyncedSettings,
  parseSettings,
  readSettingsFromClient,
  settingsEqual,
} from '@/client/settingsSync';

const PUSH_DEBOUNCE_MS = 500;

type WritableAccountDataEventKey = Parameters<MatrixClient['setAccountData']>[0];

export function useSettingsSync(client: MatrixClient | null): void {
  const [theme, setTheme] = useAtom(themeAtom);
  const [messageLayout, setMessageLayout] = useAtom(messageLayoutAtom);
  const [language, setLanguage] = useAtom(languageAtom);
  const syncReady = useSyncReady();
  const [remoteKnown, setRemoteKnown] = useState(false);

  const applyRemote = useCallback(
    (settings: Partial<SyncedSettings>) => {
      if (settings.theme) setTheme(settings.theme);
      if (settings.messageLayout) setMessageLayout(settings.messageLayout);
      if (settings.language) setLanguage(settings.language);
    },
    [setTheme, setMessageLayout, setLanguage]
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
      const next = { theme, messageLayout, language };
      const current = readSettingsFromClient(client);
      if (settingsEqual(next, current)) return;
      client
        .setAccountData(SETTINGS_ACCOUNT_DATA_TYPE as WritableAccountDataEventKey, next)
        .catch(() => {
          // Non-fatal — the local value stays applied and the next change retries
        });
    }, PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [client, syncReady, remoteKnown, theme, messageLayout, language]);
}
