import { useRef, useEffect, useState, useCallback } from 'react';
import { EventType, RelationType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { CaretDownIcon, UploadIcon, ChatCircleIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { formatUserId } from '@/util/matrix';
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
import { useCall } from '@/app/hooks/useCall';
import { useRoomReceipts } from '@/app/hooks/useRoomReceipts';
import { useTimeline } from '@/app/hooks/useTimeline';
import { useSearch } from '@/app/hooks/useSearch';
import { useToast } from '@/app/hooks/useToast';
import { useWidgets } from '@/app/hooks/useWidgets';
import { Message } from './message';
import { Composer } from './composer';
import { RoomHeader } from './RoomHeader';
import { RoomPreviewBar } from '../room/RoomPreviewBar';
import { getErrorMessage } from '@/util/error';
import * as css from './Timeline.css';

interface Props {
  client: MatrixClient;
  roomId: string;
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

  const { items, loading, canPaginate, paginate, firstUnreadEventId, clearUnreadDivider } =
    useTimeline(client, roomId);
  const { stickerWidget } = useWidgets(client, roomId);

  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);

  // Sync the URL-derived roomId into the atom so other components (e.g. MembersList)
  // have access to it even on a hard page reload (where selectRoom is never called).
  useEffect(() => {
    setCurrentRoomId(roomId);
    return () => setCurrentRoomId(null);
  }, [roomId, setCurrentRoomId]);

  // 1:1 call — read state from atom so the call button reflects live status
  const { placeCall } = useCall(client);
  const callState = useAtomValue(callStateAtom);
  const voiceState = useAtomValue(voiceStateAtom);
  const callActiveInRoom = callState.roomId === roomId && (callState.active || callState.incoming);

  // Block starting a VoIP call if the user is already in a Jitsi voice channel
  const handleStartCall = useCallback(
    (targetRoomId: string) => {
      if (voiceState.roomId) {
        toast.warning(t('voice.alreadyInJitsi'));
        return;
      }
      placeCall(targetRoomId);
    },
    [voiceState.roomId, placeCall, toast, t]
  );

  // Read receipts — compute once per room, updated live via Room.receipt events
  const room = client.getRoom(roomId) ?? null;
  const receiptMap = useRoomReceipts(client, prefs.sendReadReceipts ? room : null);

  const isInvite = room?.getMyMembership() === 'invite';

  // Derive inviter from the m.room.member state event for our own userId
  const myId = client.getUserId() ?? '';
  const memberEv = isInvite ? room?.currentState.getStateEvents('m.room.member', myId) : null;
  const memberEvSingle = Array.isArray(memberEv) ? memberEv[0] : memberEv;
  const inviterUserId = memberEvSingle?.getSender() ?? null;
  const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
  const inviterDisplayName =
    inviterUser?.displayName ?? (inviterUserId ? formatUserId(inviterUserId) : null);

  const handleInviteAccepted = useCallback(() => {
    // Room membership will update via sync — nothing extra needed,
    // Timeline will re-render with isInvite=false and show normal chat.
  }, []);

  const handleInviteDeclined = useCallback(() => {
    // Navigate back to home after declining
    setCurrentRoomId(null);
    window.history.pushState(null, '', '/');
  }, [setCurrentRoomId]);

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

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [replyTo, setReplyTo] = useState<MatrixEvent | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const isAtBottomRef = useRef(true);
  const prevItemCountRef = useRef(0);

  // Scroll to bottom on new messages (if already at bottom and not searching)
  useEffect(() => {
    if (!isSearching && isAtBottomRef.current && items.length !== prevItemCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevItemCountRef.current = items.length;
  }, [items, isSearching]);

  // Jump to active search match
  useEffect(() => {
    if (!isSearching || activeItemIndex === null) return;
    const activeItem = items[activeItemIndex];
    if (!activeItem) return;
    const eventId = activeItem.event.getId();
    if (!eventId) return;
    const el = itemRefs.current.get(eventId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [isSearching, activeItemIndex, items]);

  // Ctrl+F / Cmd+F → open search
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

  // Track whether we've already sent a receipt for the current bottom event
  const lastReceiptEventIdRef = useRef<string | null>(null);

  const sendReadReceiptIfAtBottom = useCallback(() => {
    if (!client || !roomId) return;
    const currentRoom = client.getRoom(roomId);
    if (!currentRoom) return;
    const events = currentRoom.getLiveTimeline().getEvents();
    // Find the last visible event (ignore local echos / state events)
    const lastEvent = [...events]
      .reverse()
      .find((e) =>
        ['m.room.message', 'm.sticker', 'm.room.encrypted', 'm.room.member'].includes(e.getType())
      );
    if (!lastEvent) return;
    const eventId = lastEvent.getId();
    if (!eventId || eventId === lastReceiptEventIdRef.current) return;
    lastReceiptEventIdRef.current = eventId;

    if (prefs.sendReadReceipts) {
      client.sendReadReceipt(lastEvent).catch(() => {
        /* best-effort */
      });
      // Set the fully-read marker
      client.setRoomReadMarkers(roomId, eventId).catch(() => {
        /* best-effort */
      });
    }
  }, [client, roomId, prefs.sendReadReceipts]);

  // Detect scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom && !isSearching);

    if (atBottom) {
      sendReadReceiptIfAtBottom();
    }

    if (el.scrollTop < 100 && canPaginate && !loading) {
      const prevHeight = el.scrollHeight;
      paginate().then(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevHeight;
        }
      });
    }
  }, [canPaginate, loading, paginate, isSearching, sendReadReceiptIfAtBottom]);

  // Send receipt as soon as the room is active and messages are loaded —
  // regardless of scroll position so the badge clears immediately.
  useEffect(() => {
    if (!loading && items.length > 0) {
      sendReadReceiptIfAtBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, loading]);

  // Also clear badge when new messages arrive while the room is already open.
  useEffect(() => {
    if (items.length > 0) {
      sendReadReceiptIfAtBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Auto-clear the unread divider after 5 seconds.
  useEffect(() => {
    if (!firstUnreadEventId) return;
    const timer = setTimeout(clearUnreadDivider, 5000);
    return () => clearTimeout(timer);
  }, [roomId, firstUnreadEventId, clearUnreadDivider]);

  // Jump to a specific event (pinned messages panel)
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
      setEditMessage({
        roomId,
        eventId,
        body: (event.getContent()?.body as string) ?? '',
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
            await client.sendEvent(roomId, EventType.Reaction, {
              'm.relates_to': {
                rel_type: RelationType.Annotation,
                event_id: eventId,
                key: emoji,
              },
            });
          } catch (err) {
            toast.error(t('timeline.reactFailedShort', { error: getErrorMessage(err) }));
          }
        },
      });
    },
    [client, roomId, setEmojiPicker, toast, t]
  );

  const displayItems = isSearching ? filteredItems : items;

  const [isDragging, setIsDragging] = useState(false);
  // Track nesting depth so leaving a child element doesn't hide the overlay
  const dragDepthRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); // required to allow dropping
  }, []);

  // onDropFile is forwarded to Composer so it can open the preview modal
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setDroppedFile(file);
  }, []);

  // Reset droppedFile after Composer has consumed it
  const clearDroppedFile = useCallback(() => setDroppedFile(null), []);

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
      {/* Full-chat drop zone overlay */}
      {isDragging && (
        <div className={css.chatDropZone}>
          <UploadIcon size={32} />
          <span>{t('timeline.dropToAttach')}</span>
        </div>
      )}

      {/* Invite preview bar — shown instead of normal chat input when membership='invite' */}
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

      {/* Room header */}
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

      {/* Search mode banner */}
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

      {/* Timeline scroll area */}
      <div ref={scrollRef} className={css.timelineContainer} onScroll={handleScroll}>
        {loading && (
          <div className={css.loadingSpinnerWrap}>
            <div className={css.spinner} />
          </div>
        )}

        {displayItems.map((item) => {
          const eventId = item.event.getId() ?? '';
          const isActiveMatch =
            isSearching &&
            activeItemIndex !== null &&
            items[activeItemIndex]?.event.getId() === eventId;
          // Show the unread divider just above the first unread event (not in search mode)
          const showUnreadDivider =
            !isSearching && firstUnreadEventId && eventId === firstUnreadEventId;

          return (
            <div
              key={eventId}
              ref={(el) => {
                if (el) itemRefs.current.set(eventId, el);
                else itemRefs.current.delete(eventId);
              }}
              className={isActiveMatch ? css.searchMatchActive : undefined}
            >
              <div
                className={css.dateSeparator}
                style={{ display: item.showDateSep || isSearching ? undefined : 'none' }}
              >
                {item.dateSepLabel}
              </div>
              {showUnreadDivider && (
                <div className={css.unreadDivider}>{t('timeline.unreadMessages')}</div>
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

        {items.length === 0 && !loading && !isSearching && (
          <div className={css.emptyRoom}>
            <ChatCircleIcon size={32} strokeWidth={1.5} />
            <span>{t('timeline.noMessages')}</span>
          </div>
        )}

        {displayItems.length === 0 && isSearching && (
          <div className={css.searchEmpty}>
            {t('room.header.searchEmpty', { query: search.query })}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button
          className={css.scrollToBottomBtn}
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })}
        >
          <CaretDownIcon size={18} />
        </button>
      )}

      {/* Composer — hidden during search or when membership='invite' */}
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
