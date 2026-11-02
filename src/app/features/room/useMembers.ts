import { useState, useCallback, useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { MatrixEvent, Method } from 'matrix-js-sdk';
import type { MatrixClient, RoomMember } from 'matrix-js-sdk';
import { presenceMapAtom } from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useSyncReady } from '@/app/hooks/useSync';
import { roomState } from '@/util/matrix';

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

type MemberBuilder = (
  client: MatrixClient,
  roomId: string,
  presenceMap: Record<string, PresenceState>
) => MemberEntry[];

function useRoomMemberList(
  client: MatrixClient | null,
  roomId: string | null,
  builder: MemberBuilder
) {
  const [list, setList] = useState<MemberEntry[]>([]);
  const presenceMap = useAtomValue(presenceMapAtom);
  const presenceMapRef = useRef(presenceMap);
  presenceMapRef.current = presenceMap;

  const syncReady = useSyncReady();

  const refresh = useCallback(() => {
    if (!client || !roomId) {
      setList([]);
      return;
    }
    setList(builder(client, roomId, presenceMapRef.current));
  }, [client, roomId, builder]);

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
    setList((prev) =>
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

  useMatrixEvent(client, 'RoomState.members', debouncedRefresh);
  useMatrixEvent(client, 'RoomMember.membership', debouncedRefresh);

  return { list, setList, syncReady, refresh, debouncedRefresh };
}

export function useMembers(client: MatrixClient | null, roomId: string | null) {
  const {
    list: members,
    syncReady,
    refresh,
    debouncedRefresh,
  } = useRoomMemberList(client, roomId, buildMembers);
  useMatrixEvent(client, 'RoomMember.powerLevel', debouncedRefresh);
  const [hydrating, setHydrating] = useState(false);
  const loading = !syncReady || hydrating;

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
        roomState(roomNow).setStateEvents(events);
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

  return { members, loading };
}

export function useKnockRequests(client: MatrixClient | null, roomId: string | null) {
  const { list: knockRequests, syncReady } = useRoomMemberList(client, roomId, buildKnockRequests);
  return { knockRequests, loading: !syncReady };
}

export function useBannedMembers(client: MatrixClient | null, roomId: string | null) {
  const { list: bannedMembers, syncReady } = useRoomMemberList(client, roomId, buildBannedMembers);
  return { bannedMembers, loading: !syncReady };
}
