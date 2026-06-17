import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { formatUserId } from '@/util/matrix';
import { formatDateLabel } from '@/util/format';

const PAGE_SIZE = 50;
const MAX_EMPTY_PAGES = 10;

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

  const SYSTEM_EVENT_TYPES = new Set(['m.room.member']);
  const CALL_EVENT_TYPES = new Set(['m.call.invite', 'm.call.hangup']);
  const MESSAGE_EVENT_TYPES = new Set([
    'm.room.message',
    'm.sticker',
    'm.room.encrypted',
    'm.poll.start',
    'org.matrix.msc3381.poll.start',
  ]);

  for (const event of events) {
    const type = event.getType();
    const isSystemMessage = SYSTEM_EVENT_TYPES.has(type);
    const isCallEvent = CALL_EVENT_TYPES.has(type);

    if (!MESSAGE_EVENT_TYPES.has(type) && !isSystemMessage && !isCallEvent) continue;
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
  const receiptEventId = room.getEventReadUpTo(myId, false);
  if (!receiptEventId) return null;
  const events = room.getLiveTimeline().getEvents();
  let foundReceipt = false;
  const renderedTypes = new Set([
    'm.room.message',
    'm.sticker',
    'm.room.encrypted',
    'm.room.member',
    'm.call.invite',
    'm.call.hangup',
    'm.poll.start',
    'org.matrix.msc3381.poll.start',
  ]);
  for (const event of events) {
    const type = event.getType();
    if (!renderedTypes.has(type)) continue;
    if (foundReceipt) {
      if (event.getSender() === myId) continue;
      return event.getId() ?? null;
    }
    if (event.getId() === receiptEventId) foundReceipt = true;
  }
  return null;
}

function hasReachedStart(room: Room): boolean {
  return (room.oldState as { paginationToken: string | null }).paginationToken === null;
}

export interface UseTimelineResult {
  items: TimelineItem[];
  isPaginating: boolean;
  isAtStart: boolean;
  paginate: () => Promise<void>;
  firstUnreadEventId: string | null;
  clearUnreadDivider: () => void;
}

export function useTimeline(client: MatrixClient | null, roomId: string | null): UseTimelineResult {
  const { t, i18n } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const localeRef = useRef(i18n.language);
  localeRef.current = i18n.language;

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isPaginating, setIsPaginating] = useState(false);
  const [isAtStart, setIsAtStart] = useState(false);
  const [firstUnreadEventId, setFirstUnreadEventId] = useState<string | null>(null);
  const unreadLatchRef = useRef<string | null | undefined>(undefined);

  const isAtStartRef = useRef(false);
  const emptyPageCountRef = useRef(0);

  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaginatingRef = useRef(false);
  const currentRoomIdRef = useRef(roomId);
  currentRoomIdRef.current = roomId;

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

    const built = buildItems(
      room.getLiveTimeline().getEvents(),
      client,
      roomId,
      tRef.current,
      localeRef.current
    );
    setItems(built);

    if (isAtStartRef.current) {
      setIsAtStart(true);
    } else if (hasReachedStart(room)) {
      isAtStartRef.current = true;
      setIsAtStart(true);
    }

    if (unreadLatchRef.current === undefined) {
      const myId = client.getUserId() ?? '';
      const id = getFirstUnreadEventId(client, roomId, myId);
      unreadLatchRef.current = id;
      setFirstUnreadEventId(id);
    }
  }, [client, roomId]);

  const scheduleRebuild = useCallback(() => {
    if (rebuildTimerRef.current !== null) return;
    rebuildTimerRef.current = setTimeout(() => {
      rebuildTimerRef.current = null;
      rebuild();
    }, 80);
  }, [rebuild]);

  useEffect(
    () => () => {
      if (rebuildTimerRef.current !== null) {
        clearTimeout(rebuildTimerRef.current);
        rebuildTimerRef.current = null;
      }
    },
    [roomId]
  );

  useEffect(() => {
    isAtStartRef.current = false;
    emptyPageCountRef.current = 0;
    unreadLatchRef.current = undefined;
    setFirstUnreadEventId(null);
    setIsAtStart(false);
    setIsPaginating(false);
    setItems([]);
  }, [roomId]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

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
  useMatrixEvent(client, 'Event.decrypted', scheduleRebuild);
  useMatrixEvent(client, 'Room.localEchoUpdated', rebuild);

  const paginate = useCallback(async () => {
    if (!client || !roomId) return;
    if (isPaginatingRef.current) return;
    if (isAtStartRef.current) {
      setIsAtStart(true);
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;
    if (hasReachedStart(room)) {
      isAtStartRef.current = true;
      setIsAtStart(true);
      return;
    }

    const rawBefore = room.getLiveTimeline().getEvents().length;
    const tokenBefore = (room.oldState as { paginationToken: string | null }).paginationToken;

    isPaginatingRef.current = true;
    setIsPaginating(true);

    try {
      try {
        await client.scrollback(room, PAGE_SIZE);
      } catch (err) {
        console.error('[useTimeline] scrollback failed', err);
        return;
      }

      if (currentRoomIdRef.current !== roomId) return;

      const updatedRoom = client.getRoom(roomId);
      if (!updatedRoom) return;

      const rawAfter = updatedRoom.getLiveTimeline().getEvents().length;
      const tokenAfter = (updatedRoom.oldState as { paginationToken: string | null })
        .paginationToken;
      const noProgress = rawAfter <= rawBefore && tokenAfter === tokenBefore;

      const built = buildItems(
        updatedRoom.getLiveTimeline().getEvents(),
        client,
        roomId,
        tRef.current,
        localeRef.current
      );

      if (built.length === 0 && !noProgress) {
        emptyPageCountRef.current += 1;
      } else {
        emptyPageCountRef.current = 0;
      }

      const atStart =
        tokenAfter === null || noProgress || emptyPageCountRef.current >= MAX_EMPTY_PAGES;
      if (atStart) isAtStartRef.current = true;

      setItems(built);
      setIsAtStart(isAtStartRef.current);

      if (unreadLatchRef.current === undefined) {
        const myId = client.getUserId() ?? '';
        const id = getFirstUnreadEventId(client, roomId, myId);
        unreadLatchRef.current = id;
        setFirstUnreadEventId(id);
      }
    } finally {
      isPaginatingRef.current = false;
      setIsPaginating(false);
    }
  }, [client, roomId]);

  const clearUnreadDivider = useCallback(() => {
    unreadLatchRef.current = null;
    setFirstUnreadEventId(null);
  }, []);

  return { items, isPaginating, isAtStart, paginate, firstUnreadEventId, clearUnreadDivider };
}
