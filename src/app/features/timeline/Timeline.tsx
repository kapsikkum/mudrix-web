import { useRef, useEffect, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventType, RelationType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { CaretDownIcon, UploadIcon, ChatTeardropTextIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { formatUserId, isDmRoom } from '@/util/matrix';
import {
  messageLayoutAtom,
  preferencesAtom,
  confirmModalAtom,
  editMessageAtom,
  emojiPickerAtom,
  currentRoomIdAtom,
  callStateAtom,
  voiceStateAtom,
} from '@/app/store/atoms';
import { placeCallAtom } from '@/app/store/atoms/call';
import { useRoomReceipts } from '@/app/hooks/useRoomReceipts';
import { useTimeline } from '@/app/hooks/useTimeline';
import { useSearch } from '@/app/hooks/useSearch';
import { useToast } from '@/app/hooks/useToast';
import { useWidgets } from '@/app/hooks/useWidgets';
import { Message } from './message';
import { buildReactionMap } from './message/reactions';
import { Composer } from './composer';
import { RoomHeader } from './RoomHeader';
import { RoomPreviewBar } from '../room/RoomPreviewBar';
import { getErrorMessage } from '@/util/error';
import * as css from './Timeline.css';

interface Props {
  client: MatrixClient;
  roomId: string;
}

function SkeletonRow({ width1 = '60%', width2 = '40%' }: { width1?: string; width2?: string }) {
  return (
    <div className={css.skeletonRow}>
      <div className={css.skeletonAvatar} />
      <div className={css.skeletonLines}>
        <div className={css.skeletonLine} style={{ width: width1 }} />
        <div className={css.skeletonLine} style={{ width: width2 }} />
      </div>
    </div>
  );
}

export function Timeline({ client, roomId }: Props) {
  const { t } = useTranslation();
  const layout = useAtomValue(messageLayoutAtom);
  const isModern = layout === 'modern';
  const prefs = useAtomValue(preferencesAtom);
  const toast = useToast();

  const [, setConfirm] = useAtom(confirmModalAtom);
  const [, setEditMessage] = useAtom(editMessageAtom);
  const [, setEmojiPicker] = useAtom(emojiPickerAtom);

  const { items, isPaginating, isAtStart, paginate, firstUnreadEventId, clearUnreadDivider } =
    useTimeline(client, roomId);

  const { stickerWidget } = useWidgets(client, roomId);

  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  useEffect(() => {
    setCurrentRoomId(roomId);
    return () => setCurrentRoomId(null);
  }, [roomId, setCurrentRoomId]);

  const placeCall = useAtomValue(placeCallAtom);
  const callState = useAtomValue(callStateAtom);
  const voiceState = useAtomValue(voiceStateAtom);
  const callActiveInRoom =
    callState.roomId === roomId &&
    (callState.active || callState.incoming || callState.callerId !== null);

  const handleStartCall = useCallback(
    (targetRoomId: string) => {
      if (!placeCall) return;
      if (voiceState.roomId) {
        toast.warning(t('voice.alreadyInJitsi'));
        return;
      }
      placeCall(targetRoomId);
    },
    [voiceState.roomId, placeCall, toast, t]
  );

  const room = useMemo(() => client.getRoom(roomId) ?? null, [client, roomId]);
  const receiptMap = useRoomReceipts(client, room);

  const isInvite = room?.getMyMembership() === 'invite';
  const myId = client.getUserId() ?? '';

  // DM detection for start-of-conversation banner
  const isDm = room ? isDmRoom(room, client) : false;
  const dmPartnerId = isDm
    ? (room?.getMembers().find((m) => m.userId !== myId)?.userId ?? null)
    : null;
  const dmPartnerName = dmPartnerId
    ? (room?.getMember(dmPartnerId)?.name ?? formatUserId(dmPartnerId))
    : null;
  const memberEv = isInvite ? room?.currentState.getStateEvents('m.room.member', myId) : null;
  const memberEvSingle = Array.isArray(memberEv) ? memberEv[0] : memberEv;
  const inviterUserId = memberEvSingle?.getSender() ?? null;
  const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
  const inviterDisplayName =
    inviterUser?.displayName ?? (inviterUserId ? formatUserId(inviterUserId) : null);

  const handleInviteAccepted = useCallback(() => {}, []);
  const handleInviteDeclined = useCallback(() => {
    setCurrentRoomId(null);
    window.history.pushState(null, '', '/');
  }, [setCurrentRoomId]);

  const tombstoneEvent = room?.currentState.getStateEvents('m.room.tombstone', '');
  const tombstoneEventSingle = Array.isArray(tombstoneEvent) ? tombstoneEvent[0] : tombstoneEvent;
  const tombstoneContent = tombstoneEventSingle?.getContent() as
    | { replacement_room?: string }
    | undefined;
  const tombstoneReplacementRoomId = tombstoneContent?.replacement_room ?? null;

  const navigate = useNavigate();

  const handleViewNewRoom = useCallback(() => {
    if (!tombstoneReplacementRoomId) return;
    navigate(`/r/${encodeURIComponent(tombstoneReplacementRoomId)}`);
  }, [tombstoneReplacementRoomId, navigate]);

  const {
    search,
    filteredItems,
    activeItemIndex,
    setQuery,
    goToNext,
    goToPrev,
    clear: clearSearch,
    isSearching,
  } = useSearch(items);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [replyTo, setReplyTo] = useState<MatrixEvent | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAtBottomRef = useRef(true);

  const showTopSkeletons = !isAtStart && !isSearching;

  const isAtStartRef = useRef(isAtStart);
  isAtStartRef.current = isAtStart;
  const isPaginatingRef = useRef(isPaginating);
  isPaginatingRef.current = isPaginating;

  const scrollAnchorRef = useRef<{ eventId: string; offsetTop: number } | null>(null);

  const didInitialScrollRef = useRef(false);
  useLayoutEffect(() => {
    if (isSearching || items.length === 0) return;
    if (didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items, isSearching]);

  useEffect(() => {
    didInitialScrollRef.current = false;
    scrollAnchorRef.current = null;
    itemRefs.current.clear();
  }, [roomId]);

  useLayoutEffect(() => {
    if (isSearching || scrollAnchorRef.current !== null) return;
    if (!isAtBottomRef.current || !didInitialScrollRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, isSearching]);

  useLayoutEffect(() => {
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    scrollAnchorRef.current = null;
    const el = scrollRef.current;
    if (!el) return;
    const anchorEl = itemRefs.current.get(anchor.eventId);
    if (!anchorEl) return;
    const delta = anchorEl.offsetTop - anchor.offsetTop;
    if (delta !== 0) el.scrollTop = el.scrollTop + delta;
  }, [items]);

  const paginateRef = useRef(paginate);
  paginateRef.current = paginate;
  const paginateNeededRef = useRef(false);

  function snapshotAnchor(el: HTMLDivElement) {
    const containerTop = el.getBoundingClientRect().top;
    for (const [eventId, msgEl] of itemRefs.current) {
      if (msgEl.getBoundingClientRect().bottom >= containerTop) {
        scrollAnchorRef.current = { eventId, offsetTop: msgEl.offsetTop };
        break;
      }
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    const sentinel = topSentinelRef.current;
    if (!el || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (isAtStartRef.current) return;
        if (entry.isIntersecting) {
          paginateNeededRef.current = true;
          if (!isPaginatingRef.current) {
            snapshotAnchor(el);
            paginateRef.current();
          }
        } else {
          paginateNeededRef.current = false;
        }
      },
      { root: el, rootMargin: '300px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      paginateNeededRef.current = false;
    };
  }, [roomId, showTopSkeletons]);

  useEffect(() => {
    if (isPaginating) return;
    if (!paginateNeededRef.current) return;
    if (isAtStart) {
      paginateNeededRef.current = false;
      return;
    }
    const el = scrollRef.current;
    if (el) snapshotAnchor(el);
    paginate();
  }, [isPaginating, isAtStart, paginate]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onLoad = (e: Event) => {
      if (!isAtBottomRef.current) return;
      if (
        e.target instanceof HTMLImageElement ||
        (e.type === 'loadedmetadata' && e.target instanceof HTMLVideoElement)
      ) {
        el.scrollTop = el.scrollHeight;
      }
    };
    el.addEventListener('load', onLoad, true);
    el.addEventListener('loadedmetadata', onLoad, true);
    return () => {
      el.removeEventListener('load', onLoad, true);
      el.removeEventListener('loadedmetadata', onLoad, true);
    };
  }, []);

  // Jump to active search match
  useEffect(() => {
    if (!isSearching || activeItemIndex === null) return;
    const activeItem = items[activeItemIndex];
    if (!activeItem) return;
    const eventId = activeItem.event.getId();
    if (!eventId) return;
    itemRefs.current.get(eventId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isSearching, activeItemIndex, items]);

  // Ctrl+F / Cmd+F
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('wizard:openSearch'));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Read receipts
  const lastReceiptEventIdRef = useRef<string | null>(null);
  const sendReadReceiptIfAtBottom = useCallback(() => {
    if (!document.hasFocus()) return;
    if (!client || !roomId) return;
    const currentRoom = client.getRoom(roomId);
    if (!currentRoom) return;
    const lastEvent = [...currentRoom.getLiveTimeline().getEvents()]
      .reverse()
      .find((e) =>
        ['m.room.message', 'm.sticker', 'm.room.encrypted', 'm.room.member'].includes(e.getType())
      );
    if (!lastEvent) return;
    const eventId = lastEvent.getId();
    if (!eventId || eventId === lastReceiptEventIdRef.current) return;
    lastReceiptEventIdRef.current = eventId;
    if (prefs.sendReadReceipts) {
      client.sendReadReceipt(lastEvent).catch(() => {});
      client.setRoomReadMarkers(roomId, eventId).catch(() => {});
    }
  }, [client, roomId, prefs.sendReadReceipts]);

  // Catch-up: send read receipt when tab gains focus (messages arrived while backgrounded)
  const sendReadReceiptRef = useRef(sendReadReceiptIfAtBottom);
  sendReadReceiptRef.current = sendReadReceiptIfAtBottom;
  useEffect(() => {
    const onFocus = () => {
      if (isAtBottomRef.current) sendReadReceiptRef.current();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom && !isSearching);
    if (atBottom) sendReadReceiptIfAtBottom();
  }, [isSearching, sendReadReceiptIfAtBottom]);

  useEffect(() => {
    if (items.length > 0) sendReadReceiptIfAtBottom();
  }, [items, sendReadReceiptIfAtBottom]);

  const handleJumpToEvent = useCallback((eventId: string) => {
    const el = itemRefs.current.get(eventId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(css.jumpFlash);
      setTimeout(() => el.classList.remove(css.jumpFlash), 1600);
    }
  }, []);

  const handleEdit = useCallback(
    (event: MatrixEvent) => {
      const eventId = event.getId();
      if (!eventId) return;
      setEditMessage({ roomId, eventId, body: (event.getContent()?.body as string) ?? '' });
    },
    [roomId, setEditMessage]
  );

  const handleDelete = useCallback(
    (event: MatrixEvent) => {
      const eventId = event.getId();
      if (!eventId) return;
      new Promise<boolean>((resolve) => {
        setConfirm({
          open: true,
          title: t('timeline.deleteMessage'),
          message: t('timeline.deleteMessageConfirm'),
          danger: true,
          resolve,
        });
      }).then(async (ok) => {
        if (!ok) return;
        try {
          await client.redactEvent(roomId, eventId);
        } catch (err) {
          toast.error(t('timeline.deleteFailed', { error: getErrorMessage(err) }));
        }
      });
    },
    [client, roomId, setConfirm, toast, t]
  );

  const handleReact = useCallback(
    (event: MatrixEvent, anchorEl?: HTMLElement) => {
      const eventId = event.getId();
      if (!eventId) return;
      const rect = anchorEl?.getBoundingClientRect();
      const x = rect ? rect.left : window.innerWidth / 2 - 175;
      const y = rect ? rect.bottom + 4 : window.innerHeight / 2 - 225;
      setEmojiPicker({
        x,
        y,
        onPick: async (emoji: string) => {
          try {
            const r = client.getRoom(roomId);
            const reactionMap = buildReactionMap(r, event, client.getUserId() ?? '');
            const existing = reactionMap.get(emoji);
            if (existing?.isOwn && existing.ownEventId) {
              await client.redactEvent(roomId, existing.ownEventId);
            } else {
              await client.sendEvent(roomId, EventType.Reaction, {
                'm.relates_to': {
                  rel_type: RelationType.Annotation,
                  event_id: eventId,
                  key: emoji,
                },
              });
            }
          } catch (err) {
            toast.error(t('timeline.reactFailedShort', { error: getErrorMessage(err) }));
          }
        },
      });
    },
    [client, roomId, setEmojiPicker, toast, t]
  );

  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (++dragDepthRef.current === 1) setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (--dragDepthRef.current === 0) setIsDragging(false);
  }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setDroppedFile(file);
  }, []);
  const clearDroppedFile = useCallback(() => setDroppedFile(null), []);

  const displayItems = isSearching ? filteredItems : items;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={css.chatDropZone}>
          <UploadIcon size={32} />
          <span>{t('timeline.dropToAttach')}</span>
        </div>
      )}

      {isInvite && (
        <RoomPreviewBar
          client={client}
          roomId={roomId}
          roomName={room?.name ?? roomId}
          roomAvatarMxc={room?.getMxcAvatarUrl?.() ?? null}
          inviterUserId={inviterUserId}
          inviterDisplayName={inviterDisplayName}
          onAccepted={handleInviteAccepted}
          onDeclined={handleInviteDeclined}
        />
      )}

      {tombstoneReplacementRoomId && !isInvite && (
        <div className={css.tombstoneBanner}>
          <span className={css.tombstoneBannerText}>{t('timeline.roomUpgraded')}</span>
          <button className={css.tombstoneBannerBtn} onClick={handleViewNewRoom}>
            {t('timeline.viewNewRoom')}
          </button>
        </div>
      )}

      <RoomHeader
        client={client}
        roomId={roomId}
        searchQuery={search.query}
        searchMatchCount={search.matchIndices.length}
        searchActiveMatch={search.activeMatch}
        isSearching={isSearching}
        onSearchChange={setQuery}
        onSearchNext={goToNext}
        onSearchPrev={goToPrev}
        onSearchClose={clearSearch}
        onJumpToEvent={handleJumpToEvent}
        onStartCall={handleStartCall}
        callActive={callActiveInRoom}
      />

      {isSearching && (
        <div className={css.searchBanner}>
          {displayItems.length !== 1
            ? t('room.header.searchBanner_plural', {
                count: displayItems.length,
                query: search.query,
              })
            : t('room.header.searchBanner', { count: displayItems.length, query: search.query })}
        </div>
      )}

      <div ref={scrollRef} className={css.timelineContainer} onScroll={handleScroll}>
        {isAtStart && !isSearching && (
          <div className={css.timelineStart}>
            <div className={css.timelineStartIcon}>
              <ChatTeardropTextIcon size={22} weight="duotone" />
            </div>
            <span className={css.timelineStartTitle}>
              {isDm && dmPartnerName
                ? t('timeline.startOfDm', { name: dmPartnerName })
                : t('timeline.startOfConversation')}
            </span>
          </div>
        )}

        {showTopSkeletons && (
          <>
            <SkeletonRow width1="55%" width2="35%" />
            <SkeletonRow width1="70%" width2="50%" />
            <div ref={topSentinelRef}>
              <SkeletonRow width1="45%" width2="60%" />
            </div>
          </>
        )}

        {displayItems.map((item) => {
          const eventId = item.event.getId() ?? '';
          const isActiveMatch =
            isSearching &&
            activeItemIndex !== null &&
            items[activeItemIndex]?.event.getId() === eventId;
          const showUnreadDivider =
            !isSearching && firstUnreadEventId && eventId === firstUnreadEventId;

          return (
            <div
              key={eventId}
              ref={(el) => {
                if (el) itemRefs.current.set(eventId, el);
                else itemRefs.current.delete(eventId);
              }}
              data-event-id={eventId}
              className={isActiveMatch ? css.searchMatchActive : undefined}
            >
              <div
                className={css.dateSeparator}
                style={{ display: item.showDateSep || isSearching ? undefined : 'none' }}
              >
                {item.dateSepLabel}
              </div>
              {showUnreadDivider && (
                <div className={css.unreadDivider} onAnimationEnd={clearUnreadDivider}>
                  {t('timeline.unreadMessages')}
                </div>
              )}
              <Message
                event={item.event}
                isOwn={item.isOwn}
                senderId={item.senderId}
                senderName={item.senderName}
                senderAvatar={item.senderAvatar}
                isGrouped={isSearching ? false : item.isGrouped}
                isModern={isModern}
                isSystemMessage={item.isSystemMessage}
                client={client}
                searchQuery={isSearching ? search.query : ''}
                receiptUsers={receiptMap.get(eventId) ?? []}
                onReply={setReplyTo}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReact={handleReact}
              />
            </div>
          );
        })}

        {displayItems.length === 0 && isSearching && (
          <div className={css.searchEmpty}>
            {t('room.header.searchEmpty', { query: search.query })}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button
          className={css.scrollToBottomBtn}
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          <CaretDownIcon size={18} />
        </button>
      )}

      {!isSearching && !isInvite && (
        <Composer
          client={client}
          roomId={roomId}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          stickerWidget={stickerWidget}
          droppedFile={droppedFile}
          onDroppedFileConsumed={clearDroppedFile}
        />
      )}
    </div>
  );
}
