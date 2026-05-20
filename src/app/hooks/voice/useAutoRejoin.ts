import { useEffect, useRef } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { STORAGE_KEY_VOICE_REJOIN } from '@/const/storageKeys';

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

  useEffect(() => {
    const currentClient = clientRef.current;
    if (!currentClient) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VOICE_REJOIN);
      if (!stored) return;
      const { roomId, domain, ts } = JSON.parse(stored) as {
        roomId: string;
        domain: string;
        ts: number;
      };
      if (Date.now() - ts > REJOIN_TTL_MS) {
        localStorage.removeItem(STORAGE_KEY_VOICE_REJOIN);
        return;
      }
      // Short delay so the client is fully synced before rejoining
      const timer = setTimeout(() => {
        const room = clientRef.current?.getRoom(roomId);
        if (room && domain) joinVoiceRef.current(roomId, domain);
        else localStorage.removeItem(STORAGE_KEY_VOICE_REJOIN);
      }, 1500);
      return () => clearTimeout(timer);
    } catch {
      /* malformed JSON — ignore */
    }
  }, []); // runs once on mount — client/joinVoice accessed via refs
}
