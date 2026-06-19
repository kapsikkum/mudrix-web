import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { preferencesAtom, syncStateAtom } from '@/app/store/atoms';

const DEBOUNCE_MS = 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function usePresenceSender(client: MatrixClient | null | undefined): void {
  const prefs = useAtomValue(preferencesAtom);
  const syncState = useAtomValue(syncStateAtom);

  const showPresence = prefs.showPresence;
  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';

  const isSentOnlineRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!client) return;

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (refreshTimerRef.current !== null) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (showPresence && syncReady) {
      debounceTimerRef.current = setTimeout(() => {
        client.setPresence({ presence: 'online' }).catch(() => {});
        isSentOnlineRef.current = true;

        refreshTimerRef.current = setInterval(() => {
          client.setPresence({ presence: 'online' }).catch(() => {});
        }, REFRESH_INTERVAL_MS);
      }, DEBOUNCE_MS);
    } else if (!showPresence && isSentOnlineRef.current) {
      client.setPresence({ presence: 'offline' }).catch(() => {});
      isSentOnlineRef.current = false;
    }

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (refreshTimerRef.current !== null) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [client, showPresence, syncReady]);

  useEffect(() => {
    return () => {
      if (client && isSentOnlineRef.current) {
        client.setPresence({ presence: 'offline' }).catch(() => {});
        isSentOnlineRef.current = false;
      }
    };
  }, [client]);
}
