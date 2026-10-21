import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkSimpleIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Avatar } from '@/app/components/Avatar';
import { Tooltip } from '@/app/components/Tooltip';
import { formatRelativeTime } from '@/util/format';
import { formatUserId, getDmPartnerId } from '@/util/matrix';
import { stripReplyFallback } from '@/app/features/timeline/message/textContent';
import { resolveSavedEvent, type SavedMessage } from '@/util/savedMessages';
import * as css from './Inbox.css';

interface Preview {
  senderName: string;
  body: string;
  ts: number;
}

interface SavedRowProps {
  client: MatrixClient;
  saved: SavedMessage;
  onOpen: (saved: SavedMessage, kind: 'dm' | 'room') => void;
  onRemove: (saved: SavedMessage) => void;
}

/** One entry of the saved-messages list: room, sender and the start of the message. */
export function SavedRow({ client, saved, onOpen, onRemove }: SavedRowProps) {
  const { t, i18n } = useTranslation();
  const room = client.getRoom(saved.roomId);
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    resolveSavedEvent(client, saved).then((event) => {
      if (cancelled) return;
      if (!event || event.isRedacted()) {
        setPreview(null);
        return;
      }
      const content = event.getClearContent() ?? event.getContent();
      const raw = typeof content?.body === 'string' ? content.body : '';
      const senderId = event.getSender() ?? '';
      const member = room?.getMember(senderId);
      setPreview({
        senderName: member?.name || formatUserId(senderId),
        body: stripReplyFallback(raw).split('\n')[0].trim() || t('common.newMessage'),
        ts: event.getTs(),
      });
    });
    return () => {
      cancelled = true;
    };
    // Re-resolve only when the saved entry changes; `room` and `t` are stable enough for a preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, saved.roomId, saved.eventId]);

  const dmPartnerId = room ? getDmPartnerId(room, client) : null;
  const kind: 'dm' | 'room' = dmPartnerId ? 'dm' : 'room';
  const partner = dmPartnerId ? room?.getMember(dmPartnerId) : null;
  const roomName = room
    ? dmPartnerId
      ? (partner?.name ?? formatUserId(dmPartnerId))
      : (room.name ?? saved.roomId)
    : saved.roomId;
  const avatarMxc = room
    ? dmPartnerId
      ? (partner?.getMxcAvatarUrl() ?? null)
      : (room.getMxcAvatarUrl?.() ?? null)
    : null;
  const canOpen = !!room && room.getMyMembership() === 'join';
  const open = () => {
    if (canOpen) onOpen(saved, kind);
  };

  return (
    <div
      className={css.item}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <Avatar name={roomName} mxcUrl={avatarMxc} client={client} size="sm" />
      <div className={css.info}>
        <span className={css.name}>{roomName}</span>
        <span className={css.sub}>
          {preview === undefined
            ? '…'
            : preview === null
              ? t('inbox.savedUnavailable')
              : `${preview.senderName}: ${preview.body}`}
        </span>
      </div>
      <span className={css.entryMeta}>
        <span className={css.time}>
          {formatRelativeTime(preview?.ts ?? saved.savedAt, t, i18n.language)}
        </span>
        <Tooltip placement="left" content={t('timeline.unsaveMessage')}>
          <button
            type="button"
            className={css.markReadButton}
            aria-label={t('timeline.unsaveMessage')}
            onClick={(e) => {
              e.stopPropagation();
              onRemove(saved);
            }}
          >
            <BookmarkSimpleIcon size={14} weight="fill" />
          </button>
        </Tooltip>
      </span>
    </div>
  );
}
