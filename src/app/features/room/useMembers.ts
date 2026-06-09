import { useState, useCallback, useEffect } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient, RoomMember } from 'matrix-js-sdk';
import { syncStateAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

export interface MemberEntry {
  userId: string;
  displayName: string;
  avatarMxc: string | null;
  powerLevel: number;
}

function buildMembers(client: MatrixClient, roomId: string): MemberEntry[] {
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
      })
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function useMembers(client: MatrixClient | null, roomId: string | null) {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const syncState = useAtomValue(syncStateAtom);
  const syncReady = syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP';
  const loading = !syncReady;

  const refresh = useCallback(() => {
    if (!client || !roomId) {
      setMembers([]);
      return;
    }
    setMembers(buildMembers(client, roomId));
  }, [client, roomId]);

  useEffect(() => {
    if (syncReady) refresh();
  }, [syncReady, refresh]);

  useMatrixEvent(client, 'RoomState.members', refresh);
  useMatrixEvent(client, 'RoomMember.membership', refresh);

  return { members, loading };
}
