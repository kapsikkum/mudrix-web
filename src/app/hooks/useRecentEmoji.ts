import { useState, useCallback, useEffect, useRef } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useMatrixEvent } from './useMatrixEvent';

export interface RecentEmojiEntry {
  emoji: string;
  label: string;
  url?: string;
}

const MAX_RECENT = 30;
const RECENT_EMOJI_ACCOUNT_DATA = 'm.recent_emoji';

type WritableAccountDataEventKey = Parameters<MatrixClient['setAccountData']>[0];

function parseRecentEmoji(content: unknown): RecentEmojiEntry[] {
  if (!content || typeof content !== 'object') return [];
  const list = (content as Record<string, unknown>).recent_emoji;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (e): e is RecentEmojiEntry =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as RecentEmojiEntry).emoji === 'string' &&
      typeof (e as RecentEmojiEntry).label === 'string'
  );
}

export function useRecentEmoji(client: MatrixClient | null | undefined): {
  recent: RecentEmojiEntry[];
  saveRecent: (emoji: string, label: string, url?: string) => void;
} {
  const [recent, setRecent] = useState<RecentEmojiEntry[]>([]);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<RecentEmojiEntry[]>([]);

  useEffect(() => {
    if (!client) {
      setRecent([]);
      return;
    }
    const event = client.getAccountData(RECENT_EMOJI_ACCOUNT_DATA);
    const entries = parseRecentEmoji(event?.getContent());
    latestRef.current = entries;
    setRecent(entries);
  }, [client]);

  useMatrixEvent(client, 'accountData', (event: MatrixEvent) => {
    if (event.getType() !== RECENT_EMOJI_ACCOUNT_DATA) return;
    const entries = parseRecentEmoji(event.getContent());
    latestRef.current = entries;
    setRecent(entries);
  });

  const saveRecent = useCallback(
    (emoji: string, label: string, url?: string) => {
      if (!client) return;
      setRecent((prev) => {
        const next = prev.filter((r) => r.emoji !== emoji);
        next.unshift({ emoji, label, url });
        if (next.length > MAX_RECENT) next.length = MAX_RECENT;
        latestRef.current = next;

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          client
            .setAccountData(RECENT_EMOJI_ACCOUNT_DATA as WritableAccountDataEventKey, {
              recent_emoji: latestRef.current,
            })
            .catch(() => {});
        }, 500);

        return next;
      });
    },
    [client]
  );

  return { recent, saveRecent };
}
