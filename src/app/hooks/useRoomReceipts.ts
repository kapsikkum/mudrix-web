import { useState, useEffect, useRef } from 'react';
import type { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';

export interface ReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface UserReceiptEntry {
  eventId: string;
  user: ReceiptUser;
}

export function useRoomReceipts(
  client: MatrixClient,
  room: Room | null
): Map<string, ReceiptUser[]> {
  const myId = client.getUserId() ?? '';

  // Tracks userId, latest receipt info for incremental updates
  const userReceiptsRef = useRef<Map<string, UserReceiptEntry>>(new Map());

  const buildMap = (): Map<string, ReceiptUser[]> => {
    if (!room) return new Map();

    const result = new Map<string, ReceiptUser[]>();
    const userMap = new Map<string, UserReceiptEntry>();
    const members = room.getJoinedMembers();

    for (const member of members) {
      if (member.userId === myId) continue;

      const receipt = room.getReadReceiptForUserId(member.userId);
      if (!receipt?.eventId) continue;

      const user: ReceiptUser = {
        userId: member.userId,
        displayName: member.name ?? member.userId,
        avatarUrl: member.getMxcAvatarUrl() ?? null,
      };

      const existing = result.get(receipt.eventId) ?? [];
      existing.push(user);
      result.set(receipt.eventId, existing);

      userMap.set(member.userId, { eventId: receipt.eventId, user });
    }

    userReceiptsRef.current = userMap;
    return result;
  };

  const [receiptMap, setReceiptMap] = useState<Map<string, ReceiptUser[]>>(buildMap);

  // Rebuild when the room or client changes
  useEffect(() => {
    setReceiptMap(buildMap());
  }, [room, myId]);

  // Incrementally update the receipt map on each receipt event
  useEffect(() => {
    if (!room) return;

    const handler = (event: MatrixEvent, _room: Room | undefined) => {
      const content = event.getContent() as Record<string, unknown>;
      const changedUsers = new Set<string>();

      for (const receiptTypes of Object.values(content)) {
        if (!receiptTypes || typeof receiptTypes !== 'object') continue;
        for (const [type, users] of Object.entries(receiptTypes as Record<string, unknown>)) {
          if (type !== 'm.read') continue;
          if (!users || typeof users !== 'object') continue;
          for (const userId of Object.keys(users as Record<string, unknown>)) {
            if (userId !== myId) changedUsers.add(userId);
          }
        }
      }

      if (changedUsers.size === 0) return;

      setReceiptMap((prev) => {
        const next = new Map(prev);

        for (const userId of changedUsers) {
          // Remove old entry for this user
          const old = userReceiptsRef.current.get(userId);
          if (old) {
            const arr = next.get(old.eventId);
            if (arr) {
              const filtered = arr.filter((u) => u.userId !== userId);
              if (filtered.length === 0) {
                next.delete(old.eventId);
              } else {
                next.set(old.eventId, filtered);
              }
            }
          }

          // Add new entry for this user
          const receipt = room.getReadReceiptForUserId(userId);
          if (receipt?.eventId) {
            const member = room.getMember(userId);
            const user: ReceiptUser = {
              userId,
              displayName: member?.name ?? userId,
              avatarUrl: member?.getMxcAvatarUrl() ?? null,
            };
            const arr = next.get(receipt.eventId) ?? [];
            arr.push(user);
            next.set(receipt.eventId, arr);
            userReceiptsRef.current.set(userId, { eventId: receipt.eventId, user });
          } else {
            userReceiptsRef.current.delete(userId);
          }
        }

        return next;
      });
    };

    room.on(RoomEvent.Receipt, handler);
    return () => {
      room.off(RoomEvent.Receipt, handler);
    };
  }, [room, myId]);

  return receiptMap;
}
