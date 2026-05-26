import { useCallback, useState, useRef, useEffect } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { SmileyIcon } from '@phosphor-icons/react';
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
import { isPinnedEvent, togglePin } from './pinning';
import { openMessageContextMenu } from './contextMenu';
import { MessageContent } from './content';
import { useDecryptedMedia } from './encryption';
import { getReplyContent } from './textContent';
import { ReceiptAvatar } from './receiptAvatar';
import { editMessageAtom, userProfileAtom } from '@/app/store/atoms';
import { markdownToHtml } from '@/util/markdownToHtml';
import { getMatrixClient } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
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
  client: MatrixClient;
  searchQuery?: string;
  receiptUsers?: ReceiptUser[];
  onReply: (event: MatrixEvent) => void;
  onEdit: (event: MatrixEvent) => void;
  onDelete: (event: MatrixEvent) => void;
  onReact: (event: MatrixEvent, anchor?: HTMLElement) => void;
}

export function Message({
  event,
  isOwn,
  senderId,
  senderName,
  senderAvatar,
  isGrouped,
  isModern,
  isSystemMessage,
  client,
  searchQuery = '',
  receiptUsers = [],
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageProps) {
  const { t } = useTranslation();
  const [showActions, setShowActions] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { openContextMenu } = useContextMenu();
  const setProfile = useSetAtom(userProfileAtom);

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
  const isRedacted = event.isRedacted();
  const isEncrypted = type === 'm.room.encrypted' || content?.msgtype === 'm.bad.encrypted';
  const ts = event.getTs();
  const isEdited = !!event.replacingEvent();
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(event.getRoomId() ?? '');

  // Decrypted media (encrypted attachments)
  const { mediaSrc, isDecrypting, setMediaSrc } = useDecryptedMedia(
    event,
    content as Record<string, unknown>,
    client
  );

  // Reactions
  const reactionMap = buildReactionMap(room, event, myId);
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
  const isPinned = isPinnedEvent(room, event.getId() ?? '');
  const handlePin = useCallback(() => {
    if (!room) return;
    togglePin(client, room, event, isPinned).catch(() => {});
  }, [client, room, event, isPinned]);

  // Context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    openMessageContextMenu(e, event, {
      isOwn,
      isEncrypted,
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

  useEffect(() => {
    if (isEditing && editState) {
      setEditText(editState.body);
      setTimeout(() => {
        const el = editTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
        editContainerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 30);
    }
  }, [isEditing, editState?.eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelEdit = useCallback(() => {
    setEditState(null);
    setEditText('');
    setIsSavingEdit(false);
    setShowActions(false);
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
      const formattedBody = markdownToHtml(newBody);
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
        disabled={isSavingEdit}
        placeholder={t('timeline.editPlaceholder')}
      />
      <div className={css.editActions}>
        <button className={css.editBtnCancel} onClick={cancelEdit} disabled={isSavingEdit}>
          {t('common.cancel')}
        </button>
        <button
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
    return <SystemMessageDisplay event={event} senderName={senderName} />;
  }

  const messageContent = (
    <MessageContent
      event={event}
      client={client}
      mediaSrc={mediaSrc}
      isDecrypting={isDecrypting}
      isRedacted={isRedacted}
      isEncrypted={isEncrypted}
      searchQuery={searchQuery}
      myId={myId}
      senderName={senderName}
      onMediaLoad={setMediaSrc}
      onMediaClick={handleMediaClick}
    />
  );

  const actionToolbar = showActions && !isRedacted && !isEncrypted && (
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

  const reactionsBar = !isEncrypted && reactionMap.size > 0 && (
    <div className={css.reactionsBar} onClick={handleReactionDelegate}>
      {Array.from(reactionMap.values()).map((r) => (
        <button
          key={r.key}
          data-reaction-key={r.key}
          className={r.isOwn ? css.reactionChipOwn : css.reactionChip}
          title={
            r.isOwn
              ? t('timeline.removeReaction', { emoji: r.key })
              : t('timeline.addReaction', { emoji: r.key, count: r.count })
          }
        >
          {r.key}
          {r.count > 1 ? ` ${r.count}` : ''}
        </button>
      ))}
      <button
        className={css.reactionQuickAdd}
        onClick={handleQuickReact}
        title={t('timeline.react')}
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

  if (isModern) {
    const rowClass = isGrouped ? css.msgRowGrouped : css.msgRow;

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
              <span className={css.msgSender}>{senderName}</span>
              <span className={css.msgTimeModern}>{formatTime(ts)}</span>
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

  return (
    <div
      className={isGrouped ? css.msgRowGrouped : css.msgRow}
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
            <span className={css.msgSender}>{senderName}</span>
            <span className={css.msgTime}>{formatTime(ts)}</span>
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
}
