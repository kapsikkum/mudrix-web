import { useTranslation } from 'react-i18next';
import { ChatDotsIcon } from '@phosphor-icons/react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { Avatar } from '@/app/components/Avatar';
import { formatRelativeTime } from '@/util/format';
import { formatUserId, getDmPartnerId } from '@/util/matrix';
import { stripReplyFallback } from '@/app/features/timeline/message/textContent';
import type { InboxThread } from './useThreadsInbox';
import * as css from './Inbox.css';

function previewOf(client: MatrixClient, event: MatrixEvent, fallback: string): string {
  if (event.isRedacted()) return fallback;
  const content = event.getClearContent() ?? event.getContent();
  const raw = typeof content?.body === 'string' ? content.body : '';
  const sender = event.getRoomId()
    ? client.getRoom(event.getRoomId()!)?.getMember(event.getSender() ?? '')
    : null;
  const name = sender?.name || formatUserId(event.getSender() ?? '');
  const text = stripReplyFallback(raw).split('\n')[0].trim();
  return `${name}: ${text || fallback}`;
}

interface ThreadRowProps {
  client: MatrixClient;
  item: InboxThread;
  onOpen: (item: InboxThread, kind: 'dm' | 'room') => void;
}

/** One entry of the threads list: room, the thread's root message and its latest reply. */
export function ThreadRow({ client, item, onOpen }: ThreadRowProps) {
  const { t, i18n } = useTranslation();
  const { thread, unread, ts } = item;
  const room = thread.room;
  const dmPartnerId = getDmPartnerId(room, client);
  const partner = dmPartnerId ? room.getMember(dmPartnerId) : null;
  const roomName = dmPartnerId
    ? (partner?.name ?? formatUserId(dmPartnerId))
    : (room.name ?? room.roomId);
  const avatarMxc = dmPartnerId
    ? (partner?.getMxcAvatarUrl() ?? null)
    : (room.getMxcAvatarUrl?.() ?? null);
  const kind: 'dm' | 'room' = dmPartnerId ? 'dm' : 'room';
  const fallback = t('common.newMessage');
  const last = thread.lastReply();
  const open = () => onOpen(item, kind);

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
        <span className={css.name}>
          {roomName}
          {unread && (
            <span className={css.notifDot} style={{ position: 'static', marginLeft: 6 }} />
          )}
        </span>
        <span className={css.sub}>{previewOf(client, thread.rootEvent!, fallback)}</span>
        {last && <span className={css.sub}>↳ {previewOf(client, last, fallback)}</span>}
      </div>
      <span className={css.entryMeta}>
        <span className={css.time}>{formatRelativeTime(ts, t, i18n.language)}</span>
        <span className={css.sub}>
          <ChatDotsIcon size={12} /> {thread.length}
        </span>
      </span>
    </div>
  );
}
