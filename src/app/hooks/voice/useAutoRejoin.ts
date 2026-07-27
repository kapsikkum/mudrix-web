import { useEffect, useRef } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import { voiceRejoinAtom } from '@/app/store/atoms/voice';

const REJOIN_TTL_MS = 60_000; // only attempt rejoin within 60s of last session

export function useAutoRejoin(
  client: MatrixClient | null,
  joinVoice: (roomId: string, domain: string) => Promise<void>
) {
  // Refs so the mount-only effect always sees the latest values without re-running.
  const clientRef = useRef(client);
  clientRef.current = client;
  const joinVoiceRef = useRef(joinVoice);
  joinVoiceRef.current = joinVoice;
  const voiceRejoin = useAtomValue(voiceRejoinAtom);

  useEffect(() => {
    const currentClient = clientRef.current;
    if (!currentClient) return;
    if (!voiceRejoin) return;
    const { roomId, domain, ts } = voiceRejoin;
    if (Date.now() - ts > REJOIN_TTL_MS) return;
    // Short delay so the client is fully synced before rejoining
    const timer = setTimeout(() => {
      const room = currentClient.getRoom(roomId);
      if (room && domain) joinVoiceRef.current(roomId, domain);
    }, 1500);
    return () => clearTimeout(timer);
  }, [voiceRejoin]);
}
