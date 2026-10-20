import { useCallback, useMemo, useState } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import { formatUserId, getDmPartnerId, roomState } from '@/util/matrix';
import { getUnreadMentionEvents, roomHasUnreadMention } from '@/util/mentions';

const MAX_MENTIONS = 50;
const MAX_PER_ROOM = 15;

export interface Mention {
  eventId: string;
  roomId: string;
  roomName: string;
  roomAvatarMxc: string | null;
  senderId: string;
  senderName: string;
  ts: number;
  kind: 'room' | 'dm';
}

export interface UseMentionsResult {
  mentions: Mention[];
  refresh: () => void;
}

export function useMentions(enabled: boolean): UseMentionsResult {
  const client = getMatrixClientOrNull();

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 300);

  const mentions = useMemo((): Mention[] => {
    if (!enabled || !client) return [];
    const results: Mention[] = [];

    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      if (room.isSpaceRoom()) continue;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;

      const roomMentions = getUnreadMentionEvents(client, room, MAX_PER_ROOM);
      if (roomMentions.length === 0) continue;

      const dmPartnerId = getDmPartnerId(room, client);
      const partner = dmPartnerId ? room.getMember(dmPartnerId) : null;
      const kind: Mention['kind'] = dmPartnerId ? 'dm' : 'room';
      const roomName = dmPartnerId
        ? (partner?.name ?? formatUserId(dmPartnerId))
        : (room.name ?? room.roomId);
      const roomAvatarMxc = dmPartnerId
        ? (partner?.getMxcAvatarUrl() ?? null)
        : (room.getMxcAvatarUrl?.() ?? null);

      for (const event of roomMentions) {
        const senderId = event.getSender() ?? '';
        const member = room.getMember(senderId);
        results.push({
          eventId: event.getId() ?? '',
          roomId: room.roomId,
          roomName,
          roomAvatarMxc,
          senderId,
          senderName: member?.name || formatUserId(senderId),
          ts: event.getTs(),
          kind,
        });
      }

      if (results.length >= MAX_MENTIONS) break;
    }

    return results.sort((a, b) => b.ts - a.ts).slice(0, MAX_MENTIONS);
  }, [client, enabled, revision]);

  useMatrixEvent(client, 'Room.timeline', throttledBump);
  useMatrixEvent(client, 'Room.myMembership', throttledBump);
  useMatrixEvent(client, 'Room', throttledBump);
  useMatrixEvent(client, 'Room.receipt', throttledBump);
  useMatrixEvent(client, 'Event.decrypted', throttledBump);
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
      if (room.isSpaceRoom()) continue;
      if (roomHasUnreadMention(client, room)) return true;
    }
    return false;
  }, [client, revision]);

  useMatrixEvent(client, 'Room.timeline', throttledBump);
  useMatrixEvent(client, 'Room.myMembership', throttledBump);
  useMatrixEvent(client, 'Room', throttledBump);
  useMatrixEvent(client, 'Room.receipt', throttledBump);
  useMatrixEvent(client, 'Room.UnreadNotifications', throttledBump);
  useMatrixEvent(client, 'Event.decrypted', throttledBump);
  useMatrixEvent(client, 'sync', throttledBump);

  return hasUnread;
}
