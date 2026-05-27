import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { formatUserId } from '@/util/matrix';
import { formatDateLabel } from '@/util/format';

const PAGE_SIZE = 50;

export interface TimelineItem {
  event: MatrixEvent;
  isOwn: boolean;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  isGrouped: boolean;
  showDateSep: boolean;
  dateSepLabel: string;
  isSystemMessage: boolean;
}

function buildItems(
  events: MatrixEvent[],
  client: MatrixClient,
  roomId: string,
  t: (key: string) => string,
  locale: string
): TimelineItem[] {
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(roomId);
  const items: TimelineItem[] = [];

  let lastSenderId = '';
  let lastTs = 0;
  let lastDate = '';

  const SYSTEM_EVENT_TYPES = ['m.room.member'];
  const CALL_EVENT_TYPES = ['m.call.invite', 'm.call.hangup'];
  const MESSAGE_EVENT_TYPES = ['m.room.message', 'm.sticker', 'm.room.encrypted'];

  for (const event of events) {
    const type = event.getType();
    const isSystemMessage = SYSTEM_EVENT_TYPES.includes(type);
    const isCallEvent = CALL_EVENT_TYPES.includes(type);

    if (!MESSAGE_EVENT_TYPES.includes(type) && !isSystemMessage && !isCallEvent) continue;

    if (event.getRelation()?.rel_type === 'm.replace') continue;

    if (type === 'm.room.member') {
      const content = event.getContent();
      const prevContent = event.getPrevContent();
      const membership = content?.membership;
      const prevMembership = prevContent?.membership;
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
      const isJoin = membership === 'join' && prevMembership !== 'join';
      const isLeave = (membership === 'leave' || membership === 'ban') && prevMembership === 'join';
      if (!isJoin && !isLeave && !nameChanged && !avatarChanged) continue;
    }

    const senderId = event.getSender() ?? '';
    const ts = event.getTs();
    const dateLabel = formatDateLabel(ts, t, locale);
    const showDateSep = dateLabel !== lastDate;
    lastDate = dateLabel;

    const member = room?.getMember(senderId);
    const senderName = member?.name ?? formatUserId(senderId);
    const senderAvatar = member?.getMxcAvatarUrl() ?? null;

    const GROUP_MS = 5 * 60 * 1000;
    const isGrouped =
      !isSystemMessage &&
      !isCallEvent &&
      !showDateSep &&
      senderId === lastSenderId &&
      ts - lastTs < GROUP_MS;

    items.push({
      event,
      isOwn: senderId === myId,
      senderId,
      senderName,
      senderAvatar,
      isGrouped,
      showDateSep,
      dateSepLabel: dateLabel,
      isSystemMessage: isSystemMessage || isCallEvent,
    });

    lastSenderId = senderId;
    lastTs = ts;
  }

  return items;
}

function getFirstUnreadEventId(client: MatrixClient, roomId: string, myId: string): string | null {
  const room = client.getRoom(roomId);
  if (!room) return null;

  // The read receipt the server has acknowledged for us
  const receiptEventId = room.getEventReadUpTo(myId, false);
  if (!receiptEventId) return null; // no receipt yet — treat everything as unread only on first join

  const events = room.getLiveTimeline().getEvents();
  let foundReceipt = false;

  for (const event of events) {
    const type = event.getType();
    // Only count displayable events
    if (
      ![
        'm.room.message',
        'm.sticker',
        'm.room.encrypted',
        'm.room.member',
        'm.call.invite',
        'm.call.hangup',
      ].includes(type)
    )
      continue;

    if (foundReceipt) {
      // Skip own messages — we don't show a divider before our own messages
      if (event.getSender() === myId) continue;
      return event.getId() ?? null;
    }

    if (event.getId() === receiptEventId) {
      foundReceipt = true;
    }
  }

  return null; // everything is read
}

export function useTimeline(client: MatrixClient | null, roomId: string | null) {
  const { t, i18n } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const localeRef = useRef(i18n.language);
  localeRef.current = i18n.language;
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [canPaginate, setCanPaginate] = useState(true);
  const [firstUnreadEventId, setFirstUnreadEventId] = useState<string | null>(null);
  const unreadLatchRef = useRef<string | null | undefined>(undefined);

  const rebuild = useCallback(() => {
    if (!client || !roomId) {
      setItems([]);
      setFirstUnreadEventId(null);
      unreadLatchRef.current = undefined;
      return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
      setItems([]);
      setFirstUnreadEventId(null);
      unreadLatchRef.current = undefined;
      return;
    }
    const events = room.getLiveTimeline().getEvents();
    setItems(buildItems(events, client, roomId, tRef.current, localeRef.current));

    // Compute first unread event only once per room open (latch)
    if (unreadLatchRef.current === undefined) {
      const myId = client.getUserId() ?? '';
      const id = getFirstUnreadEventId(client, roomId, myId);
      unreadLatchRef.current = id;
      setFirstUnreadEventId(id);
    }
  }, [client, roomId]);

  // Reset latch whenever we switch rooms
  useEffect(() => {
    unreadLatchRef.current = undefined;
    setFirstUnreadEventId(null);
  }, [roomId]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  // React to new timeline events
  const handleTimeline = useCallback(
    (_event: MatrixEvent, room?: Room, toStartOfTimeline?: boolean) => {
      if (room?.roomId !== roomId) return;
      if (toStartOfTimeline) return;
      rebuild();
    },
    [roomId, rebuild]
  );

  useMatrixEvent(client, 'Room.timeline', handleTimeline);
  useMatrixEvent(client, 'Room.redaction', rebuild);
  useMatrixEvent(client, 'Event.decrypted', rebuild);
  useMatrixEvent(client, 'Room.localEchoUpdated', rebuild);

  const paginate = useCallback(async () => {
    if (!client || !roomId || loading || !canPaginate) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    setLoading(true);
    try {
      const hasMore = await client.scrollback(room, PAGE_SIZE);
      setCanPaginate(!!hasMore);
      rebuild();
    } catch (err) {
      console.error('[useTimeline] paginate failed', err);
    } finally {
      setLoading(false);
    }
  }, [client, roomId, loading, canPaginate, rebuild]);

  const clearUnreadDivider = useCallback(() => {
    unreadLatchRef.current = null;
    setFirstUnreadEventId(null);
  }, []);

  return { items, loading, canPaginate, paginate, firstUnreadEventId, clearUnreadDivider };
}
