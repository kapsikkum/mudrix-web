import { useEffect } from 'react';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient, Room } from 'matrix-js-sdk';

import { roomState } from '@/util/matrix';

async function acceptDmInvite(client: MatrixClient, room: Room) {
  const inviter = room.getDMInviter?.();
  if (!inviter) return;

  try {
    await client.joinRoom(room.roomId);

    const dmData =
      client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>() ?? {};
    const existingRooms = dmData[inviter] ?? [];
    if (!existingRooms.includes(room.roomId)) {
      await client.setAccountData(EventType.Direct, {
        ...dmData,
        [inviter]: [...existingRooms, room.roomId],
      });
    }
  } catch {
    // Auto-accept failed — the invite will still appear as a regular room preview
  }
}

export function useAutoAcceptDmInvites(client: MatrixClient | null) {
  useEffect(() => {
    if (!client) return;

    const handler = (room: Room, membership: string) => {
      if (membership !== 'invite') return;
      acceptDmInvite(client, room);
    };

    client.on('Room.myMembership' as Parameters<typeof client.on>[0], handler);

    // Also accept existing DM invites
    for (const room of client.getRooms()) {
      if (
        room.getMyMembership() === 'invite' &&
        !roomState(room).getStateEvents('m.room.tombstone', '')
      ) {
        acceptDmInvite(client, room);
      }
    }

    return () => {
      client.removeListener('Room.myMembership' as Parameters<typeof client.off>[0], handler);
    };
  }, [client]);
}
