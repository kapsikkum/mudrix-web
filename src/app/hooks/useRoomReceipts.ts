import { useState, useEffect } from 'react';
import type { MatrixClient, Room, MatrixEvent } from 'matrix-js-sdk';
import { RoomEvent } from 'matrix-js-sdk';

export interface ReceiptUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

const RENDERED_EVENT_TYPES = new Set([
  'm.room.message',
  'm.sticker',
  'm.room.encrypted',
  'm.room.member',
  'm.call.invite',
  'm.call.hangup',
  'm.poll.start',
  'org.matrix.msc3381.poll.start',
]);

function isMemberEventRendered(event: MatrixEvent): boolean {
  if (event.getType() !== 'm.room.member') return false;
  const content = event.getContent();
  const prevContent = event.getPrevContent();
  const membership = content?.membership;
  const prevMembership = prevContent?.membership;
  const isJoin = membership === 'join' && prevMembership !== 'join';
  const isLeave = (membership === 'leave' || membership === 'ban') && prevMembership === 'join';
  const nameChanged =
    membership === 'join' &&
    prevMembership === 'join' &&
    content?.displayname !== prevContent?.displayname &&
    prevContent?.displayname;
  const avatarChanged =
    membership === 'join' &&
    prevMembership === 'join' &&
    content?.avatar_url !== prevContent?.avatar_url &&
    prevContent?.avatar_url !== undefined;
  return isJoin || isLeave || !!nameChanged || !!avatarChanged;
}

function getEffectiveEventId(receiptEventId: string, room: Room): string | null {
  const event = room.findEventById(receiptEventId);
  if (event) {
    if (!RENDERED_EVENT_TYPES.has(event.getType())) {
      // Non-rendered event type, will need to walk back
    } else if (event.getType() === 'm.room.member' && !isMemberEventRendered(event)) {
      // Filtered-out member event, will need to walk back
    } else {
      return receiptEventId;
    }
  }

  // Walk backward through the live timeline to find the nearest rendered event
  const events = room.getLiveTimeline().getEvents();
  const receiptIndex = events.findIndex((e) => e.getId() === receiptEventId);
  if (receiptIndex === -1) return null;

  for (let i = receiptIndex - 1; i >= 0; i--) {
    const ev = events[i];
    if (
      RENDERED_EVENT_TYPES.has(ev.getType()) &&
      (ev.getType() !== 'm.room.member' || isMemberEventRendered(ev))
    ) {
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
    };

    const existing = map.get(targetEventId) ?? [];
    existing.push(user);
    map.set(targetEventId, existing);
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
