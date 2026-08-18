import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  M_POLL_START,
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
import { useContextMenu } from '@/app/hooks/useContextMenu';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import { CallEventDisplay } from './callEvents';
import { SystemMessageDisplay } from './systemMessages';
import { buildReactionMap, buildGalleryReactionMap, useReactionHandler } from './reactions';
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
  type ReplyContent,
} from './textContent';
import { ReceiptAvatar } from './receiptAvatar';
import {
  editMessageAtom,
  userProfileAtom,
  mentionInsertAtom,
  developerModeAtom,
  threadLastSeenAtom,
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
  isModern: boolean;
  isSystemMessage: boolean;
  isEdited: boolean;
  isRedacted: boolean;
  isPinned: boolean;
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
  isModern,
  isSystemMessage,
  isEdited,
  isRedacted,
  isPinned,
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
  const showActions = hoveredEventId === event.getId();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [viewSourceEvent, setViewSourceEvent] = useState<MatrixEvent | null>(null);
  const [devModeEnabled] = useAtom(developerModeAtom);
  const [timelineVersion, setTimelineVersion] = useState(0);
  const threadLastSeen = useAtomValue(threadLastSeenAtom);
  const { openContextMenu } = useContextMenu();
  const setProfile = useSetAtom(userProfileAtom);
  const setMentionInsert = useSetAtom(mentionInsertAtom);

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

  const type = event.getType();
  const content = event.getContent();
  const hasCodeBlock =
    typeof content?.formatted_body === 'string' &&
    (content.formatted_body as string).includes('<pre');
  const ts = event.getTs();
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(event.getRoomId() ?? '');
  const isPollEvent = M_POLL_START.matches(type);
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
  const reactionMap = useMemo(
    () =>
      galleryEvents != null && galleryEvents.length >= 2
        ? buildGalleryReactionMap(room, galleryEvents, myId)
        : buildReactionMap(room, event, myId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, event, galleryEvents, myId, reactionVersion]
  );
  const handleReactionClick = useReactionHandler(event, client);

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
    togglePin(client, room, event, isPinned).catch(() => {});
  }, [client, room, event, isPinned]);

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
      isOwn,
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
      isOwn={isOwn}
      isPinned={isPinned}
      devModeEnabled={devModeEnabled}
      onReply={onReply}
      onThreadClick={onThreadClick}
      onReact={onReact}
      onEdit={onEdit}
      onDelete={onDelete}
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

  const MAX_VISIBLE = 5;
  const visibleReceipts = receiptUsers.slice(0, MAX_VISIBLE);
  const overflowCount = receiptUsers.length - visibleReceipts.length;

  const readReceiptBar = receiptUsers.length > 0 && (
    <div className={[css.readReceiptRow, hasCodeBlock ? css.readReceiptRowSpaced : null].join(' ')}>
      {visibleReceipts.map((u) => (
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

  if (isModern) {
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
        data-hovered={showActions ? 'true' : 'false'}
      >
        <div className={css.msgAvatarCol}>
          {!isGrouped && (
            <button
              type="button"
              onClick={handleOpenProfile}
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

        <div className={css.msgBodyModern}>
          {!isGrouped ? (
            <div className={css.msgMeta}>
              <button type="button" className={css.msgSender} onClick={handleNameClick}>
                {senderName}
              </button>
              <span className={css.msgTimeModern}>{formatTime(ts, i18n.language)}</span>
              {isEdited && <span className={css.editedMarkerModern}>{t('timeline.edited')}</span>}
            </div>
          ) : (
            isEdited && <span className={css.editedMarker}>{t('timeline.edited')}</span>
          )}

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
            <div className={isGrouped ? css.msgBubbleModernGrouped : css.msgBubbleModern}>
              {messageContent}
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

          {!isEditing && actionToolbar}
          {readReceiptBar}
        </div>
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
  }

  const bubble = isOwn ? css.msgBubbleOwn : css.msgBubble;

  const classicRowClass = [
    isGrouped ? css.msgRowGrouped : css.msgRow,
    isSending ? css.msgSending : null,
    isFailed ? css.msgFailed : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classicRowClass}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      data-hovered={showActions ? 'true' : 'false'}
    >
      <div className={css.msgAvatarCol}>
        {!isGrouped && (
          <button
            type="button"
            onClick={handleOpenProfile}
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
        {!isGrouped && (
          <div className={css.msgMeta}>
            <button type="button" className={css.msgSender} onClick={handleNameClick}>
              {senderName}
            </button>
            <span className={css.msgTime}>{formatTime(ts, i18n.language)}</span>
          </div>
        )}

        {!hideReplyQuote && displayReply && (
          <button
            type="button"
            className={css.replyQuote}
            onClick={() => onJumpToEvent?.(displayReply.eventId)}
          >
            <strong>
              {room?.getMember(displayReply.senderId)?.name ?? formatUserId(displayReply.senderId)}
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
          <div className={bubble}>
            {messageContent}
            {isEdited && <span className={css.editedMarker}>{t('timeline.edited')}</span>}
            {failedUI}
          </div>
        ) : null}

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
