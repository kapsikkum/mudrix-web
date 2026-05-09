import { useState, useEffect, useCallback } from 'react';
import type { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';

export interface ReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export function useRoomReceipts(
  client: MatrixClient,
  room: Room | null
): Map<string, ReceiptUser[]> {
  const myId = client.getUserId() ?? '';

  const buildMap = useCallback((): Map<string, ReceiptUser[]> => {
    if (!room) return new Map();

    const result = new Map<string, ReceiptUser[]>();

    // Iterate over all joined members (excluding ourselves)
    const members = room.getJoinedMembers();
    for (const member of members) {
      if (member.userId === myId) continue;

      // getReadReceiptForUserId returns the receipt object { eventId, data }
      const receipt = room.getReadReceiptForUserId(member.userId);

      if (!receipt?.eventId) continue;

      const eventId = receipt.eventId;
      const existing = result.get(eventId) ?? [];
      existing.push({
        userId: member.userId,
        displayName: member.name ?? member.userId,
        avatarUrl: member.getMxcAvatarUrl() ?? null,
      });
      result.set(eventId, existing);
    }

    return result;
  }, [room, myId]);

  const [receiptMap, setReceiptMap] = useState<Map<string, ReceiptUser[]>>(buildMap);

  // Rebuild when the room or client changes
  useEffect(() => {
    setReceiptMap(buildMap());
  }, [buildMap]);

  // Re-build on every receipt event in this room
  useEffect(() => {
    if (!room) return;

    const handler = (_event: MatrixEvent, _room: Room | undefined) => {
      setReceiptMap(buildMap());
    };

    room.on(RoomEvent.Receipt, handler);
    return () => {
      room.off(RoomEvent.Receipt, handler);
    };
  }, [room, buildMap]);

  return receiptMap;
}
