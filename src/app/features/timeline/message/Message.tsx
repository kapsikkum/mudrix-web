import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  M_POLL_START,
  M_POLL_END,
  M_POLL_KIND_DISCLOSED,
  EventType,
  MatrixEventEvent,
  RoomEvent,
} from 'matrix-js-sdk';
import { SmileyIcon, WarningIcon, ChatDotsIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { Avatar } from '@/app/components/Avatar';
import { MediaLightbox } from '@/app/components/MediaLightbox/MediaLightbox';
import { MessageActionToolbar } from './MessageActionToolbar';
import { ViewSourceModal } from './ViewSourceModal';
import { formatTime } from '@/util/format';
import { formatUserId } from '@/util/matrix';
import { useContextMenu, isMenuOpenKey, syntheticMouseEvent } from '@/app/hooks/useContextMenu';
import { useToast } from '@/app/hooks/useToast';
import { useConfirm } from '@/app/hooks/useConfirm';
import { getErrorMessage } from '@/util/error';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import { CallEventDisplay } from './callEvents';
import { SystemMessageDisplay } from './systemMessages';
import {
  buildReactionMap,
  buildGalleryReactionMap,
  useReactionHandler,
  useGalleryReactionHandler,
} from './reactions';
import { useImagePacks } from '@/app/hooks/useImagePacks';
import { togglePin } from './pinning';
import { openMessageContextMenu } from './contextMenu';
import type { ImagePackImage } from '@/app/hooks/useImagePacks';
import { MessageContent } from './content';
import { MessageGallery } from './GalleryGrid';
import { useDecryptedMedia } from './encryption';
import { markdownToHtml } from '@/util/markdownToHtml';

function findMxcShortcode(packs: Map<string, ImagePackImage>, mxcUrl: string): string | null {
  for (const [shortcode, img] of packs) {
    if (img.url === mxcUrl) return shortcode;
  }
  return null;
}
import {
  getReplyContent,
  getReplyEventId,
  extractReplyMxcUrl,
  stripReplyFallback,
  stripReplyFallbackHtml,
  isEditableEvent,
  type ReplyContent,
} from './textContent';
import { ReceiptAvatar } from './receiptAvatar';
import {
  editMessageAtom,
  userProfileAtom,
  mentionInsertAtom,
  developerModeAtom,
  threadLastSeenAtom,
  type MessageLayout,
} from '@/app/store/atoms';
import { PollCreatorModal } from '@/app/features/timeline/composer/PollCreatorModal';
import { EditMessageComposer } from './EditMessageComposer';
import { extractPollData } from './PollViewer';
import * as css from '../Timeline.css';

export interface MessageProps {
  event: MatrixEvent;
  isOwn: boolean;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  isGrouped: boolean;
  variant: MessageLayout;
  isSystemMessage: boolean;
  isEdited: boolean;
  isRedacted: boolean;
  isPinned: boolean;
  canEdit: boolean;
  canRedact: boolean;
  canPin: boolean;
  isDecrypting: boolean;
  isUndecryptable: boolean;
  isSending?: boolean;
  isFailed?: boolean;
  sendError?: string | null;
  optimisticBody?: string | null;
  galleryEvents?: MatrixEvent[] | null;
  client: MatrixClient;
  searchQuery?: string;
  receiptUsers?: ReceiptUser[];
  reactionVersion?: number;
  onReply: (event: MatrixEvent) => void;
  onEdit: (event: MatrixEvent) => void;
  onDelete: (event: MatrixEvent) => void;
  onReact: (event: MatrixEvent, anchor?: HTMLElement) => void;
  onThreadClick?: (event: MatrixEvent) => void;
  onResend?: (event: MatrixEvent) => void;
  onCancel?: (event: MatrixEvent) => void;
  onJumpToEvent?: (eventId: string) => void;
  hideReplyQuote?: boolean;
  hideThreadBadge?: boolean;
  hoveredEventId: string | null;
  onHover: (eventId: string | null) => void;
}

export const Message = memo(function Message({
  event,
  isOwn,
  senderId,
  senderName,
  senderAvatar,
  isGrouped,
  variant,
  isSystemMessage,
  isEdited,
  isRedacted,
  isPinned,
  canEdit,
  canRedact,
  canPin,
  isDecrypting,
  isUndecryptable,
  isSending = false,
  isFailed = false,
  optimisticBody = null,
  galleryEvents = null,
  client,
  searchQuery = '',
  receiptUsers = [],
  reactionVersion = 0,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onResend,
  onCancel,
  onJumpToEvent,
  onThreadClick,
  hideReplyQuote = false,
  hideThreadBadge = false,
  hoveredEventId,
  onHover,
}: MessageProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const showActions = hoveredEventId === event.getId();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [viewSourceEvent, setViewSourceEvent] = useState<MatrixEvent | null>(null);
  const [devModeEnabled] = useAtom(developerModeAtom);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const threadLastSeen = useAtomValue(threadLastSeenAtom);
  const { openContextMenu } = useContextMenu();
  const setProfile = useSetAtom(userProfileAtom);
  const setMentionInsert = useSetAtom(mentionInsertAtom);
  const confirmDialog = useConfirm();

  const handleNameClick = useCallback(() => {
    setMentionInsert({ text: `@${senderName} `, displayName: senderName, userId: senderId });
  }, [senderName, senderId, setMentionInsert]);

  const handleOpenProfile = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      setProfile({
        userId: senderId,
        roomId: event.getRoomId(),
        anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
    },
    [senderId, event, setProfile]
  );

  const handleMouseEnter = useCallback(() => {
    onHover(event.getId() ?? null);
  }, [onHover, event]);
  const handleMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  const handleRowFocus = useCallback(() => {
    onHover(event.getId() ?? null);
  }, [onHover, event]);

  const handleRowBlur = useCallback(
    (e: React.FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && e.currentTarget.contains(next)) return;
      onHover(null);
    },
    [onHover]
  );

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (isMenuOpenKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      handleContextMenu(syntheticMouseEvent(0, 0, e.currentTarget));
    }
  };

  const type = event.getType();
  const content = event.getContent();
  const hasCodeBlock =
    typeof content?.formatted_body === 'string' &&
    (content.formatted_body as string).includes('<pre');
  const ts = event.getTs();
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(event.getRoomId() ?? '');
  const isPollEvent = M_POLL_START.matches(type);
  const canEditMessageType = isEditableEvent(event) || isPollEvent;
  const [replacedVersion, setReplacedVersion] = useState(0);

  // Re-read poll data when an edit (m.replace) is applied
  useEffect(() => {
    const onReplaced = () => setReplacedVersion((v) => v + 1);
    event.on(MatrixEventEvent.Replaced, onReplaced);
    return () => {
      event.off(MatrixEventEvent.Replaced, onReplaced);
    };
  }, [event]);

  useEffect(() => {
    if (!room) return;
    const bump = () => setTimelineVersion((v) => v + 1);
    room.on(RoomEvent.Timeline, bump);
    return () => {
      room.off(RoomEvent.Timeline, bump);
    };
  }, [room]);

  const pollData = useMemo(() => {
    if (!isPollEvent) return null;
    const data = extractPollData(event);
    return {
      question: data.questionText,
      answers: data.answers.map((a) => ({ id: a.id, text: a.label })),
      kind: (data.kind && M_POLL_KIND_DISCLOSED.matches(data.kind)
        ? 'disclosed'
        : 'undisclosed') as 'disclosed' | 'undisclosed',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, isPollEvent, replacedVersion]);

  const canEndPoll =
    isPollEvent &&
    event.getSender() === client.getUserId() &&
    !room?.polls.get(event.getId() ?? '')?.isEnded;

  const handleEndPoll = useCallback(
    async (ev: MatrixEvent) => {
      const roomId = ev.getRoomId();
      const eventId = ev.getId();
      if (!roomId || !eventId) return;
      const question = extractPollData(ev).questionText;
      const ok = await confirmDialog({
        title: `${t('timeline.poll.end')}?`,
        message: t('timeline.poll.endConfirmMessage', { question }),
        danger: true,
      });
      if (!ok) return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).sendEvent(roomId, null, M_POLL_END.name, {
          'm.relates_to': { rel_type: 'm.reference', event_id: eventId },
          [M_POLL_END.name]: {},
          [M_POLL_END.altName]: {},
        });
        toast.success(t('timeline.poll.endSuccess'));
      } catch (err) {
        toast.error(t('timeline.poll.endFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, confirmDialog, toast, t]
  );

  // Decrypted media (encrypted attachments)
  const {
    mediaSrc,
    isDecrypting: isFileDecrypting,
    setMediaSrc,
    requestFullRes,
  } = useDecryptedMedia(event, content as Record<string, unknown>, client);

  const handleMediaClick = useCallback(
    (src: string) => {
      setLightboxSrc(src);
      requestFullRes().then((full) => {
        if (full) setLightboxSrc(full);
      });
    },
    [requestFullRes]
  );

  const handleLightboxClose = useCallback(() => {
    setLightboxSrc(null);
  }, []);

  // Reactions: reactionVersion is a reaction-count derived from buildItems, passed
  // as a prop so React.memo detects changes. It invalidates this useMemo when
  // reactions are added or removed, since room and event are stable SDK references.
  // For galleries, reactions from every member image are merged into one deduped row.
  const isGallery = galleryEvents != null && galleryEvents.length >= 2;
  const reactionMap = useMemo(
    () =>
      isGallery
        ? buildGalleryReactionMap(room, galleryEvents, myId)
        : buildReactionMap(room, event, myId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, event, galleryEvents, myId, reactionVersion]
  );
  const singleReactionHandler = useReactionHandler(event, client);
  const galleryReactionHandler = useGalleryReactionHandler(galleryEvents ?? [], client);
  const handleReactionClick = isGallery ? galleryReactionHandler : singleReactionHandler;

  const imagePacks = useImagePacks(client, event.getRoomId() ?? null);

  const [failedReactions, setFailedReactions] = useState<Set<string>>(new Set());
  const markFailed = useCallback((key: string) => {
    setFailedReactions((prev) => new Set(prev).add(key));
  }, []);

  const mediaUrl = useCallback(
    (mxcUrl: string): string | null => {
      return client.mxcUrlToHttp(
        mxcUrl,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
    },
    [client]
  );

  const renderReactionKey = useCallback(
    (key: string) => {
      if (failedReactions.has(key)) return <>{key}</>;

      let imgUrl: string | null = null;

      const shortcode = key.replace(/^:/, '').replace(/:$/, '');
      const pack = imagePacks.get(shortcode);

      if (pack) {
        imgUrl = pack.url;
      } else if (key.startsWith('mxc://')) {
        for (const img of imagePacks.values()) {
          if (img.url === key) {
            imgUrl = key;
            break;
          }
        }
        if (!imgUrl) imgUrl = key;
      }

      if (imgUrl) {
        const src = mediaUrl(imgUrl);
        if (!src) return <>{key}</>;
        return (
          <img src={src} alt={key} className={css.reactionImg} onError={() => markFailed(key)} />
        );
      }
      return <>{key}</>;
    },
    [imagePacks, mediaUrl, failedReactions, markFailed]
  );

  const threadBadge = useMemo(() => {
    if (hideThreadBadge || isRedacted || isUndecryptable) return null;
    const eventId = event.getId();
    if (!eventId) return null;

    const threadRel = event.getServerAggregatedRelation<{
      count: number;
      latest_event?: { event_id?: string };
      current_user_participated?: boolean;
    }>('m.thread');

    const localThread = room?.getThread(eventId);

    let count: number;
    let lastRenderableEventId: string | undefined;

    const RENDERABLE_TYPES = new Set([
      'm.room.message',
      'm.sticker',
      'm.room.encrypted',
      'm.poll.start',
      'org.matrix.msc3381.poll.start',
    ]);
    const NON_RENDERABLE_RELATION_TYPES = new Set(['m.replace', 'm.reference', 'm.annotation']);

    const findLastRenderable = (events: MatrixEvent[]): string | undefined => {
      for (let i = events.length - 1; i >= 0; i--) {
        const e = events[i];
        if (!RENDERABLE_TYPES.has(e.getType())) continue;
        const relType = e.getRelation()?.rel_type;
        if (relType && NON_RENDERABLE_RELATION_TYPES.has(relType)) continue;
        return e.getId() ?? undefined;
      }
      return undefined;
    };

    if (localThread && localThread.initialEventsFetched) {
      count = localThread.length;
      lastRenderableEventId = findLastRenderable(localThread.events);
    } else if (threadRel && threadRel.count > 0) {
      count = threadRel.count;
      lastRenderableEventId = threadRel.latest_event?.event_id;
    } else if (localThread && localThread.length > 0) {
      count = localThread.length;
      lastRenderableEventId = findLastRenderable(localThread.events);
    } else {
      const childEvents = room?.relations?.getAllChildEventsForEvent(eventId);
      const threadReplies =
        childEvents?.filter((e) => e.getRelation()?.rel_type === 'm.thread') ?? [];
      if (threadReplies.length === 0) return null;
      count = threadReplies.length;
      lastRenderableEventId = findLastRenderable(threadReplies);
    }

    if (count === 0) return null;

    const lastSeenEventId = threadLastSeen[eventId];
    const hasNewReplies =
      lastSeenEventId === undefined ||
      (lastRenderableEventId !== undefined && lastRenderableEventId !== lastSeenEventId);

    return { count, hasNewReplies };
  }, [hideThreadBadge, isRedacted, isUndecryptable, event, room, timelineVersion, threadLastSeen]);

  const handleReactionDelegate = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-reaction-key]');
      if (!btn) return;
      const key = btn.dataset.reactionKey;
      if (!key) return;
      const reaction = reactionMap.get(key);
      if (reaction) handleReactionClick(reaction);
    },
    [reactionMap, handleReactionClick]
  );

  // Pinning
  const handlePin = useCallback(() => {
    if (!room) return;
    togglePin(client, room, event, isPinned).catch((err) => {
      toast.error(t('timeline.pinFailed', { error: getErrorMessage(err) }));
    });
  }, [client, room, event, isPinned, toast, t]);

  // View Source
  const handleViewSource = useCallback((ev: MatrixEvent) => {
    setViewSourceEvent(ev);
  }, []);

  const handleViewSourceClose = useCallback(() => {
    setViewSourceEvent(null);
  }, []);

  // Context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    openMessageContextMenu(e, event, {
      canEdit: canEdit && canEditMessageType,
      canRedact,
      canPin,
      canEndPoll,
      isDecrypting,
      isUndecryptable,
      isRedacted,
      isPinned,
      devModeEnabled,
      t,
      openContextMenu,
      callbacks: {
        onReply,
        onThreadClick,
        onEdit,
        onDelete,
        onEndPoll: handleEndPoll,
        onReact: (ev) => onReact(ev),
        onPin: handlePin,
        onViewSource: handleViewSource,
      },
    });
  };

  // Reply quote
  const reply = !isRedacted && !isUndecryptable ? getReplyContent(event, client) : null;

  const replyEventId =
    reply === null && !isRedacted && !isUndecryptable ? getReplyEventId(event) : null;
  const [fetchedReply, setFetchedReply] = useState<ReplyContent | null>(null);
  const fetchedReplyEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!replyEventId) {
      setFetchedReply(null);
      fetchedReplyEventIdRef.current = null;
      return;
    }
    if (fetchedReplyEventIdRef.current === replyEventId) return;
    fetchedReplyEventIdRef.current = replyEventId;
    const roomId = event.getRoomId() ?? '';
    const mapper = client.getEventMapper();
    client
      .fetchRoomEvent(roomId, replyEventId)
      .then(async (raw) => {
        const matrixEvent = mapper(raw);
        await client.decryptEventIfNeeded(matrixEvent);
        const c = matrixEvent.getContent() as Record<string, unknown>;
        const mxcUrl = extractReplyMxcUrl(matrixEvent.getType(), c);
        const body = stripReplyFallback((c?.body as string | undefined) ?? '');
        const formattedBody =
          stripReplyFallbackHtml((c?.formatted_body as string | undefined) ?? '') || undefined;
        setFetchedReply({
          eventId: replyEventId,
          body,
          formattedBody,
          senderId: matrixEvent.getSender() ?? '',
          mxcUrl,
        });
      })
      .catch(() => {
        setFetchedReply(null);
      });
  }, [replyEventId, client, event]);

  const displayReply = reply ?? fetchedReply;

  const handleQuickReact = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onReact(event, e.currentTarget);
    },
    [event, onReact]
  );

  const handleThreadClick = useCallback(() => {
    onThreadClick?.(event);
  }, [event, onThreadClick]);

  // Inline editing
  const [editState, setEditState] = useAtom(editMessageAtom);
  const isEditing = editState?.eventId === event.getId();

  const cancelEdit = useCallback(() => {
    setEditState(null);
    onHover(null);
  }, [setEditState, onHover]);

  const editPollModal = isEditing && isPollEvent && (
    <PollCreatorModal
      open={true}
      onClose={cancelEdit}
      client={client}
      roomId={editState?.roomId ?? ''}
      threadId={editState?.threadId ?? null}
      editEventId={editState?.eventId}
      initialPoll={pollData ?? undefined}
    />
  );

  if (type === EventType.GroupCallMemberPrefix) {
    return <CallEventDisplay event={event} senderName={senderName} />;
  }

  if (isSystemMessage) {
    return <SystemMessageDisplay event={event} senderName={senderName} client={client} />;
  }

  const messageContent =
    galleryEvents != null && galleryEvents.length >= 2 ? (
      <MessageGallery
        events={galleryEvents}
        client={client}
        senderName={senderName}
        senderAvatar={senderAvatar}
      />
    ) : (
      <MessageContent
        event={event}
        client={client}
        mediaSrc={mediaSrc}
        isDecrypting={isFileDecrypting}
        isRedacted={isRedacted}
        isEventDecrypting={isDecrypting}
        isUndecryptable={isUndecryptable}
        searchQuery={searchQuery}
        myId={myId}
        senderName={senderName}
        onMediaLoad={setMediaSrc}
        onMediaClick={handleMediaClick}
        roomId={event.getRoomId()}
        optimisticBody={optimisticBody}
        imagePacks={imagePacks}
        onMentionClick={(userId, rect) =>
          setProfile({
            userId,
            roomId: event.getRoomId(),
            anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          })
        }
      />
    );

  const showEncryptedBanner = isDecrypting || isUndecryptable;
  const showFailedUI = isFailed && !isEdited && !isRedacted;
  const actionToolbar = showActions && !isRedacted && !showEncryptedBanner && !showFailedUI && (
    <MessageActionToolbar
      event={event}
      canEdit={canEdit && canEditMessageType}
      canRedact={canRedact}
      canPin={canPin}
      canEndPoll={canEndPoll}
      isPinned={isPinned}
      devModeEnabled={devModeEnabled}
      onReply={onReply}
      onThreadClick={onThreadClick}
      onReact={onReact}
      onEdit={onEdit}
      onDelete={onDelete}
      onEndPoll={handleEndPoll}
      onPin={handlePin}
      onViewSource={handleViewSource}
    />
  );

  const reactionsBar = !showEncryptedBanner &&
    !showFailedUI &&
    !isRedacted &&
    reactionMap.size > 0 && (
      <div
        className={css.reactionsBar}
        role="group"
        aria-label={t('timeline.reactions')}
        onClick={handleReactionDelegate}
      >
        {Array.from(reactionMap.values())
          .sort((a, b) => b.count - a.count)
          .map((r) => (
            <Tooltip
              key={r.key}
              content={(() => {
                const shortcode =
                  r.shortcode ??
                  (r.key.startsWith('mxc://') ? findMxcShortcode(imagePacks, r.key) : null) ??
                  r.key;
                return r.isOwn
                  ? t('timeline.removeReaction', { emoji: shortcode })
                  : t('timeline.addReaction', { emoji: shortcode, count: r.count });
              })()}
            >
              <button
                type="button"
                data-reaction-key={r.key}
                className={r.isOwn ? css.reactionChipOwn : css.reactionChip}
              >
                {renderReactionKey(r.key)}
                {r.count > 1 ? ` ${r.count}` : ''}
              </button>
            </Tooltip>
          ))}
        <button
          type="button"
          className={css.reactionQuickAdd}
          onClick={handleQuickReact}
          aria-label={t('timeline.react')}
        >
          <span className={css.reactionQuickAddIconWrap}>
            <SmileyIcon size={14} />
            <span className={css.reactionQuickAddPlus}>+</span>
          </span>
        </button>
      </div>
    );

  const MAX_VISIBLE_WITH_OVERFLOW = 3;
  const MAX_VISIBLE_NO_OVERFLOW = 4;
  const hasMoreReaders = receiptUsers.length > MAX_VISIBLE_NO_OVERFLOW;
  const maxVisible = hasMoreReaders ? MAX_VISIBLE_WITH_OVERFLOW : MAX_VISIBLE_NO_OVERFLOW;
  const visibleReceipts = receiptUsers.slice(0, maxVisible);
  const overflowCount = receiptUsers.length - visibleReceipts.length;

  const readReceiptBar = (
    <div className={[css.readReceiptRow, hasCodeBlock ? css.readReceiptRowSpaced : null].join(' ')}>
      {[...visibleReceipts].reverse().map((u) => (
        <ReceiptAvatar key={u.userId} user={u} client={client} />
      ))}
      {overflowCount > 0 && <span className={css.readReceiptOverflow}>+{overflowCount}</span>}
    </div>
  );

  const failedUI = showFailedUI && (
    <div className={css.sendFailedRow}>
      <WarningIcon size={14} className={css.sendFailedIcon} />
      <span className={css.sendFailedText}>{t('timeline.sendFailedGeneric')}</span>
      <button type="button" className={css.sendRetryBtn} onClick={() => onResend?.(event)}>
        {t('timeline.retry')}
      </button>
      <button type="button" className={css.sendDiscardBtn} onClick={() => onCancel?.(event)}>
        {t('common.cancel')}
      </button>
    </div>
  );

  const contentClass =
    variant === 'classic'
      ? isGrouped
        ? isOwn
          ? css.msgContentClassicGroupedOwn
          : css.msgContentClassicGrouped
        : isOwn
          ? css.msgContentClassicOwn
          : css.msgContentClassic
      : isGrouped
        ? css.msgContentGrouped
        : css.msgContent;

  const rowClass = [
    isGrouped ? css.msgRowGrouped : css.msgRow,
    isSending ? css.msgSending : null,
    isFailed ? css.msgFailed : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClass}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      onFocusCapture={handleRowFocus}
      onBlurCapture={handleRowBlur}
      onKeyDown={handleRowKeyDown}
      tabIndex={0}
      role="group"
      data-hovered={showActions ? 'true' : 'false'}
    >
      <div className={css.msgHoverRegion}>
        <div className={css.msgAvatarCol}>
          {!isGrouped && (
            <button
              type="button"
              onClick={handleOpenProfile}
              aria-label={senderName}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                lineHeight: 0,
              }}
            >
              <Avatar name={senderName} mxcUrl={senderAvatar} client={client} size="sm" />
            </button>
          )}
        </div>

        <div className={css.msgBody}>
          {!isGrouped ? (
            <div className={css.msgMeta}>
              <button type="button" className={css.msgSender} onClick={handleNameClick}>
                {senderName}
              </button>
              <span className={css.msgTime}>{formatTime(ts, i18n.language)}</span>
              {isEdited && <span className={css.editedMarkerHeader}>{t('timeline.edited')}</span>}
            </div>
          ) : null}

          {!hideReplyQuote && displayReply && (
            <button
              type="button"
              className={css.replyQuote}
              onClick={() => onJumpToEvent?.(displayReply.eventId)}
            >
              <strong>
                {room?.getMember(displayReply.senderId)?.name ??
                  formatUserId(displayReply.senderId)}
                :{' '}
              </strong>
              {displayReply.mxcUrl ? (
                <img
                  src={
                    client.mxcUrlToHttp(
                      displayReply.mxcUrl,
                      24,
                      24,
                      'scale',
                      undefined,
                      undefined,
                      true
                    ) ?? ''
                  }
                  alt={displayReply.body || ''}
                  style={{
                    height: '1.4em',
                    width: 'auto',
                    verticalAlign: 'middle',
                    display: 'inline',
                  }}
                />
              ) : (
                <span
                  dangerouslySetInnerHTML={{
                    __html: displayReply.formattedBody
                      ? markdownToHtml(displayReply.formattedBody, myId, true, false, true)
                      : markdownToHtml(displayReply.body.substring(0, 100), myId, true),
                  }}
                />
              )}
              {!displayReply.formattedBody && displayReply.body.length > 100 ? '…' : ''}
            </button>
          )}

          {isEditing && !isPollEvent ? (
            editState ? (
              <EditMessageComposer client={client} editState={editState} onClose={cancelEdit} />
            ) : null
          ) : !isEditing ? (
            <div className={contentClass}>
              {messageContent}
              {isGrouped && isEdited && (
                <span
                  className={
                    variant === 'classic' ? css.editedMarkerGroupedClassic : css.editedMarkerGrouped
                  }
                >
                  {t('timeline.edited')}
                </span>
              )}
            </div>
          ) : null}

          {failedUI}

          {reactionsBar}

          {!isEditing && threadBadge && (
            <button type="button" className={css.threadBadge} onClick={handleThreadClick}>
              <ChatDotsIcon size={14} weight="fill" />
              {threadBadge.hasNewReplies && <span className={css.threadBadgeParticipatedDot} />}
              {t('timeline.threadReplies', { count: threadBadge.count })}
            </button>
          )}
        </div>
        {!isEditing && actionToolbar}
      </div>

      {readReceiptBar}

      {lightboxSrc && (
        <MediaLightbox
          src={lightboxSrc}
          name={senderName}
          filename={content?.body as string | undefined}
          client={client}
          avatarMxc={senderAvatar}
          onClose={handleLightboxClose}
        />
      )}
      <ViewSourceModal event={viewSourceEvent} onClose={handleViewSourceClose} />
      {editPollModal}
    </div>
  );
});
