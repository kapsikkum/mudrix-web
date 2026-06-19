import { useCallback, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import type { MatrixClient, User } from 'matrix-js-sdk';
import { presenceMapAtom, syncStateAtom } from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { useMatrixEvent } from './useMatrixEvent';

const VALID_STATES: ReadonlySet<string> = new Set(['online', 'offline', 'unavailable']);

function normalizePresence(raw: string | undefined): PresenceState {
  if (raw && VALID_STATES.has(raw)) return raw as PresenceState;
  return 'offline';
}

function seedFromStore(
  client: MatrixClient,
  setPresenceMap: (
    updater: (prev: Record<string, PresenceState>) => Record<string, PresenceState>
  ) => void
): void {
  const users = client.getUsers();
  if (!users.length) return;

  setPresenceMap((prev) => {
    const next: Record<string, PresenceState> = { ...prev };
    let changed = false;
    for (const user of users) {
      if (!user.presence) continue;
      const presence = normalizePresence(user.presence);
      if (next[user.userId] !== presence) {
        next[user.userId] = presence;
        changed = true;
      }
    }
    return changed ? next : prev;
  });
}

export function usePresenceListener(client: MatrixClient | null | undefined): void {
  const setPresenceMap = useSetAtom(presenceMapAtom);
  const syncState = useAtomValue(syncStateAtom);
  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';

  useEffect(() => {
    if (!client || !syncReady) return;
    seedFromStore(client, setPresenceMap);
  }, [client, syncReady, setPresenceMap]);

  const handlePresence = useCallback(
    (_event: unknown, user: User) => {
      const presence = normalizePresence(user.presence);
      setPresenceMap((prev) => {
        if (prev[user.userId] === presence) return prev;
        return { ...prev, [user.userId]: presence };
      });
    },
    [setPresenceMap]
  );

  useMatrixEvent(client, 'User.presence', handlePresence);
}
