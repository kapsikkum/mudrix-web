import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Direction, EventStatus, TimelineWindow } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useSyncReady } from '@/app/hooks/useSync';
import { formatUserId } from '@/util/matrix';
import { formatDateLabel } from '@/util/format';
import { isPinnedEvent } from '@/app/features/timeline/message/pinning';

const PAGE_SIZE = 50;
const INITIAL_SIZE = 50;
const MIN_INITIAL_ITEMS = 15;
const WINDOW_LIMIT = 1500;

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
  reactionVersion: number;
  isEdited: boolean;
  isRedacted: boolean;
  isPinned: boolean;
  isDecrypting: boolean;
  isUndecryptable: boolean;
  isSending: boolean;
  isFailed: boolean;
  sendError: string | null;
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
  const HIDDEN_EVENT_TYPES = new Set([
    'm.poll.response',
    'org.matrix.msc3381.poll.response',
    'm.poll.end',
    'org.matrix.msc3381.poll.end',
  ]);

  for (const event of events) {
    const type = event.getType();
    const isSystemMessage = SYSTEM_EVENT_TYPES.has(type);
    const isCallEvent = CALL_EVENT_TYPES.has(type);

    if (HIDDEN_EVENT_TYPES.has(type)) continue;
    if (!MESSAGE_EVENT_TYPES.has(type) && !isSystemMessage && !isCallEvent) continue;
    if (event.getRelation()?.rel_type === 'm.replace') continue;
    if (event.getRelation()?.rel_type === 'm.reference') continue;

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

    const eventId = event.getId() ?? '';
    const reactionRelations = room?.relations?.getChildEventsForEvent(
      eventId,
      'm.annotation',
      'm.reaction'
    );

    const status = event.status;

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
      reactionVersion: reactionRelations?.getRelations().length ?? 0,
      isEdited: !!event.replacingEvent(),
      isRedacted: event.isRedacted(),
      isPinned: isPinnedEvent(room ?? null, eventId),
      isDecrypting: event.isBeingDecrypted(),
      isUndecryptable: event.isDecryptionFailure(),
      isSending:
        status === EventStatus.SENDING ||
        status === EventStatus.QUEUED ||
        status === EventStatus.ENCRYPTING,
      isFailed: status === EventStatus.NOT_SENT,
      sendError:
        status === EventStatus.NOT_SENT
          ? ((event.error as { message?: string } | null)?.message ?? null)
          : null,
    });

    if (isSystemMessage || isCallEvent) {
      lastSenderId = '';
      lastTs = 0;
    } else {
      lastSenderId = senderId;
      lastTs = ts;
    }
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

export interface UseTimelineResult {
  items: TimelineItem[];
  isPaginating: boolean;
  isAtStart: boolean;
  isAtEnd: boolean;
  paginate: () => Promise<void>;
  paginateForward: () => Promise<void>;
  jumpToEvent: (eventId: string) => Promise<boolean>;
  firstUnreadEventId: string | null;
  clearUnreadDivider: () => void;
  prependCount: number;
  timelineResetEpoch: number;
}

export interface UseTimelineOptions {
  onScrollbackError?: (retry: () => void) => void;
}

