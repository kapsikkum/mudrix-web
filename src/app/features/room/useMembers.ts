import { useState, useCallback, useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { MatrixEvent, Method } from 'matrix-js-sdk';
import type { MatrixClient, RoomMember } from 'matrix-js-sdk';
import { presenceMapAtom } from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useSyncReady } from '@/app/hooks/useSync';

export interface MemberEntry {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  powerLevel: number;
  isPending?: boolean;
  presence?: PresenceState;
}

function buildMembers(
  client: MatrixClient,
  roomId: string,
  presenceMap: Record<string, PresenceState>
): MemberEntry[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  const members: RoomMember[] = room.getJoinedMembers();

  return members
    .map(
      (m): MemberEntry => ({
        userId: m.userId,
        displayName: m.name ?? m.userId,
        avatarMxc: m.getMxcAvatarUrl() ?? null,
        powerLevel: m.powerLevel,
        presence: presenceMap[m.userId],
      })
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildBannedMembers(
  client: MatrixClient,
  roomId: string,
  presenceMap: Record<string, PresenceState>
): MemberEntry[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  const members: RoomMember[] = room.getMembersWithMembership('ban');

  return members
    .map(
      (m): MemberEntry => ({
        userId: m.userId,
        displayName: m.name ?? m.userId,
        avatarMxc: m.getMxcAvatarUrl() ?? null,
        powerLevel: m.powerLevel,
        presence: presenceMap[m.userId],
      })
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function buildKnockRequests(
  client: MatrixClient,
  roomId: string,
  presenceMap: Record<string, PresenceState>
): MemberEntry[] {
  const room = client.getRoom(roomId);
  if (!room) return [];

  const members: RoomMember[] = room.getMembersWithMembership('knock');

  return members.map(
    (m): MemberEntry => ({
      userId: m.userId,
      displayName: m.name ?? m.userId,
      avatarMxc: m.getMxcAvatarUrl() ?? null,
      powerLevel: m.powerLevel,
      isPending: true,
      presence: presenceMap[m.userId],
    })
  );
}

export function useMembers(client: MatrixClient | null, roomId: string | null) {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [hydrating, setHydrating] = useState(false);
  const presenceMap = useAtomValue(presenceMapAtom);
  const presenceMapRef = useRef(presenceMap);
  presenceMapRef.current = presenceMap;

  const syncReady = useSyncReady();
  const loading = !syncReady || hydrating;

  const refresh = useCallback(() => {
    if (!client || !roomId) {
      setMembers([]);
      return;
    }
    setMembers(buildMembers(client, roomId, presenceMapRef.current));
  }, [client, roomId]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current !== null) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      refresh();
    }, 100);
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (syncReady) refresh();
  }, [syncReady, refresh]);

  useEffect(() => {
    setMembers((prev) =>
      prev.length === 0 ? prev : prev.map((m) => ({ ...m, presence: presenceMap[m.userId] }))
    );
  }, [presenceMap]);

  useEffect(() => {
    if (!client || !roomId || !syncReady) return;
    const room = client.getRoom(roomId);
    if (!room || room.membersLoaded()) return;
    let cancelled = false;
    room
      .loadMembersIfNeeded()
      .then(() => {
        if (!cancelled) refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, roomId, syncReady, refresh]);

  useEffect(() => {
    if (!client || !roomId || !syncReady) {
      setHydrating(false);
      return;
    }
    const room = client.getRoom(roomId);
    if (!room || room.getMyMembership() !== 'join') {
      setHydrating(false);
      return;
    }
    if (room.getJoinedMembers().length >= 50) {
      setHydrating(false);
      return;
    }
    let cancelled = false;
    setHydrating(true);
    client.http
      .authedRequest<{
        chunk: Array<{
          event_id: string;
          origin_server_ts: number;
          sender: string;
          state_key: string;
          type: string;
          content: {
            displayname?: string;
            avatar_url?: string;
            membership?: string;
          };
        }>;
      }>(Method.Get, `/rooms/${encodeURIComponent(roomId)}/members`, { membership: 'join' })
      .then((res) => {
        if (cancelled) return;
        const roomNow = client.getRoom(roomId);
        if (!roomNow) return;
        const events = res.chunk.map((raw) => new MatrixEvent({ ...raw, room_id: roomId }));
        roomNow.currentState.setStateEvents(events);
        refresh();
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, roomId, syncReady, refresh]);

  useMatrixEvent(client, 'RoomState.members', debouncedRefresh);
  useMatrixEvent(client, 'RoomMember.membership', debouncedRefresh);
  useMatrixEvent(client, 'RoomMember.powerLevel', debouncedRefresh);

  return { members, loading };
}

export function useKnockRequests(client: MatrixClient | null, roomId: string | null) {
  const [knockRequests, setKnockRequests] = useState<MemberEntry[]>([]);
  const presenceMap = useAtomValue(presenceMapAtom);
  const presenceMapRef = useRef(presenceMap);
  presenceMapRef.current = presenceMap;

  const syncReady = useSyncReady();
  const loading = !syncReady;

  const refresh = useCallback(() => {
    if (!client || !roomId) {
      setKnockRequests([]);
      return;
    }
    setKnockRequests(buildKnockRequests(client, roomId, presenceMapRef.current));
  }, [client, roomId]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current !== null) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      refresh();
    }, 100);
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (syncReady) refresh();
  }, [syncReady, refresh]);

  useEffect(() => {
    if (!client || !roomId || !syncReady) return;
    const room = client.getRoom(roomId);
    if (!room || room.membersLoaded()) return;
    let cancelled = false;
    room
      .loadMembersIfNeeded()
      .then(() => {
        if (!cancelled) refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, roomId, syncReady, refresh]);

  useMatrixEvent(client, 'RoomState.members', debouncedRefresh);
  useMatrixEvent(client, 'RoomMember.membership', debouncedRefresh);

  return { knockRequests, loading };
}

export function useBannedMembers(client: MatrixClient | null, roomId: string | null) {
  const [bannedMembers, setBannedMembers] = useState<MemberEntry[]>([]);
  const presenceMap = useAtomValue(presenceMapAtom);
  const presenceMapRef = useRef(presenceMap);
  presenceMapRef.current = presenceMap;

  const syncReady = useSyncReady();
  const loading = !syncReady;

  const refresh = useCallback(() => {
    if (!client || !roomId) {
      setBannedMembers([]);
      return;
    }
    setBannedMembers(buildBannedMembers(client, roomId, presenceMapRef.current));
  }, [client, roomId]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current !== null) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      refresh();
    }, 100);
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [roomId]);

  useEffect(() => {
    if (syncReady) refresh();
  }, [syncReady, refresh]);

  useEffect(() => {
    if (!client || !roomId || !syncReady) return;
    const room = client.getRoom(roomId);
    if (!room || room.membersLoaded()) return;
    let cancelled = false;
    room
      .loadMembersIfNeeded()
      .then(() => {
        if (!cancelled) refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [client, roomId, syncReady, refresh]);

  useMatrixEvent(client, 'RoomState.members', debouncedRefresh);
  useMatrixEvent(client, 'RoomMember.membership', debouncedRefresh);

  return { bannedMembers, loading };
}
