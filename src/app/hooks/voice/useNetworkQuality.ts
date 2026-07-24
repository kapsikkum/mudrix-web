import { useState, useEffect, useCallback } from 'react';
import type { SetStateAction } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { VoiceState } from '@/app/store/atoms';

interface PingResult {
  pingMs: number | null;
  connectionQuality: number;
}

export function useNetworkQuality(setVoiceState: (updater: SetStateAction<VoiceState>) => void) {
  const [enabled, setEnabled] = useState(false);

  const query = useQuery<PingResult>({
    queryKey: ['network-quality'],
    queryFn: async () => {
      const start = performance.now();
      try {
        await fetch('/', { method: 'HEAD', cache: 'no-store' });
        const ms = Math.round(performance.now() - start);
        const quality = ms < 80 ? 95 : ms < 200 ? 55 : 20;
        return { pingMs: ms, connectionQuality: quality };
      } catch {
        return { pingMs: null, connectionQuality: 20 };
      }
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    enabled,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    if (query.data) {
      setVoiceState((prev) => ({ ...prev, ...query.data }));
    }
  }, [query.data, setVoiceState]);

  const startPing = useCallback(() => setEnabled(true), []);
  const stopPing = useCallback(() => setEnabled(false), []);

  return { startPing, stopPing };
}
