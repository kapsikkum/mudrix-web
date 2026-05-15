import { useCallback } from 'react';
import type { SetStateAction } from 'react';
import type { VoiceState } from '@/app/store/atoms';
import type { VoiceRefs } from './types';

export function useNetworkQuality(
  pingIntervalRef: VoiceRefs['pingIntervalRef'],
  setVoiceState: (updater: SetStateAction<VoiceState>) => void
) {
  const startPing = useCallback(() => {
    const run = async () => {
      const start = performance.now();
      try {
        await fetch('/', { method: 'HEAD', cache: 'no-store' });
        const ms = Math.round(performance.now() - start);
        // Map latency to a simple quality score: <80ms=95, <200ms=55, else=20
        const quality = ms < 80 ? 95 : ms < 200 ? 55 : 20;
        setVoiceState((prev) => ({ ...prev, pingMs: ms, connectionQuality: quality }));
      } catch {
        setVoiceState((prev) => ({ ...prev, pingMs: null, connectionQuality: 20 }));
      }
    };
    run();
    pingIntervalRef.current = setInterval(run, 10_000);
  }, [pingIntervalRef, setVoiceState]);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, [pingIntervalRef]);

  return { startPing, stopPing };
}
