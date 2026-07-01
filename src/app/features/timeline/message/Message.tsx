import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { SmileyIcon, WarningIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { Avatar } from '@/app/components/Avatar';
import { MediaLightbox } from '@/app/components/MediaLightbox/MediaLightbox';
import { MessageActionToolbar } from './MessageActionToolbar';
import { formatTime } from '@/util/format';
import { formatUserId } from '@/util/matrix';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useToast } from '@/app/hooks/useToast';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import { CallEventDisplay } from './callEvents';
import { SystemMessageDisplay } from './systemMessages';
import { buildReactionMap, useReactionHandler } from './reactions';
import { togglePin } from './pinning';
import { openMessageContextMenu } from './contextMenu';
import { MessageContent } from './content';
import { useDecryptedMedia } from './encryption';
import { getReplyContent } from './textContent';
import { ReceiptAvatar } from './receiptAvatar';
import { editMessageAtom, userProfileAtom, mentionInsertAtom } from '@/app/store/atoms';
import { markdownToHtml } from '@/util/markdownToHtml';
import { getMatrixClient } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
import { FormatToolbar } from '@/app/features/timeline/composer/FormatToolbar';
import { useFormatToolbar } from '@/app/features/timeline/composer/useFormatToolbar';
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
  client: MatrixClient;
  searchQuery?: string;
  receiptUsers?: ReceiptUser[];
  reactionVersion?: number;
  onReply: (event: MatrixEvent) => void;
  onEdit: (event: MatrixEvent) => void;
  onDelete: (event: MatrixEvent) => void;
  onReact: (event: MatrixEvent, anchor?: HTMLElement) => void;
  onResend?: (event: MatrixEvent) => void;
  onCancel?: (event: MatrixEvent) => void;
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
}: MessageProps) {
  const { t, i18n } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
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

  const handleMediaClick = useCallback((src: string) => {
    setLightboxSrc(src);
  }, []);

  const handleLightboxClose = useCallback(() => {
    setLightboxSrc(null);
  }, []);

  const handleMouseEnter = useCallback(() => setShowActions(true), []);
  const handleMouseLeave = useCallback(() => setShowActions(false), []);

  const type = event.getType();
  const content = event.getContent();
  const ts = event.getTs();
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(event.getRoomId() ?? '');

  // Decrypted media (encrypted attachments)
  const {
    mediaSrc,
    isDecrypting: isFileDecrypting,
    setMediaSrc,
  } = useDecryptedMedia(event, content as Record<string, unknown>, client);

  // Reactions: reactionVersion is a reaction-count derived from buildItems, passed
  // as a prop so React.memo detects changes. It invalidates this useMemo when
  // reactions are added or removed, since room and event are stable SDK references.
  const reactionMap = useMemo(
    () => buildReactionMap(room, event, myId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, event, myId, reactionVersion]
  );
  const handleReactionClick = useReactionHandler(event, client);

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

  // Context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    openMessageContextMenu(e, event, {
      isOwn,
      isDecrypting,
      isUndecryptable,
      isRedacted,
      isPinned,
      t,
      openContextMenu,
      callbacks: {
        onReply,
        onEdit,
        onDelete,
        onReact: (ev) => onReact(ev),
        onPin: handlePin,
      },
    });
  };

  // Reply quote
  const reply = getReplyContent(event, client);

  const handleQuickReact = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onReact(event, e.currentTarget);
    },
    [event, onReact]
  );

  // Inline editing
  const [editState, setEditState] = useAtom(editMessageAtom);
  const isEditing = editState?.eventId === event.getId();
  const [editText, setEditText] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const {
    toolbar: editToolbar,
    updateToolbar: updateEditToolbar,
    applyFormat: applyEditFormat,
    resetToolbar: resetEditToolbar,
  } = useFormatToolbar({
    value: editText,
    setValue: setEditText,
    textareaRef: editTextareaRef,
    containerRef: editContainerRef,
  });

  useEffect(() => {
    if (isEditing && editState) {
      setEditText(editState.body);
      const timer = setTimeout(() => {
        const el = editTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
        editContainerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [isEditing, editState?.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelEdit = useCallback(() => {
    setEditState(null);
    setEditText('');
    setIsSavingEdit(false);
    setShowActions(false);
    resetEditToolbar();
  }, [setEditState, setShowActions]);

  const saveEdit = useCallback(async () => {
    if (!editState) return;
    const newBody = editText.trim();
    if (!newBody || newBody === editState.body) {
      cancelEdit();
      return;
    }
    setIsSavingEdit(true);
    try {
      const client = getMatrixClient();
      const formattedBody = markdownToHtml(newBody, undefined, false);
      await client.sendMessage(editState.roomId, {
        msgtype: 'm.text',
        body: `* ${newBody}`,
        format: 'org.matrix.custom.html',
        formatted_body: formattedBody,
        'm.new_content': {
          msgtype: 'm.text',
          body: newBody,
          format: 'org.matrix.custom.html',
          formatted_body: formattedBody,
        },
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: editState.eventId,
        },
      } as RoomMessageEventContent);
      cancelEdit();
    } catch (err) {
      toast.error(t('timeline.editFailed', { error: getErrorMessage(err) }));
      setIsSavingEdit(false);
    }
  }, [editState, editText, cancelEdit, toast, t]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        cancelEdit();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        saveEdit();
      }
    },
    [cancelEdit, saveEdit]
  );

  const handleEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditText(e.target.value);
    resetEditToolbar();
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    editContainerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  const editBubble = isEditing && (
    <div className={css.editContainer} ref={editContainerRef}>
      <textarea
        ref={editTextareaRef}
        className={css.editTextarea}
        value={editText}
        onChange={handleEditChange}
        onKeyDown={handleEditKeyDown}
        onMouseUp={updateEditToolbar}
        onKeyUp={updateEditToolbar}
        disabled={isSavingEdit}
        placeholder={t('timeline.editPlaceholder')}
      />
      {editToolbar && (
        <FormatToolbar
          top={editToolbar.top}
          left={editToolbar.left}
          activeFormats={editToolbar.activeFormats}
          onFormat={applyEditFormat}
        />
      )}
      <div className={css.editActions}>
        <button
          type="button"
          className={css.editBtnCancel}
          onClick={cancelEdit}
          disabled={isSavingEdit}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className={css.editBtnSave}
          onClick={saveEdit}
          disabled={isSavingEdit || !editText.trim()}
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  );

  if (type === 'm.call.invite' || type === 'm.call.hangup') {
    return <CallEventDisplay event={event} senderName={senderName} client={client} />;
  }

  if (isSystemMessage) {
    return <SystemMessageDisplay event={event} senderName={senderName} client={client} />;
  }

  const messageContent = (
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
      onReply={onReply}
      onReact={onReact}
      onEdit={onEdit}
      onDelete={onDelete}
      onPin={handlePin}
    />
  );

  const reactionsBar = !showEncryptedBanner && !showFailedUI && reactionMap.size > 0 && (
    <div
      className={css.reactionsBar}
      role="group"
      aria-label={t('timeline.reactions')}
      onClick={handleReactionDelegate}
    >
      {Array.from(reactionMap.values()).map((r) => (
        <Tooltip
          key={r.key}
          content={
            r.isOwn
              ? t('timeline.removeReaction', { emoji: r.key })
              : t('timeline.addReaction', { emoji: r.key, count: r.count })
          }
        >
          <button
            type="button"
            data-reaction-key={r.key}
            className={r.isOwn ? css.reactionChipOwn : css.reactionChip}
          >
            {r.key}
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
    <div className={css.readReceiptRow}>
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

          {reply && (
            <div className={css.replyQuote}>
              <strong>{formatUserId(reply.senderId)}: </strong>
              {reply.body.substring(0, 100)}
              {reply.body.length > 100 ? '…' : ''}
            </div>
          )}

          {isEditing ? (
            editBubble
          ) : (
            <div className={isGrouped ? css.msgBubbleModernGrouped : css.msgBubbleModern}>
              {messageContent}
            </div>
          )}

          {failedUI}

          {!isEditing && actionToolbar}
          {readReceiptBar}
          {reactionsBar}
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

        {reply && (
          <div className={css.replyQuote}>
            <strong>{formatUserId(reply.senderId)}: </strong>
            {reply.body.substring(0, 100)}
            {reply.body.length > 100 ? '…' : ''}
          </div>
        )}

        {isEditing ? (
          editBubble
        ) : (
          <div className={bubble}>
            {messageContent}
            {isEdited && <span className={css.editedMarker}>{t('timeline.edited')}</span>}
            {failedUI}
          </div>
        )}

        {reactionsBar}
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
    </div>
  );
});
