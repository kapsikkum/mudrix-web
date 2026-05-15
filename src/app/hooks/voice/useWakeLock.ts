import { useCallback, useEffect } from 'react';
import type { VoiceRefs } from './types';

// Manages a Screen Wake Lock for the duration of a voice call.
// Automatically re-acquires the lock when the tab becomes visible again.
export function useWakeLock(wakeLockRef: VoiceRefs['wakeLockRef'], activeRoomId: string | null) {
  const acquire = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      /* battery saver or not supported */
    }
  }, [wakeLockRef]);

  const release = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, [wakeLockRef]);

  // Re-acquire on tab visibility restore (lock is released automatically when hidden)
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState === 'visible' && activeRoomId && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [activeRoomId, wakeLockRef]);

  return { acquireWakeLock: acquire, releaseWakeLock: release };
}
