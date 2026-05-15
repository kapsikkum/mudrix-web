import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  ArrowBendUpLeftIcon,
  SmileyIcon,
  PushPinIcon,
  PushPinSlashIcon,
  PencilSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import { formatTime } from '@/util/format';
import { formatUserId } from '@/util/matrix';
import { useContextMenu } from '@/app/hooks/useContextMenu';
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
  const { openContextMenu } = useContextMenu();

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

  // Pinning
  const isPinned = isPinnedEvent(room, event.getId() ?? '');
  const handlePin = () => {
    if (!room) return;
    togglePin(client, room, event, isPinned).catch(() => {});
  };

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
    />
  );

  const actionToolbar = showActions && !isRedacted && !isEncrypted && (
    <div className={`${css.msgActions} ${css.actionsVisible}`}>
      <button
        className={css.msgActionBtn}
        title={t('timeline.reply')}
        onClick={() => onReply(event)}
      >
        <ArrowBendUpLeftIcon size={14} />
      </button>
      <button
        className={css.msgActionBtn}
        title={t('timeline.react')}
        onClick={(e) => onReact(event, e.currentTarget)}
      >
        <SmileyIcon size={14} />
      </button>
      <button
        className={isPinned ? css.msgActionBtnPinned : css.msgActionBtn}
        title={isPinned ? t('timeline.unpin') : t('timeline.pin')}
        onClick={handlePin}
      >
        {isPinned ? <PushPinSlashIcon size={14} /> : <PushPinIcon size={14} />}
      </button>
      {isOwn && (
        <button
          className={css.msgActionBtn}
          title={t('timeline.editAction')}
          onClick={() => onEdit(event)}
        >
          <PencilSimpleIcon size={14} />
        </button>
      )}
      {isOwn && (
        <button
          className={css.msgActionBtn}
          title={t('timeline.deleteAction')}
          onClick={() => onDelete(event)}
        >
          <TrashIcon size={14} />
        </button>
      )}
    </div>
  );

  const reactionsBar = reactionMap.size > 0 && (
    <div className={css.reactionsBar}>
      {Array.from(reactionMap.values()).map((r) => (
        <button
          key={r.key}
          className={r.isOwn ? css.reactionChipOwn : css.reactionChip}
          title={
            r.isOwn
              ? t('timeline.removeReaction', { emoji: r.key })
              : t('timeline.addReaction', { emoji: r.key, count: r.count })
          }
          onClick={() => handleReactionClick(r)}
        >
          {r.key} {r.count}
        </button>
      ))}
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
    const rowClass = isGrouped ? css.msgRowModernGrouped : css.msgRowModern;

    return (
      <div
        className={rowClass}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onContextMenu={handleContextMenu}
      >
        <div className={css.msgAvatarCol}>
          {!isGrouped && (
            <Avatar name={senderName} mxcUrl={senderAvatar} client={client} size="sm" />
          )}
        </div>

        <div className={css.msgBodyModern}>
          {!isGrouped ? (
            <div className={css.msgMetaModern}>
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

          <div className={css.msgContentWrap}>
            <div className={isGrouped ? css.msgBubbleModernGrouped : css.msgBubbleModern}>
              {messageContent}
            </div>
            {actionToolbar}
          </div>

          {reactionsBar}
          {readReceiptBar}
        </div>
      </div>
    );
  }

  const rowClass = isOwn
    ? isGrouped
      ? css.msgRowOwnGrouped
      : css.msgRowOwn
    : isGrouped
      ? css.msgRowGrouped
      : css.msgRow;

  const bubble = isOwn ? css.msgBubbleOwn : css.msgBubble;
  const bodyClass = isOwn ? css.msgBodyOwn : css.msgBody;

  return (
    <div
      className={rowClass}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onContextMenu={handleContextMenu}
    >
      <div className={css.msgAvatarCol}>
        {!isGrouped && <Avatar name={senderName} mxcUrl={senderAvatar} client={client} size="sm" />}
      </div>

      <div className={bodyClass}>
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

        <div className={bubble}>
          {messageContent}
          {isEdited && <span className={css.editedMarker}>{t('timeline.edited')}</span>}
          {actionToolbar}
        </div>

        {reactionsBar}
        {readReceiptBar}
      </div>
    </div>
  );
}