export function useTimeline(
  client: MatrixClient | null,
  roomId: string | null,
  options: UseTimelineOptions = {}
): UseTimelineResult {
  const { t, i18n } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const localeRef = useRef(i18n.language);
  localeRef.current = i18n.language;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [isPaginating, setIsPaginating] = useState(false);
  const [isAtStart, setIsAtStart] = useState(false);
  const [isAtEnd, setIsAtEnd] = useState(true);
  const [firstUnreadEventId, setFirstUnreadEventId] = useState<string | null>(null);
  const [prependCount, setPrependCount] = useState(0);
  const [timelineResetEpoch, setTimelineResetEpoch] = useState(0);
  const unreadLatchRef = useRef<string | null | undefined>(undefined);

  const syncReady = useSyncReady();

  const windowRef = useRef<TimelineWindow | null>(null);
  const headEventIdRef = useRef<string | null>(null);

  const rebuildTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaginatingRef = useRef(false);
  const currentRoomIdRef = useRef(roomId);
  currentRoomIdRef.current = roomId;

  const rebuild = useCallback(
    (win?: TimelineWindow) => {
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

      const tw = win ?? windowRef.current;
      if (!tw) return;

      const built = buildItems(tw.getEvents(), client, roomId, tRef.current, localeRef.current);

      if (headEventIdRef.current === null && built.length > 0) {
        headEventIdRef.current = built[0].event.getId() ?? null;
      }

      setItems(built);
      setIsAtStart(!tw.canPaginate(Direction.Backward));
      setIsAtEnd(!tw.canPaginate(Direction.Forward));

      if (unreadLatchRef.current === undefined) {
        const myId = client.getUserId() ?? '';
        const id = getFirstUnreadEventId(client, roomId, myId);
        unreadLatchRef.current = id;
        setFirstUnreadEventId(id);
      }
    },
    [client, roomId]
  );

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

  // Reset state on room change so old data is never visible in the new room.
  useEffect(() => {
    windowRef.current = null;
    headEventIdRef.current = null;
    unreadLatchRef.current = undefined;
    isPaginatingRef.current = false;
    setFirstUnreadEventId(null);
    setIsAtStart(false);
    setIsAtEnd(true);
    setIsPaginating(false);
    setItems([]);
    setPrependCount(0);
  }, [roomId]);

  useEffect(() => {
    if (!client || !roomId || !syncReady) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    // Don't re-initialise if already done for this room.
    if (windowRef.current) return;

    const tw = new TimelineWindow(client, room.getUnfilteredTimelineSet(), {
      windowLimit: WINDOW_LIMIT,
    });
    windowRef.current = tw;

    let cancelled = false;
    tw.load(undefined, INITIAL_SIZE).then(() => {
      if (cancelled) return;
      rebuild(tw);
    });

    return () => {
      cancelled = true;
    };
  }, [client, roomId, syncReady, rebuild]);

  // Paginate backward until we have enough renderable items or reach the start.
  const paginate = useCallback(async () => {
    if (!client || !roomId) return;
    if (isPaginatingRef.current) return;
    const tw = windowRef.current;
    if (!tw) return;
    if (!tw.canPaginate(Direction.Backward)) {
      setIsAtStart(true);
      return;
    }

    isPaginatingRef.current = true;
    setIsPaginating(true);

    try {
      let renderedAdded = 0;
      const MAX_REQUESTS = 10;
      let requests = 0;

      while (renderedAdded === 0 && requests < MAX_REQUESTS) {
        if (!tw.canPaginate(Direction.Backward)) break;

        let moreAvailable: boolean;
        try {
          moreAvailable = await tw.paginate(Direction.Backward, PAGE_SIZE);
        } catch (err) {
          console.error('[useTimeline] paginate backward failed', err);
          const { onScrollbackError } = optionsRef.current;
          if (onScrollbackError) {
            onScrollbackError(() => setTimeout(() => paginate(), 0));
          }
          return;
        }

        requests++;

        if (currentRoomIdRef.current !== roomId) return;

        const built = buildItems(tw.getEvents(), client, roomId, tRef.current, localeRef.current);

        const prevHeadId = headEventIdRef.current;
        let prepended = 0;
        if (prevHeadId !== null && built.length > 0) {
          const newHeadPos = built.findIndex((item) => item.event.getId() === prevHeadId);
          if (newHeadPos > 0) prepended = newHeadPos;
        }
        headEventIdRef.current = built[0]?.event.getId() ?? null;

        renderedAdded = prepended;

        setItems(built);
        if (prepended > 0) setPrependCount((c) => c + prepended);
        setIsAtStart(!tw.canPaginate(Direction.Backward));
        setIsAtEnd(!tw.canPaginate(Direction.Forward));

        if (unreadLatchRef.current === undefined) {
          const myId = client.getUserId() ?? '';
          const id = getFirstUnreadEventId(client, roomId, myId);
          unreadLatchRef.current = id;
          setFirstUnreadEventId(id);
        }

        if (!moreAvailable) break;
      }

      // If still no renderable items but loop exhausted, reflect final state.
      if (renderedAdded === 0) {
        setIsAtStart(!tw.canPaginate(Direction.Backward));
      }
    } finally {
      isPaginatingRef.current = false;
      setIsPaginating(false);
    }
  }, [client, roomId]);

  // Paginate forward — used when the window is anchored mid-history (after a jump).
  const paginateForward = useCallback(async () => {
    if (!client || !roomId) return;
    if (isPaginatingRef.current) return;
    const tw = windowRef.current;
    if (!tw) return;
    if (!tw.canPaginate(Direction.Forward)) {
      setIsAtEnd(true);
      return;
    }

    isPaginatingRef.current = true;
    setIsPaginating(true);

    try {
      let renderedAdded = 0;
      const MAX_REQUESTS = 10;
      let requests = 0;

      while (renderedAdded === 0 && requests < MAX_REQUESTS) {
        if (!tw.canPaginate(Direction.Forward)) break;

        let moreAvailable: boolean;
        try {
          moreAvailable = await tw.paginate(Direction.Forward, PAGE_SIZE);
        } catch (err) {
          console.error('[useTimeline] paginate forward failed', err);
          return;
        }

        requests++;

        if (currentRoomIdRef.current !== roomId) return;

        const built = buildItems(tw.getEvents(), client, roomId, tRef.current, localeRef.current);

        const prevLen = items.length;
        renderedAdded = Math.max(0, built.length - prevLen);

        setItems(built);
        setIsAtStart(!tw.canPaginate(Direction.Backward));
        setIsAtEnd(!tw.canPaginate(Direction.Forward));

        if (!moreAvailable) break;
      }
    } finally {
      isPaginatingRef.current = false;
      setIsPaginating(false);
    }
  }, [client, roomId, items.length]);

  // Jump to an arbitrary event. If it's already in the window, return false
  const jumpToEvent = useCallback(
    async (eventId: string): Promise<boolean> => {
      if (!client || !roomId) return false;
      const tw = windowRef.current;
      if (!tw) return false;

      const alreadyLoaded = tw.getEvents().some((e) => e.getId() === eventId);
      if (alreadyLoaded) return false;

      if (isPaginatingRef.current) return false;
      isPaginatingRef.current = true;
      setIsPaginating(true);

      try {
        const newTw = new TimelineWindow(
          client,
          client.getRoom(roomId)!.getUnfilteredTimelineSet(),
          {
            windowLimit: WINDOW_LIMIT,
          }
        );
        await newTw.load(eventId, INITIAL_SIZE);

        if (currentRoomIdRef.current !== roomId) return false;

        windowRef.current = newTw;
        headEventIdRef.current = null;

        const built = buildItems(
          newTw.getEvents(),
          client,
          roomId,
          tRef.current,
          localeRef.current
        );
        headEventIdRef.current = built[0]?.event.getId() ?? null;

        setItems(built);
        setPrependCount(0);
        setIsAtStart(!newTw.canPaginate(Direction.Backward));
        setIsAtEnd(!newTw.canPaginate(Direction.Forward));
        setTimelineResetEpoch((e) => e + 1);
        return true;
      } catch (err) {
        console.error('[useTimeline] jumpToEvent failed', err);
        return false;
      } finally {
        isPaginatingRef.current = false;
        setIsPaginating(false);
      }
    },
    [client, roomId]
  );

  // Initial auto-paginate if the first load didn't yield enough renderable items.
  useEffect(() => {
    if (!client || !roomId) return;
    const tw = windowRef.current;
    if (!tw || items.length === 0) return;
    if (items.length >= MIN_INITIAL_ITEMS) return;
    if (!tw.canPaginate(Direction.Backward)) return;

    const timer = setTimeout(() => paginate(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, roomId, items.length]);

  const handleTimeline = useCallback(
    (_event: MatrixEvent, room?: Room, toStartOfTimeline?: boolean) => {
      if (room?.roomId !== roomId) return;
      if (toStartOfTimeline) return;
      const tw = windowRef.current;
      if (!tw) {
        return;
      }
      // When the window is anchored at the live end, extend it forward to pick
      // up new events. Otherwise just rebuild from whatever is loaded.
      if (!tw.canPaginate(Direction.Forward)) {
        tw.paginate(Direction.Forward, 1, false).then(() => rebuild());
      } else {
        rebuild();
      }
    },
    [roomId, rebuild]
  );

  const handleTimelineReset = useCallback(
    (room?: Room) => {
      if (room?.roomId !== roomId) return;
      if (!client) return;
      const r = client.getRoom(roomId);
      if (!r) return;

      headEventIdRef.current = null;
      windowRef.current = null;
      const newTw = new TimelineWindow(client, r.getUnfilteredTimelineSet(), {
        windowLimit: WINDOW_LIMIT,
      });
      windowRef.current = newTw;
      setPrependCount(0);
      setTimelineResetEpoch((e) => e + 1);

      newTw.load(undefined, INITIAL_SIZE).then(() => {
        if (currentRoomIdRef.current !== roomId) return;
        rebuild(newTw);
      });
    },
    [client, roomId, rebuild]
  );

  useMatrixEvent(client, 'Room.timeline', handleTimeline);
  useMatrixEvent(client, 'Room.redaction', rebuild);
  useMatrixEvent(client, 'Event.decrypted', scheduleRebuild);
  useMatrixEvent(client, 'Room.localEchoUpdated', rebuild);
  useMatrixEvent(client, 'Room.timelineReset', handleTimelineReset);

  const clearUnreadDivider = useCallback(() => {
    unreadLatchRef.current = null;
    setFirstUnreadEventId(null);
  }, []);

  return {
    items,
    isPaginating,
    isAtStart,
    isAtEnd,
    paginate,
    paginateForward,
    jumpToEvent,
    firstUnreadEventId,
    clearUnreadDivider,
    prependCount,
    timelineResetEpoch,
  };
}
