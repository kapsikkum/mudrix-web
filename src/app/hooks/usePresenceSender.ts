import { useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { SetPresence } from 'matrix-js-sdk/lib/sync';
import { preferencesAtom, syncStateAtom, ownIdleAtom } from '@/app/store/atoms';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5min
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'scroll', 'focus'] as const;

type PresenceValue = 'online' | 'unavailable' | 'offline';

export function usePresenceSender(client: MatrixClient | null | undefined): void {
  const prefs = useAtomValue(preferencesAtom);
  const syncState = useAtomValue(syncStateAtom);
  const setOwnIdle = useSetAtom(ownIdleAtom);

  const showPresence = prefs.showPresence;
  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';

  const showPresenceRef = useRef(showPresence);
  const setOwnIdleRef = useRef(setOwnIdle);
  useEffect(() => {
    showPresenceRef.current = showPresence;
  });
  useEffect(() => {
    setOwnIdleRef.current = setOwnIdle;
  });

  const isIdleRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sends presence via both mechanisms:
  // - setSyncPresence: piggybacks on the sync loop so the server sees it continuously
  // - setPresence PUT: immediate broadcast to other users right now
  const sendPresence = (c: MatrixClient, state: PresenceValue) => {
    const sdkState =
      state === 'online'
        ? SetPresence.Online
        : state === 'unavailable'
          ? SetPresence.Unavailable
          : SetPresence.Offline;
    c.setSyncPresence(sdkState).catch(() => {});
    c.setPresence({ presence: state }).catch(() => {});
  };

  useEffect(() => {
    if (!client) return;

    const clearIdleTimer = () => {
      if (idleTimerRef.current !== null) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const scheduleIdle = () => {
      clearIdleTimer();
      idleTimerRef.current = setTimeout(() => {
        if (!isIdleRef.current && showPresenceRef.current) {
          isIdleRef.current = true;
          setOwnIdleRef.current(true);
          sendPresence(client, 'unavailable');
        }
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => {
      if (!showPresenceRef.current) return;
      clearIdleTimer();
      if (isIdleRef.current) {
        isIdleRef.current = false;
        setOwnIdleRef.current(false);
        sendPresence(client, 'online');
      }
      scheduleIdle();
    };

    scheduleIdle();

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }

    return () => {
      clearIdleTimer();
      isIdleRef.current = false;
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [client]);

  useEffect(() => {
    if (!client || !syncReady) return;

    if (!showPresence) {
      clearTimeout(idleTimerRef.current ?? undefined);
      idleTimerRef.current = null;
      isIdleRef.current = false;
      setOwnIdle(false);
      sendPresence(client, 'offline');
    } else if (!isIdleRef.current) {
      sendPresence(client, 'online');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, showPresence, syncReady]);
}
