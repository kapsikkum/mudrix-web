import { useState, useEffect } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';
import { isTimelineRenderedEvent } from '@/app/hooks/useTimeline';

export interface ReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  ts: number;
}

function getEffectiveEventId(receiptEventId: string, room: Room): string | null {
  // Only anchor to events in the main live timeline. Receipts pointing anywhere
  // else (e.g. thread replies) are dropped from the main timeline's receipt map.
  const events = room.getLiveTimeline().getEvents();
  const receiptIndex = events.findIndex((e) => e.getId() === receiptEventId);
  if (receiptIndex === -1) return null;

  if (isTimelineRenderedEvent(events[receiptIndex])) return receiptEventId;

  for (let i = receiptIndex - 1; i >= 0; i--) {
    const ev = events[i];
    if (isTimelineRenderedEvent(ev)) {
      return ev.getId() ?? null;
    }
  }

  return null;
}

function buildMap(room: Room, myId: string): Map<string, ReceiptUser[]> {
  const map = new Map<string, ReceiptUser[]>();

  for (const member of room.getJoinedMembers()) {
    if (member.userId === myId) continue;

    const receipt = room.getReadReceiptForUserId(member.userId);
    if (!receipt?.eventId) continue;

    const targetEventId = getEffectiveEventId(receipt.eventId, room);
    if (!targetEventId) continue;

    const user: ReceiptUser = {
      userId: member.userId,
      displayName: member.name ?? member.userId,
      avatarUrl: member.getMxcAvatarUrl() ?? null,
      ts: receipt.data.ts,
    };

    const existing = map.get(targetEventId) ?? [];
    existing.push(user);
    map.set(targetEventId, existing);
  }

  for (const users of map.values()) {
    users.sort((a, b) => b.ts - a.ts);
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
      setReceiptMap((prev) => {
        const next = buildMap(room, myId);
        // Reuse previous array references where the set of readers is identical,
        // so React.memo on <Message> can bail out with default shallow equality.
        for (const [eventId, users] of next) {
          const prevUsers = prev.get(eventId);
          if (prevUsers && prevUsers.length === users.length) {
            const nextIds = new Set(users.map((u) => u.userId));
            if (prevUsers.every((u) => nextIds.has(u.userId))) {
              next.set(eventId, prevUsers);
            }
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
