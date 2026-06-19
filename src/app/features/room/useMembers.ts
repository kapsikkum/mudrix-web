import { useState, useCallback, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient, RoomMember } from 'matrix-js-sdk';
import { syncStateAtom, presenceMapAtom } from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

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
  const syncState = useAtomValue(syncStateAtom);
  const presenceMap = useAtomValue(presenceMapAtom);
  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';
  const loading = !syncReady;

  const refresh = useCallback(() => {
    if (!client || !roomId) {
      setMembers([]);
      return;
    }
    setMembers(buildMembers(client, roomId, presenceMap));
  }, [client, roomId, presenceMap]);

  useEffect(() => {
    if (syncReady) refresh();
  }, [syncReady, refresh]);

  useMatrixEvent(client, 'RoomState.members', refresh);
  useMatrixEvent(client, 'RoomMember.membership', refresh);

  return { members, loading };
}

export function useKnockRequests(client: MatrixClient | null, roomId: string | null) {
  const [knockRequests, setKnockRequests] = useState<MemberEntry[]>([]);
  const syncState = useAtomValue(syncStateAtom);
  const presenceMap = useAtomValue(presenceMapAtom);
  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';
  const loading = !syncReady;

  const refresh = useCallback(() => {
    if (!client || !roomId) {
      setKnockRequests([]);
      return;
    }
    setKnockRequests(buildKnockRequests(client, roomId, presenceMap));
  }, [client, roomId, presenceMap]);

  useEffect(() => {
    if (syncReady) refresh();
  }, [syncReady, refresh]);

  useMatrixEvent(client, 'RoomState.members', refresh);
  useMatrixEvent(client, 'RoomMember.membership', refresh);

  return { knockRequests, loading };
}
