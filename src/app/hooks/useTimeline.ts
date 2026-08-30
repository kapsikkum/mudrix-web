import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Direction, EventStatus, EventType, TimelineWindow, Filter } from 'matrix-js-sdk';
import type {
  MatrixClient,
  MatrixEvent,
  Room,
  IRoomTimelineData,
  EventTimelineSet,
} from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useSyncReady } from '@/app/hooks/useSync';
import { formatUserId } from '@/util/matrix';
import { formatDateLabel } from '@/util/format';
import { isPinnedEvent } from '@/app/features/timeline/message/pinning';
import {
  computeRoomPermissions,
  computeMessagePermissions,
} from '@/app/features/timeline/message/permissions';
import { applyRedactionToRelations } from '@/app/features/timeline/message/reactions';
import { getEncryptedFile } from '@/app/features/timeline/encryptedMedia';

const PAGE_SIZE = 50;
const INITIAL_SIZE = 50;
const MIN_INITIAL_ITEMS = 15;
const WINDOW_LIMIT = 1500;
const MAX_RAW_EVENTS = WINDOW_LIMIT;

const TIMELINE_FILTER_ID = 'wz_chat_timeline_v1';
function buildChatTimelineFilter(userId: string): Filter {
  const filter = new Filter(userId);
  filter.filterId = TIMELINE_FILTER_ID;
  filter.setDefinition({
    room: {
      timeline: {
        not_types: [],
      },
    },
  });
  return filter;
}

const SYSTEM_EVENT_TYPES = new Set(['m.room.member']);
const CALL_EVENT_TYPES: Set<string> = new Set([EventType.GroupCallMemberPrefix]);
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

export function isTimelineRenderedEvent(event: MatrixEvent): boolean {
  const type = event.getType();
  if (HIDDEN_EVENT_TYPES.has(type)) return false;
  const rel = event.getRelation()?.rel_type;
  if (rel === 'm.replace' || rel === 'm.reference') return false;
  if (
    !MESSAGE_EVENT_TYPES.has(type) &&
    !SYSTEM_EVENT_TYPES.has(type) &&
    !CALL_EVENT_TYPES.has(type)
  )
    return false;

  if (type === EventType.GroupCallMemberPrefix) {
    const content = event.getContent() as Record<string, unknown>;
    const prevContent = event.getPrevContent() as Record<string, unknown> | undefined;
    const callJoined = Boolean(content.application);
    if (callJoined && prevContent && 'application' in prevContent) return false;
  }

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
    if (!isJoin && !isLeave && !nameChanged && !avatarChanged) return false;
  }

  return true;
}

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
  canEdit: boolean;
  canRedact: boolean;
  canPin: boolean;
  isDecrypting: boolean;
  isUndecryptable: boolean;
  isSending: boolean;
  isFailed: boolean;
  sendError: string | null;
  optimisticBody: string | null;
  galleryEvents: MatrixEvent[] | null;
}

export function itemContainsEvent(item: TimelineItem, eventId: string): boolean {
  if (item.event.getId() === eventId) return true;
  return item.galleryEvents?.some((e) => e.getId() === eventId) ?? false;
}

export function indexOfEvent(items: TimelineItem[], eventId: string): number {
  return items.findIndex((item) => itemContainsEvent(item, eventId));
}

