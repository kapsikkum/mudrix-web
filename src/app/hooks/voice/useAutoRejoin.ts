import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';

const REJOIN_TTL_MS = 60_000; // only attempt rejoin within 60s of last session

export function useAutoRejoin(
  client: MatrixClient | null,
  joinVoice: (roomId: string, domain: string) => Promise<void>
) {
  useEffect(() => {
    if (!client) return;
    try {
      const stored = localStorage.getItem('voice-rejoin');
      if (!stored) return;
      const { roomId, domain, ts } = JSON.parse(stored) as {
        roomId: string;
        domain: string;
        ts: number;
      };
      if (Date.now() - ts > REJOIN_TTL_MS) {
        localStorage.removeItem('voice-rejoin');
        return;
      }
      // Short delay so the client is fully synced before rejoining
      const timer = setTimeout(() => {
        const room = client.getRoom(roomId);
        if (room && domain) joinVoice(roomId, domain);
        else localStorage.removeItem('voice-rejoin');
      }, 1500);
      return () => clearTimeout(timer);
    } catch {
      /* malformed JSON — ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only
}
