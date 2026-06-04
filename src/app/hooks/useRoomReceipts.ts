import { useState, useEffect } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';

export interface ReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

function buildMap(room: Room, myId: string): Map<string, ReceiptUser[]> {
  const map = new Map<string, ReceiptUser[]>();

  for (const member of room.getJoinedMembers()) {
    if (member.userId === myId) continue;

    const receipt = room.getReadReceiptForUserId(member.userId);
    if (!receipt?.eventId) continue;

    const user: ReceiptUser = {
      userId: member.userId,
      displayName: member.name ?? member.userId,
      avatarUrl: member.getMxcAvatarUrl() ?? null,
    };

    const existing = map.get(receipt.eventId) ?? [];
    existing.push(user);
    map.set(receipt.eventId, existing);
  }

  return map;
}

export function useRoomReceipts(
  client: MatrixClient,
  room: Room | null
): Map<string, ReceiptUser[]> {
  const myId = client.getUserId() ?? '';

  const [receiptMap, setReceiptMap] = useState<Map<string, ReceiptUser[]>>(() =>
    room ? buildMap(room, myId) : new Map()
  );

  useEffect(() => {
    if (!room) {
      setReceiptMap(new Map());
      return;
    }

    setReceiptMap(buildMap(room, myId));

    const handler = () => {
      setReceiptMap(buildMap(room, myId));
    };

    room.on(RoomEvent.Receipt, handler);
    return () => {
      room.off(RoomEvent.Receipt, handler);
    };
  }, [room, myId]);

  return receiptMap;
}
