import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { preferencesAtom, syncStateAtom, ownIdleAtom } from '@/app/store/atoms';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'focus'] as const;

export function useActivityPresence(client: MatrixClient | null | undefined): void {
  const prefs = useAtomValue(preferencesAtom);
  const syncState = useAtomValue(syncStateAtom);
  const setOwnIdle = useSetAtom(ownIdleAtom);

  const showPresence = prefs.showPresence;
  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';

  const isUnavailableRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showPresence || !syncReady) {
      setOwnIdle(false);
    }
  }, [showPresence, syncReady, setOwnIdle]);

  useEffect(() => {
    if (!client || !showPresence || !syncReady) return;

    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const goUnavailable = () => {
      if (!isUnavailableRef.current) {
        isUnavailableRef.current = true;
        setOwnIdle(true);
        client.setPresence({ presence: 'unavailable' }).catch(() => {});
      }
    };

    const onActivity = () => {
      clearIdleTimer();

      if (isUnavailableRef.current) {
        isUnavailableRef.current = false;
        setOwnIdle(false);
        client.setPresence({ presence: 'online' }).catch(() => {});
      }

      idleTimerRef.current = setTimeout(goUnavailable, IDLE_TIMEOUT_MS);
    };

    idleTimerRef.current = setTimeout(goUnavailable, IDLE_TIMEOUT_MS);

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    return () => {
      clearIdleTimer();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [client, showPresence, syncReady, setOwnIdle]);
}
