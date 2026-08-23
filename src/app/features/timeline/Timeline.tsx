import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { CaretDownIcon, UploadIcon, ChatTeardropTextIcon, XIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { formatUserId, isDmRoom, roomStateMaybe } from '@/util/matrix';
import {
  messageLayoutAtom,
  preferencesAtom,
  confirmModalAtom,
  editMessageAtom,
  emojiPickerAtom,
  currentRoomIdAtom,
  timelineScrollAtom,
  threadsPanelViewAtom,
  optimisticRedactedIdsAtom,
  optimisticEditBodiesAtom,
  elementCallUiAtom,
  isInElementCallAtom,
  type RoomScrollState,
} from '@/app/store/atoms';
import { useRoomReceipts } from '@/app/hooks/useRoomReceipts';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import { useTimeline, indexOfEvent, itemContainsEvent } from '@/app/hooks/useTimeline';
import { useSearch } from '@/app/hooks/useSearch';
import { useToast } from '@/app/hooks/useToast';
import { useWidgets } from '@/app/hooks/useWidgets';
import { useStartElementCall } from '@/app/plugins/call/useCallEmbed';
import { findLastReceiptableEvent, receiptTypeFor } from '@/app/pages/client/markAsRead';
import { Message } from './message';
import { toggleReaction } from './message/reactions';
import { Composer } from './composer';
import { RoomHeader } from './RoomHeader';
import { RoomInvitePreview } from '../room/RoomInvitePreview';
import { getErrorMessage } from '@/util/error';
import * as css from './Timeline.css';

interface Props {
  client: MatrixClient;
  roomId: string;
}

const EMPTY_RECEIPTS: ReceiptUser[] = [];
const INITIAL_FIRST_INDEX = 100_000;

function UnreadDivider({ onDismiss, label }: { onDismiss: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const hasBeenVisibleRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          hasBeenVisibleRef.current = true;
        } else if (hasBeenVisibleRef.current && entry.boundingClientRect.bottom < 0) {
          // Divider has scrolled above the viewport — dismiss
          onDismiss();
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onDismiss]);

  return (
    <div ref={ref} className={css.unreadDivider}>
      <div className={css.unreadDividerLines} />
      <span className={css.unreadDividerLabel}>{label}</span>
      <div className={css.unreadDividerRight}>
        <div className={css.unreadDividerLines} />
        <button
          type="button"
          className={css.unreadDividerDismiss}
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <XIcon size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
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
  const prefs = useAtomValue(preferencesAtom);
  const toast = useToast();

  const [, setConfirm] = useAtom(confirmModalAtom);
  const [, setEditMessage] = useAtom(editMessageAtom);
  const [, setEmojiPicker] = useAtom(emojiPickerAtom);
  const setThreadsPanelView = useSetAtom(threadsPanelViewAtom);

  const [optimisticRedactedIds, setOptimisticRedactedIds] = useAtom(optimisticRedactedIdsAtom);
  const optimisticEditBodies = useAtomValue(optimisticEditBodiesAtom);

  const {
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
  } = useTimeline(client, roomId, {
    onScrollbackError: (retry) => {
      toast.error(t('timeline.loadFailed'), {
        actionLabel: t('timeline.retry'),
        onClick: retry,
      });
    },
    optimisticRedactedIds,
    optimisticEditBodies,
  });

  const { stickerWidget } = useWidgets(client, roomId);

  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  useEffect(() => {
    setCurrentRoomId(roomId);
    return () => setCurrentRoomId(null);
  }, [roomId, setCurrentRoomId]);

  const startElementCall = useStartElementCall();
  const callUi = useAtomValue(elementCallUiAtom);
  const isInElementCall = useAtomValue(isInElementCallAtom);
  const callActiveInRoom = callUi.roomId === roomId && isInElementCall && !callUi.popOut;

  const handleStartCall = useCallback(
    async (targetRoomId: string) => {
      const room = client.getRoom(targetRoomId);
      if (!room) return;
      if (isInElementCall && callUi.roomId === targetRoomId) {
        return;
      }
      await startElementCall(room, { voiceOnly: true });
    },
    [client, isInElementCall, callUi.roomId, startElementCall]
  );

  const room = useMemo(() => client.getRoom(roomId) ?? null, [client, roomId]);
  const receiptMap = useRoomReceipts(client, room);

  const isInvite = room?.getMyMembership() === 'invite';
  const myId = client.getUserId() ?? '';

  const isDm = room ? isDmRoom(room, client) : false;
  const dmPartnerId = isDm
    ? (room?.getMembers().find((m) => m.userId !== myId)?.userId ?? null)
    : null;
  const dmPartnerName = dmPartnerId
    ? (room?.getMember(dmPartnerId)?.name ?? formatUserId(dmPartnerId))
    : null;
  const memberEv = isInvite ? roomStateMaybe(room)?.getStateEvents('m.room.member', myId) : null;
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

  const tombstoneEvent = roomStateMaybe(room)?.getStateEvents('m.room.tombstone', '');
  const tombstoneEventSingle = Array.isArray(tombstoneEvent) ? tombstoneEvent[0] : tombstoneEvent;
  const tombstoneContent = tombstoneEventSingle?.getContent() as
    | { replacement_room?: string }
    | undefined;
  const tombstoneReplacementRoomId = tombstoneContent?.replacement_room ?? null;

  const createEvent = roomStateMaybe(room)?.getStateEvents('m.room.create', '');
  const createEventSingle = Array.isArray(createEvent) ? createEvent[0] : createEvent;
  const createContent = createEventSingle?.getContent() as
    | { predecessor?: { room_id?: string } }
    | undefined;
  const predecessorRoomId = createContent?.predecessor?.room_id ?? null;

  const navigate = useNavigate();

  const [joiningReplacement, setJoiningReplacement] = useState(false);
  const replacedRoom = tombstoneReplacementRoomId
    ? client.getRoom(tombstoneReplacementRoomId)
    : null;
  const isInReplacement = replacedRoom?.getMyMembership() === 'join';

  const handleJoinReplacement = useCallback(async () => {
    if (!tombstoneReplacementRoomId) return;
    setJoiningReplacement(true);
    try {
      const serverDomain = tombstoneEventSingle?.getSender()?.split(':').slice(1).join(':') ?? '';
      await client.joinRoom(tombstoneReplacementRoomId, { viaServers: [serverDomain] });
      navigate(`/r/${encodeURIComponent(tombstoneReplacementRoomId)}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setJoiningReplacement(false);
    }
  }, [tombstoneReplacementRoomId, client, navigate, toast]);

  const handleOpenReplacement = useCallback(() => {
    if (!tombstoneReplacementRoomId) return;
    navigate(`/r/${encodeURIComponent(tombstoneReplacementRoomId)}`);
  }, [tombstoneReplacementRoomId, navigate]);

  const handleOpenPredecessor = useCallback(() => {
    if (!predecessorRoomId) return;
    navigate(`/r/${encodeURIComponent(predecessorRoomId)}`);
  }, [predecessorRoomId, navigate]);

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

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [firstItemIndex, setFirstItemIndex] = useState(INITIAL_FIRST_INDEX);
  const prevPrependCountRef = useRef(0);
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const delta = prependCount - prevPrependCountRef.current;
    prevPrependCountRef.current = prependCount;
    if (delta > 0) setFirstItemIndex((i) => i - delta);
  }, [prependCount]);

  useEffect(() => {
    prevPrependCountRef.current = 0;
    setFirstItemIndex(INITIAL_FIRST_INDEX);
  }, [timelineResetEpoch]);

  const mountTsRef = useRef(Date.now());
  useEffect(() => {
    mountTsRef.current = Date.now();
    prevPrependCountRef.current = 0;
    setFirstItemIndex(INITIAL_FIRST_INDEX);
  }, [roomId]);

  const [scrollMap, setScrollMap] = useAtom(timelineScrollAtom);
  const savedStateRef = useRef<RoomScrollState | undefined>(scrollMap.get(roomId));
  const isMidScrollRestore =
    savedStateRef.current !== undefined &&
    !savedStateRef.current.atBottom &&
    (savedStateRef.current.scrollTop ?? 0) > 0;

  const [suppressFollowOutput, setSuppressFollowOutput] = useState(isMidScrollRestore);

  const initialScrollDoneRef = useRef(false);
  useEffect(() => {
    if (initialScrollDoneRef.current) return;
    if (isMidScrollRestore) {
      initialScrollDoneRef.current = true;
      return;
    }
    if (items.length === 0) return;
    initialScrollDoneRef.current = true;

    if (firstUnreadEventId) {
      const index = indexOfEvent(items, firstUnreadEventId);
      if (index >= 0) {
        virtuosoRef.current?.scrollToIndex({
          index,
          align: 'start',
          behavior: 'auto',
          offset: -48,
        });
        return;
      }
    }

    virtuosoRef.current?.scrollToIndex({ index: items.length - 1, align: 'end', behavior: 'auto' });
  }, [items.length, firstUnreadEventId, isMidScrollRestore]);

  const currentScrollTopRef = useRef(0);
  const setScrollMapRef = useRef(setScrollMap);
  setScrollMapRef.current = setScrollMap;

  useEffect(() => {
    const id = roomId;
    return () => {
      const state: RoomScrollState = isAtBottomRef.current
        ? { atBottom: true }
        : { atBottom: false, scrollTop: currentScrollTopRef.current };
      setScrollMapRef.current((prev) => new Map(prev).set(id, state));
    };
  }, [roomId]);

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const lastReceiptEventIdRef = useRef<string | null>(null);
  const sendReadReceiptIfAtBottom = useCallback(() => {
    if (!document.hasFocus()) return;
    if (!client || !roomId) return;
    const currentRoom = client.getRoom(roomId);
    if (!currentRoom) return;
    const lastEvent = findLastReceiptableEvent(currentRoom);
    if (!lastEvent) return;
    const eventId = lastEvent.getId();
    if (!eventId || eventId === lastReceiptEventIdRef.current) return;
    lastReceiptEventIdRef.current = eventId;
    client.sendReadReceipt(lastEvent, receiptTypeFor(prefs)).catch(() => {});
    client.setRoomReadMarkers(roomId, eventId).catch(() => {});
  }, [client, roomId, prefs.sendReadReceipts]);

  useEffect(() => {
    if (items.length > 0 && isAtBottomRef.current) sendReadReceiptIfAtBottom();
  }, [items, sendReadReceiptIfAtBottom]);

  const prevDisplayLengthRef = useRef(0);
  useEffect(() => {
    prevDisplayLengthRef.current = items.length;
  }, [items.length, suppressFollowOutput]);

  const sendReadReceiptRef = useRef(sendReadReceiptIfAtBottom);
  sendReadReceiptRef.current = sendReadReceiptIfAtBottom;
  useEffect(() => {
    const onFocus = () => {
      if (isAtBottomRef.current) sendReadReceiptRef.current();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const [flashEventId, setFlashEventId] = useState<string | null>(null);
  const pendingJumpRef = useRef<string | null>(null);

  // When items update after a cross-window jump, scroll to the pending target.
  useEffect(() => {
    const target = pendingJumpRef.current;
    if (!target) return;
    const index = indexOfEvent(items, target);
    if (index === -1) return;
    pendingJumpRef.current = null;
    virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'auto' });
    setFlashEventId(target);
    setTimeout(() => setFlashEventId(null), 1600);
  }, [items]);

  const handleJumpToEvent = useCallback(
    async (eventId: string) => {
      const index = indexOfEvent(items, eventId);
      if (index !== -1) {
        virtuosoRef.current?.scrollToIndex({ index, align: 'center', behavior: 'smooth' });
        setFlashEventId(eventId);
        setTimeout(() => setFlashEventId(null), 1600);
        return;
      }
      pendingJumpRef.current = eventId;
      const loaded = await jumpToEvent(eventId);
      if (!loaded) {
        pendingJumpRef.current = null;
      }
    },
    [items, jumpToEvent]
  );

  useEffect(() => {
    if (!isSearching || activeItemIndex === null) return;
    virtuosoRef.current?.scrollToIndex({
      index: activeItemIndex,
      align: 'center',
      behavior: 'smooth',
    });
  }, [isSearching, activeItemIndex]);

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

  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  const [replyTo, setReplyTo] = useState<MatrixEvent | null>(null);

  const handleEdit = useCallback(
    (event: MatrixEvent) => {
      const eventId = event.getId();
      if (!eventId) return;
      setEditMessage({
        roomId,
        eventId,
        body: (event.getContent()?.body as string) ?? '',
        msgtype: (event.getContent()?.msgtype as string) ?? 'm.text',
      });
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
      }).then((ok) => {
        if (!ok) return;
        setOptimisticRedactedIds((prev) => new Set([...prev, eventId]));

        const clearOptimisticRedacted = () => {
          setOptimisticRedactedIds((prev) => {
            if (!prev.has(eventId)) return prev;
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
        };

        client.redactEvent(roomId, eventId).then(
          () => {
            // Keep the event hidden until the redaction is reflected locally,
            // then drop the optimistic entry so the set doesn't grow unbounded.
            const room = client.getRoom(roomId);
            const deadline = Date.now() + 3000;
            const poll = () => {
              const redacted = event.isRedacted() || !!room?.findEventById(eventId)?.isRedacted();
              if (redacted || Date.now() >= deadline) {
                clearOptimisticRedacted();
              } else {
                setTimeout(poll, 200);
              }
            };
            poll();
          },
          (err) => {
            clearOptimisticRedacted();
            toast.error(t('timeline.deleteFailed', { error: getErrorMessage(err) }));
          }
        );
      });
    },
    [client, roomId, setConfirm, setOptimisticRedactedIds, toast, t]
  );

  const handleResend = useCallback(
    (event: MatrixEvent) => {
      const r = client.getRoom(roomId);
      if (!r) return;
      client.resendEvent(event, r).catch((err) => {
        console.error('[Timeline] resendEvent failed', err);
        toast.error(t('timeline.sendFailed', { error: getErrorMessage(err) }));
      });
    },
    [client, roomId, toast, t]
  );

  const handleCancel = useCallback(
    (event: MatrixEvent) => {
      try {
        client.cancelPendingEvent(event);
      } catch (err) {
        console.error('[Timeline] cancelPendingEvent failed', err);
      }
    },
    [client]
  );

  const handleThreadClick = useCallback(
    (event: MatrixEvent) => {
      setThreadsPanelView({ type: 'thread', rootEvent: event });
    },
    [setThreadsPanelView]
  );

  const handleReact = useCallback(
    (event: MatrixEvent, anchorEl?: HTMLElement) => {
      if (!event.getId()) return;
      const rect = anchorEl?.getBoundingClientRect();
      const x = rect ? rect.left : window.innerWidth / 2 - 175;
      const y = rect ? rect.bottom + 4 : window.innerHeight / 2 - 225;
      setEmojiPicker({
        x,
        y,
        client,
        roomId,
        onPick: async (emoji: string, mxcUrl?: string) => {
          try {
            const reactionKey = mxcUrl ?? emoji;
            await toggleReaction(
              client,
              roomId,
              event,
              client.getUserId() ?? '',
              reactionKey,
              null
            );
          } catch (err) {
            toast.error(t('timeline.reactFailedShort', { error: getErrorMessage(err) }));
          }
        },
      });
    },
    [client, roomId, setEmojiPicker, toast, t]
  );

  const displayItems = isSearching ? filteredItems : items;

  const itemRenderer = useCallback(
    (index: number) => {
      const arrayIndex = index - (isSearching ? 0 : firstItemIndex);
      const item = displayItems[arrayIndex];
      if (!item) return null;

      const eventId = item.event.getId() ?? '';
      const isActiveMatch =
        isSearching &&
        activeItemIndex !== null &&
        items[activeItemIndex]?.event.getId() === eventId;
      const showUnreadDivider =
        !isSearching && firstUnreadEventId && itemContainsEvent(item, firstUnreadEventId);
      // Compare local arrival time so server clock skew can't misclassify the
      // entrance animation; falls back to origin_server_ts for no-age events.
      const isLive = (item.event.localTimestamp ?? item.event.getTs()) > mountTsRef.current;
      const isFlashing = flashEventId === eventId;

      let receiptUsers = receiptMap.get(eventId) ?? EMPTY_RECEIPTS;
      if (item.galleryEvents) {
        for (const galleryEvent of item.galleryEvents) {
          const galleryEventId = galleryEvent.getId();
          if (!galleryEventId) continue;
          const galleryReceipts = receiptMap.get(galleryEventId);
          if (galleryReceipts && galleryReceipts !== receiptUsers) {
            receiptUsers = [...receiptUsers, ...galleryReceipts];
          }
        }
      }

      const itemClass = isActiveMatch
        ? css.searchMatchActive
        : isFlashing
          ? css.jumpFlash
          : isLive
            ? css.msgLive
            : undefined;

      return (
        <div key={eventId} data-event-id={eventId} className={itemClass}>
          <div
            className={css.dateSeparator}
            style={{ display: item.showDateSep || isSearching ? undefined : 'none' }}
          >
            {item.dateSepLabel}
          </div>
          {showUnreadDivider && (
            <UnreadDivider onDismiss={clearUnreadDivider} label={t('timeline.unreadMessages')} />
          )}
          <Message
            event={item.event}
            isOwn={item.isOwn}
            senderId={item.senderId}
            senderName={item.senderName}
            senderAvatar={item.senderAvatar}
            isGrouped={isSearching ? false : item.isGrouped}
            variant={layout}
            isSystemMessage={item.isSystemMessage}
            isEdited={item.isEdited}
            isRedacted={item.isRedacted}
            isPinned={item.isPinned}
            canEdit={item.canEdit}
            canRedact={item.canRedact}
            canPin={item.canPin}
            isDecrypting={item.isDecrypting}
            isUndecryptable={item.isUndecryptable}
            isSending={item.isSending}
            isFailed={item.isFailed}
            sendError={item.sendError}
            optimisticBody={item.optimisticBody}
            galleryEvents={item.galleryEvents}
            client={client}
            searchQuery={isSearching ? search.query : ''}
            receiptUsers={receiptUsers}
            reactionVersion={item.reactionVersion}
            hoveredEventId={hoveredEventId}
            onHover={setHoveredEventId}
            onReply={setReplyTo}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onReact={handleReact}
            onThreadClick={handleThreadClick}
            onJumpToEvent={handleJumpToEvent}
            onResend={handleResend}
            onCancel={handleCancel}
          />
        </div>
      );
    },
    [
      displayItems,
      firstItemIndex,
      isSearching,
      activeItemIndex,
      items,
      firstUnreadEventId,
      flashEventId,
      clearUnreadDivider,
      layout,
      client,
      search.query,
      receiptMap,
      hoveredEventId,
      setHoveredEventId,
      setReplyTo,
      handleEdit,
      handleDelete,
      handleReact,
      handleThreadClick,
      handleResend,
      handleCancel,
      t,
    ]
  );

  const showTopSkeletons = !isAtStart && !isSearching;

  const VirtuosoHeader = useCallback(() => {
    if (!showTopSkeletons && !isAtStart) return null;
    return (
      <>
        {isAtStart && !isSearching && (
          <>
            {predecessorRoomId && (
              <div className={css.predecessorNotice}>
                <span>{t('timeline.roomUpgradedFrom')}</span>
                <button
                  type="button"
                  className={css.predecessorNoticeBtn}
                  onClick={handleOpenPredecessor}
                >
                  {t('timeline.viewOldRoom')}
                </button>
              </div>
            )}
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
          </>
        )}
        {showTopSkeletons && (
          <>
            <SkeletonRow width1="55%" width2="35%" />
            <SkeletonRow width1="70%" width2="50%" />
            <SkeletonRow width1="45%" width2="60%" />
          </>
        )}
      </>
    );
  }, [
    showTopSkeletons,
    isAtStart,
    isSearching,
    isDm,
    dmPartnerName,
    t,
    predecessorRoomId,
    handleOpenPredecessor,
  ]);

  if (isInvite) {
    const topicEv = roomStateMaybe(room)?.getStateEvents('m.room.topic', '');
    const topicEvSingle = Array.isArray(topicEv) ? topicEv[0] : topicEv;
    const topic =
      (topicEvSingle?.getContent() as { topic?: string } | undefined)?.topic?.trim() ?? '';
    const memberCount = room?.getJoinedMemberCount?.() ?? 0;

    return (
      <RoomInvitePreview
        client={client}
        roomId={roomId}
        roomName={room?.name ?? roomId}
        roomAvatarMxc={room?.getMxcAvatarUrl?.() ?? null}
        topic={topic}
        memberCount={memberCount}
        inviterUserId={inviterUserId}
        inviterDisplayName={inviterDisplayName}
        onAccepted={handleInviteAccepted}
        onDeclined={handleInviteDeclined}
      />
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
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

        {tombstoneReplacementRoomId && (
          <div className={css.tombstoneBanner}>
            <span className={css.tombstoneBannerText}>{t('timeline.roomUpgraded')}</span>
            {isInReplacement ? (
              <button
                type="button"
                className={css.tombstoneBannerBtn}
                onClick={handleOpenReplacement}
              >
                {t('timeline.viewNewRoom')}
              </button>
            ) : (
              <button
                type="button"
                className={css.tombstoneBannerBtn}
                onClick={handleJoinReplacement}
                disabled={joiningReplacement}
              >
                {joiningReplacement ? t('explore.joining') : t('explore.join')}
              </button>
            )}
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

        {isSearching && displayItems.length > 0 && (
          <div className={css.searchBanner} role="status">
            {displayItems.length !== 1
              ? t('room.header.searchBanner_plural', {
                  count: displayItems.length,
                  query: search.query,
                })
              : t('room.header.searchBanner', { count: displayItems.length, query: search.query })}
          </div>
        )}

        <Virtuoso
          ref={virtuosoRef}
          className={css.timelineContainer}
          firstItemIndex={isSearching ? 0 : firstItemIndex}
          initialScrollTop={isMidScrollRestore ? savedStateRef.current?.scrollTop : undefined}
          data={displayItems}
          itemContent={itemRenderer}
          overscan={300}
          followOutput={isSearching || suppressFollowOutput || !isAtEnd ? false : 'auto'}
          startReached={() => {
            if (!isAtStart && !isPaginating) paginate();
          }}
          endReached={() => {
            if (!isAtEnd && !isPaginating) paginateForward();
          }}
          atBottomStateChange={(atBottom) => {
            isAtBottomRef.current = atBottom;
            setShowScrollBtn(!atBottom && !isSearching);
            if (atBottom) {
              if (suppressFollowOutput) setSuppressFollowOutput(false);
              sendReadReceiptIfAtBottom();
            }
          }}
          onScroll={(e) => {
            currentScrollTopRef.current = (e.target as HTMLElement).scrollTop;
          }}
          components={{ Header: VirtuosoHeader }}
        />

        {displayItems.length === 0 && isSearching && (
          <div className={css.searchEmpty}>
            {t('room.header.searchEmpty', { query: search.query })}
          </div>
        )}

        {showScrollBtn && (
          <button
            type="button"
            className={css.scrollToBottomBtn}
            onClick={() => {
              virtuosoRef.current?.scrollToIndex({
                index: displayItems.length - 1,
                behavior: 'smooth',
              });
            }}
          >
            <CaretDownIcon size={18} />
          </button>
        )}

        {!isSearching && (
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
    </div>
  );
}
