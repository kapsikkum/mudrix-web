import { useCallback, useEffect } from 'react';
import { useSetAtom } from 'jotai';
import type { MatrixClient, User } from 'matrix-js-sdk';
import { presenceMapAtom } from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { useMatrixEvent } from './useMatrixEvent';
import { useSyncReady } from './useSync';

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

  const ownId = client.getUserId();
  setPresenceMap((prev) => {
    const next: Record<string, PresenceState> = { ...prev };
    let changed = false;
    for (const user of users) {
      if (user.userId === ownId) continue;
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
  const syncReady = useSyncReady();

  useEffect(() => {
    if (!client || !syncReady) return;
    seedFromStore(client, setPresenceMap);
  }, [client, syncReady, setPresenceMap]);

  const handlePresence = useCallback(
    (_event: unknown, user: User) => {
      if (user.userId === client?.getUserId()) return;
      const presence = normalizePresence(user.presence);
      setPresenceMap((prev) => {
        if (prev[user.userId] === presence) return prev;
        return { ...prev, [user.userId]: presence };
      });
    },
    [client, setPresenceMap]
  );

  useMatrixEvent(client, 'User.presence', handlePresence);
}
