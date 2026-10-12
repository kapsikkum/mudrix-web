import { useCallback, useMemo, useState } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import { isDmRoom, isSpace, roomState } from '@/util/matrix';
import { buildRoomEntry } from '@/app/features/room/useRooms';

export type InviteKind = 'room' | 'dm' | 'space';

export interface Invite {
  roomId: string;
  name: string;
  avatarMxc: string | null;
  kind: InviteKind;
  inviterUserId: string | null;
  inviterDisplayName: string | null;
  ts: number | null;
}

export function useInvites(): Invite[] {
  const client = getMatrixClientOrNull();

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 200);

  const invites = useMemo((): Invite[] => {
    if (!client) return [];
    const myId = client.getUserId() ?? '';

    return client
      .getRooms()
      .filter((room) => room.getMyMembership() === 'invite')
      .map((room) => {
        const entry = buildRoomEntry(room, client);

        const memberState = roomState(room).getStateEvents('m.room.member', myId);
        const memberEvent = Array.isArray(memberState) ? memberState[0] : memberState;
        const events = room.getLiveTimeline().getEvents();
        const lastTs = events.length ? events[events.length - 1].getTs() : undefined;
        const memberTs = memberEvent?.getTs();
        const ts = Number.isFinite(memberTs)
          ? (memberTs as number)
          : Number.isFinite(lastTs)
            ? (lastTs as number)
            : null;

        const kind: InviteKind = isSpace(room) ? 'space' : isDmRoom(room, client) ? 'dm' : 'room';

        return {
          roomId: entry.roomId,
          name: entry.name,
          avatarMxc: entry.avatarMxc,
          kind,
          inviterUserId: entry.inviterUserId,
          inviterDisplayName: entry.inviterDisplayName,
          ts,
        };
      })
      .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0));
  }, [client, revision]);

  useMatrixEvent(client, 'Room.myMembership', throttledBump);
  useMatrixEvent(client, 'Room', throttledBump);
  useMatrixEvent(client, 'RoomState.events', throttledBump);
  useMatrixEvent(client, 'sync', throttledBump);

  return invites;
}
