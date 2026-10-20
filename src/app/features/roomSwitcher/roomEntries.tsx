import { useCallback, useRef, useState } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import {
  formatUserId,
  getDmPartnerId,
  isDmRoom,
  isSpace,
  isVoiceRoom,
  roomState,
} from '@/util/matrix';
import { getRoomUnreadCount, roomHasUnreadMention } from '@/util/mentions';
import * as css from './RoomSwitcher.css';

export type RoomKind = 'room' | 'dm' | 'space';

export type RoomEntry = {
  roomId: string;
  name: string;
  kind: RoomKind;
  isVoice: boolean;
  avatarMxc: string | null;
  unread: number;
  highlight: boolean;
  lastActiveTs: number;
};

export function useRoomEntries(): RoomEntry[] {
  const client = getMatrixClientOrNull();
  const getEntries = useCallback((): RoomEntry[] => {
    if (!client) return [];
    const entries: RoomEntry[] = [];
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;

      const dm = isDmRoom(room, client);
      const space = isSpace(room);

      let name: string;
      let avatarMxc: string | null = null;
      if (dm) {
        const partnerId = getDmPartnerId(room, client);
        const member = partnerId ? room.getMember(partnerId) : null;
        name = member?.name || (partnerId ? formatUserId(partnerId) : room.name || '(unknown)');
        avatarMxc = member?.getMxcAvatarUrl() ?? null;
      } else {
        name = room.name || '(unknown)';
        avatarMxc = room.getMxcAvatarUrl?.() ?? null;
      }

      entries.push({
        roomId: room.roomId,
        name,
        kind: space ? 'space' : dm ? 'dm' : 'room',
        isVoice: isVoiceRoom(room),
        avatarMxc,
        unread: getRoomUnreadCount(client, room),
        highlight: roomHasUnreadMention(client, room),
        lastActiveTs: room.getLastActiveTimestamp(),
      });
    }
    return entries;
  }, [client]);

  const [entries, setEntries] = useState<RoomEntry[]>(() => getEntries());

  const getEntriesRef = useRef(getEntries);
  getEntriesRef.current = getEntries;
  const refresh = useCallback(() => setEntries(getEntriesRef.current()), []);

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'RoomState.events', refresh);
  useMatrixEvent(client, 'sync', refresh);
  return entries;
}

export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  let idx: number;
  while ((idx = lower.indexOf(q, cursor)) !== -1) {
    if (idx > cursor) parts.push({ text: text.slice(cursor, idx), highlighted: false });
    parts.push({ text: text.slice(idx, idx + q.length), highlighted: true });
    cursor = idx + q.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });
  return (
    <>
      {parts.map((p, i) =>
        p.highlighted ? (
          <mark key={i} className={css.highlight}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}
