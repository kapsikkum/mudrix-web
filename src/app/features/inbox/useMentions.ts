import { useCallback, useMemo, useState } from 'react';
import { NotificationCountType, type MatrixEvent } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import { formatUserId, isDmRoom, roomState } from '@/util/matrix';

const MAX_MENTIONS = 50;
const MAX_PER_ROOM = 15;

export interface Mention {
  eventId: string;
  roomId: string;
  roomName: string;
  roomAvatarMxc: string | null;
  senderId: string;
  senderName: string;
  body: string;
  ts: number;
}

export interface UseMentionsResult {
  mentions: Mention[];
  refresh: () => void;
}

function extractBody(event: MatrixEvent): string {
  const content = event.getContent();
  const body = content?.body;
  if (typeof body === 'string') return body;
  const filename = content?.['filename'];
  if (typeof filename === 'string') return filename;
  return '';
}

export function useMentions(enabled: boolean): UseMentionsResult {
  const client = getMatrixClientOrNull();

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 300);

  const mentions = useMemo((): Mention[] => {
    if (!enabled || !client) return [];
    const myId = client.getUserId() ?? '';
    const results: Mention[] = [];

    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      if (room.isSpaceRoom()) continue;
      if (isDmRoom(room, client)) continue;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;

      const readUpTo = room.getEventReadUpTo(myId);
      const events = room.getLiveTimeline().getEvents();
      let found = 0;
      for (let i = events.length - 1; i >= 0 && found < MAX_PER_ROOM; i--) {
        const event = events[i];
        if (readUpTo && event.getId() === readUpTo) break;
        if (event.getType() !== 'm.room.message') continue;

        const senderId = event.getSender() ?? '';
        if (!senderId || senderId === myId) continue;

        const highlight = client.getPushActionsForEvent(event)?.tweaks?.highlight === true;
        if (!highlight) continue;

        const member = room.getMember(senderId);
        results.push({
          eventId: event.getId() ?? '',
          roomId: room.roomId,
          roomName: room.name ?? room.roomId,
          roomAvatarMxc: room.getMxcAvatarUrl?.() ?? null,
          senderId,
          senderName: member?.name || formatUserId(senderId),
          body: extractBody(event),
          ts: event.getTs(),
        });
        found++;
      }

      if (results.length >= MAX_MENTIONS) break;
    }

    return results.sort((a, b) => b.ts - a.ts).slice(0, MAX_MENTIONS);
  }, [client, enabled, revision]);

  useMatrixEvent(client, 'Room.timeline', throttledBump);
  useMatrixEvent(client, 'Room.myMembership', throttledBump);
  useMatrixEvent(client, 'Room', throttledBump);
  useMatrixEvent(client, 'Room.receipt', throttledBump);
  useMatrixEvent(client, 'sync', throttledBump);

  return { mentions, refresh: bump };
}

export function useHasUnreadMentions(): boolean {
  const client = getMatrixClientOrNull();

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 300);

  const hasUnread = useMemo((): boolean => {
    void revision;
    if (!client) return false;
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      if ((room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0) > 0) return true;
    }
    return false;
  }, [client, revision]);

  useMatrixEvent(client, 'Room.timeline', throttledBump);
  useMatrixEvent(client, 'Room.myMembership', throttledBump);
  useMatrixEvent(client, 'Room', throttledBump);
  useMatrixEvent(client, 'Room.receipt', throttledBump);
  useMatrixEvent(client, 'Room.UnreadNotifications', throttledBump);
  useMatrixEvent(client, 'sync', throttledBump);

  return hasUnread;
}