export function buildItems(
  events: MatrixEvent[],
  client: MatrixClient,
  roomId: string,
  t: (key: string) => string,
  locale: string,
  optimisticRedactedIds: ReadonlySet<string> = new Set(),
  optimisticEditBodies: ReadonlyMap<string, string> = new Map()
): TimelineItem[] {
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(roomId);
  const roomPerms = computeRoomPermissions(room, myId);
  const items: TimelineItem[] = [];

  let lastSenderId = '';
  let lastTs = 0;
  let lastDate = '';

  const isGalleryCandidate = (e: MatrixEvent): boolean => {
    if (e.isRedacted() || e.isDecryptionFailure()) return false;
    if (e.getRelation()) return false;
    const c = e.getContent() as Record<string, unknown> | null;
    if (!c || typeof c !== 'object') return false;
    if ((c.msgtype as string | undefined) !== 'm.image') return false;
    if (
      ((c.info as Record<string, unknown> | undefined)?.mimetype as string | undefined) ===
      'image/svg+xml'
    ) {
      return false;
    }
    const encFile = getEncryptedFile(c);
    const url = c.url;
    return Boolean(encFile) || (typeof url === 'string' && url.startsWith('mxc://'));
  };

  const GALLERY_GAP_MS = 5 * 60 * 1000;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const type = event.getType();
    const isSystemMessage = SYSTEM_EVENT_TYPES.has(type);
    const isCallEvent = CALL_EVENT_TYPES.has(type);

    if (!isTimelineRenderedEvent(event)) continue;

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
    const isOptimisticallyRedacted = optimisticRedactedIds.has(eventId);
    const optimisticBody = optimisticEditBodies.get(eventId) ?? null;

    // Collapse consecutive image-only uploads from the same sender into a gallery.
    let galleryEvents: MatrixEvent[] | null = null;
    if (isGalleryCandidate(event)) {
      const group = [event];
      let prevTs = ts;
      for (let j = i + 1; j < events.length; j++) {
        const next = events[j];
        if (!isTimelineRenderedEvent(next)) continue;
        if (!isGalleryCandidate(next)) break;
        if (next.getSender() !== senderId) break;
        const nextTs = next.getTs();
        if (nextTs - prevTs >= GALLERY_GAP_MS) break;
        if (formatDateLabel(nextTs, t, locale) !== dateLabel) break;
        group.push(next);
        prevTs = nextTs;
      }
      if (group.length >= 2) galleryEvents = group;
    }

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
      reactionVersion:
        reactionRelations
          ?.getRelations()
          .filter((r) => r.getId() && !r.isRedacted() && r.status !== EventStatus.NOT_SENT)
          .length ?? 0,
      isEdited: !!event.replacingEvent() || optimisticBody !== null,
      isRedacted: event.isRedacted() || isOptimisticallyRedacted,
      isPinned: isPinnedEvent(room ?? null, eventId),
      ...computeMessagePermissions(room, myId, event, roomPerms),
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
      optimisticBody,
      galleryEvents,
    });

    if (galleryEvents !== null) {
      const galleryLast = galleryEvents[galleryEvents.length - 1];
      if (galleryLast) {
        i += galleryEvents.length - 1;
        lastSenderId = galleryLast.getSender() ?? '';
        lastTs = galleryLast.getTs();
      }
    } else if (isSystemMessage || isCallEvent) {
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
  optimisticRedactedIds?: ReadonlySet<string>;
  optimisticEditBodies?: ReadonlyMap<string, string>;
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

  const optimisticRedactedIdsRef = useRef(options.optimisticRedactedIds ?? new Set<string>());
  optimisticRedactedIdsRef.current = options.optimisticRedactedIds ?? new Set<string>();
  const optimisticEditBodiesRef = useRef(options.optimisticEditBodies ?? new Map<string, string>());
  optimisticEditBodiesRef.current = options.optimisticEditBodies ?? new Map<string, string>();

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
  const timelineSetRef = useRef<EventTimelineSet | null>(null);
  const recreatingRef = useRef(false);

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

      let built: TimelineItem[];
      try {
        built = buildItems(
          tw.getEvents(),
          client,
          roomId,
          tRef.current,
          localeRef.current,
          optimisticRedactedIdsRef.current,
          optimisticEditBodiesRef.current
        );
      } catch (err) {
        console.error('[useTimeline] buildItems failed, keeping last render', err);
        return;
      }

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

  const safeBuildItems = useCallback(
    (tw: TimelineWindow): TimelineItem[] => {
      if (!client || !roomId) return [];
      try {
        return buildItems(
          tw.getEvents(),
          client,
          roomId,
          tRef.current,
          localeRef.current,
          optimisticRedactedIdsRef.current,
          optimisticEditBodiesRef.current
        );
      } catch (err) {
        console.error('[useTimeline] buildItems failed', err);
        return [];
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

  const recreateWindow = useCallback(() => {
    if (!client || !roomId) return;
    if (recreatingRef.current) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    recreatingRef.current = true;
    headEventIdRef.current = null;
    windowRef.current = null;

    const filter = buildChatTimelineFilter(client.getUserId() ?? '');
    const timelineSet = room.getOrCreateFilteredTimelineSet(filter, {
      prepopulateTimeline: true,
      useSyncEvents: true,
      pendingEvents: true,
    });
    timelineSetRef.current = timelineSet;

    const newTw = new TimelineWindow(client, timelineSet, {
      windowLimit: WINDOW_LIMIT,
    });
    windowRef.current = newTw;
    setPrependCount(0);
    setTimelineResetEpoch((e) => e + 1);

    newTw.load(undefined, INITIAL_SIZE).then(() => {
      recreatingRef.current = false;
      if (currentRoomIdRef.current !== roomId) return;
      rebuild(newTw);
    });
  }, [client, roomId, rebuild]);

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
    timelineSetRef.current = null;
    recreatingRef.current = false;
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

    const filter = buildChatTimelineFilter(client.getUserId() ?? '');
    const timelineSet = room.getOrCreateFilteredTimelineSet(filter, {
      prepopulateTimeline: true,
      useSyncEvents: true,
      pendingEvents: true,
    });
    timelineSetRef.current = timelineSet;

    const tw = new TimelineWindow(client, timelineSet, {
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
      let rawEventsConsumed = 0;

      while (renderedAdded === 0 && rawEventsConsumed < MAX_RAW_EVENTS) {
        if (!tw.canPaginate(Direction.Backward)) break;

        const rawBefore = tw.getEvents().length;

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

        rawEventsConsumed += Math.max(tw.getEvents().length - rawBefore, PAGE_SIZE);

        if (currentRoomIdRef.current !== roomId) return;

        const built = safeBuildItems(tw);

        const prevHeadId = headEventIdRef.current;
        let prepended = 0;
        if (prevHeadId !== null && built.length > 0) {
          const newHeadPos = indexOfEvent(built, prevHeadId);
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

      if (renderedAdded === 0) {
        setIsAtStart(true);
      }
    } finally {
      isPaginatingRef.current = false;
      setIsPaginating(false);
    }
  }, [client, roomId, safeBuildItems]);

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

        const built = safeBuildItems(tw);

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
  }, [client, roomId, items.length, safeBuildItems]);

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
        const room = client.getRoom(roomId)!;
        const filter = buildChatTimelineFilter(client.getUserId() ?? '');
        const timelineSet = room.getOrCreateFilteredTimelineSet(filter, {
          prepopulateTimeline: true,
          useSyncEvents: true,
          pendingEvents: true,
        });
        timelineSetRef.current = timelineSet;
        const newTw = new TimelineWindow(client, timelineSet, {
          windowLimit: WINDOW_LIMIT,
        });
        await newTw.load(eventId, INITIAL_SIZE);

        if (currentRoomIdRef.current !== roomId) return false;

        windowRef.current = newTw;
        headEventIdRef.current = null;

        const built = safeBuildItems(newTw);
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
    [client, roomId, safeBuildItems]
  );

  // Initial auto-paginate if the first load didn't yield enough renderable items.
  useEffect(() => {
    if (!client || !roomId) return;
    const tw = windowRef.current;
    if (!tw) return;
    if (items.length >= MIN_INITIAL_ITEMS) return;
    if (!tw.canPaginate(Direction.Backward)) return;

    const timer = setTimeout(() => paginate(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, roomId, items.length]);

  const handleTimeline = useCallback(
    (
      _event: MatrixEvent,
      room?: Room,
      toStartOfTimeline?: boolean,
      _removed?: boolean,
      data?: IRoomTimelineData
    ) => {
      if (room?.roomId !== roomId) return;
      if (toStartOfTimeline) return;

      if (!data?.timeline || data.timeline.getTimelineSet() !== timelineSetRef.current) return;

      const tw = windowRef.current;
      if (!tw) return;
      if (recreatingRef.current) return;

      const liveTimeline = timelineSetRef.current?.getLiveTimeline();
      const endIndex = tw.getTimelineIndex(Direction.Forward);

      if (endIndex && endIndex.timeline !== liveTimeline && !tw.canPaginate(Direction.Forward)) {
        recreateWindow();
        return;
      }

      if (data.liveEvent && endIndex?.timeline === liveTimeline) {
        tw.extend(Direction.Forward, 1);
      }

      try {
        rebuild();
      } catch (err) {
        console.error('[useTimeline] rebuild failed, recreating window', err);
        recreateWindow();
      }
    },
    [roomId, rebuild, recreateWindow]
  );

  const handleTimelineReset = useCallback(
    (room?: Room) => {
      if (room?.roomId !== roomId) return;
      recreateWindow();
    },
    [roomId, recreateWindow]
  );

  const handleRedactionOrEcho = useCallback(
    (event: MatrixEvent) => {
      if (!client || !roomId) return;
      applyRedactionToRelations(client.getRoom(roomId), event);
      rebuild();
    },
    [client, roomId, rebuild]
  );

  useMatrixEvent(client, 'Room.timeline', handleTimeline);
  useMatrixEvent(client, 'Room.redaction', handleRedactionOrEcho);
  useMatrixEvent(client, 'Event.decrypted', scheduleRebuild);
  useMatrixEvent(client, 'Room.localEchoUpdated', handleRedactionOrEcho);
  useMatrixEvent(client, 'Room.timelineReset', handleTimelineReset);
  useMatrixEvent(client, 'sync', scheduleRebuild);

  useEffect(() => {
    rebuild();
  }, [options.optimisticRedactedIds, options.optimisticEditBodies, rebuild]);

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
