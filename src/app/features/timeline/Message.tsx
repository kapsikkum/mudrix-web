import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EventType, RelationType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  ArrowBendUpLeftIcon,
  SmileyIcon,
  PushPinIcon,
  PushPinSlashIcon,
  PencilSimpleIcon,
  TrashIcon,
  ProhibitIcon,
  LockIcon,
  FileTextIcon,
  SignInIcon,
  SignOutIcon,
  UserCircleIcon,
  PhoneIcon,
  PhoneDisconnectIcon,
  PhoneXIcon,
} from '@phosphor-icons/react';
import {
  Avatar,
  fetchAvatarBlobUrl,
  getCachedBlobUrl,
  fetchMediaBlobUrl,
} from '@/app/components/Avatar';
import { formatTime } from '@/util/format';
import { formatUserId } from '@/util/matrix';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useToast } from '@/app/hooks/useToast';
import { highlightQuery } from '@/app/hooks/useSearch';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import { getErrorMessage } from '@/util/error';
import { markdownToHtml } from '@/util/markdownToHtml';
import { getEncryptedFile, decryptMediaFile } from './encryptedMedia';
import * as css from './Timeline.css';
import * as headerCss from './RoomHeader.css';

interface ReplyContent {
  body: string;
  senderId: string;
}

interface Reaction {
  key: string;
  count: number;
  isOwn: boolean;
  ownEventId: string | null;
}

function getReplyContent(event: MatrixEvent, client: MatrixClient): ReplyContent | null {
  const content = event.getContent();
  const relatesTo = content?.['m.relates_to'];
  if (!relatesTo?.['m.in_reply_to']?.event_id) return null;

  const replyEventId = relatesTo['m.in_reply_to'].event_id;
  const room = client.getRoom(event.getRoomId() ?? '');
  const replyEvent = room?.findEventById(replyEventId);
  if (!replyEvent) return null;

  return {
    body: replyEvent.getContent()?.body ?? '',
    senderId: replyEvent.getSender() ?? '',
  };
}

function renderTextContent(content: Record<string, unknown>, myUserId?: string): string {
  // Prefer formatted_body when the format is org.matrix.custom.html —
  // this carries mention links, bold, italic etc. from all Matrix clients.
  // We still sanitize it through DOMPurify via markdownToHtml's pipeline.
  // Fall back to plain body rendered through our markdown parser.
  const format = content.format as string | undefined;
  const formattedBody = content.formatted_body as string | undefined;
  if (format === 'org.matrix.custom.html' && formattedBody) {
    return markdownToHtml(formattedBody, myUserId);
  }
  const body = (content.body as string) ?? '';
  return markdownToHtml(body, myUserId);
}

function getMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  setState: (url: string) => void
): string | null {
  if (!mxcUrl) return null;
  // Check both the full-size cache key and the legacy thumbnail key
  const cached = getCachedBlobUrl(`full:${mxcUrl}`) ?? getCachedBlobUrl(mxcUrl);
  if (cached) return cached;
  // Fetch the original file (no server-side thumbnail) so GIFs animate correctly
  // and stickers/images aren't degraded by re-encoding.
  fetchMediaBlobUrl(mxcUrl, client, 1).then((url) => {
    if (url) setState(url);
  });
  return null;
}

interface MessageProps {
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

function ReceiptAvatar({ user, client }: { user: ReceiptUser; client: MatrixClient }) {
  const [imgSrc, setImgSrc] = useState<string | null>(
    user.avatarUrl ? (getCachedBlobUrl(user.avatarUrl) ?? null) : null
  );

  useEffect(() => {
    if (!user.avatarUrl) return;
    const cached = getCachedBlobUrl(user.avatarUrl);
    if (cached) {
      setImgSrc(cached);
      return;
    }
    let cancelled = false;
    fetchAvatarBlobUrl(user.avatarUrl, client).then((url) => {
      if (!cancelled) setImgSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [user.avatarUrl, client]);

  const { initial, hue } = (() => {
    const safeName = user.displayName || '?';
    const code = safeName.codePointAt(0) ?? 63;
    return { initial: safeName.charAt(0).toUpperCase(), hue: Math.round((code * 137.508) % 360) };
  })();

  return (
    <div
      className={css.readReceiptAvatar}
      style={imgSrc ? undefined : { backgroundColor: `hsl(${hue}, 60%, 42%)` }}
      title={user.displayName}
      aria-label={user.displayName}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={user.displayName} className={css.readReceiptAvatarImg} />
      ) : (
        initial
      )}
    </div>
  );
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
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { openContextMenu } = useContextMenu();
  const toast = useToast();

  const type = event.getType();
  const content = event.getContent();
  const isRedacted = event.isRedacted();
  const isEncrypted = type === 'm.room.encrypted' || content?.msgtype === 'm.bad.encrypted';
  const ts = event.getTs();
  const isEdited = !!event.replacingEvent();

  // If the message carries an encrypted file (MSC3090), decrypt it on mount
  // so it renders just like a plain media message.
  useEffect(() => {
    const msgtype = content?.msgtype as string | undefined;
    const isMedia =
      msgtype === 'm.image' ||
      msgtype === 'm.video' ||
      msgtype === 'm.file' ||
      msgtype === 'm.audio';
    if (!isMedia) return;

    const encryptedFile = getEncryptedFile(content as Record<string, unknown>);
    if (!encryptedFile) return; // unencrypted — handled by getMediaBlobUrl

    // Already resolved (e.g. component re-rendered)
    if (mediaSrc) return;

    let cancelled = false;
    setIsDecrypting(true);

    decryptMediaFile(
      client,
      encryptedFile,
      (content as Record<string, unknown>).info
        ? (((content as Record<string, unknown>).info as Record<string, unknown>)?.mimetype as
            | string
            | undefined)
        : undefined
    )
      .then((blob) => {
        if (cancelled) return;
        const blobUrl = URL.createObjectURL(blob);
        setMediaSrc(blobUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(t('timeline.decryptFailed', { error: getErrorMessage(err) }));
      })
      .finally(() => {
        if (!cancelled) setIsDecrypting(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.getId()]);

  if (type === 'm.call.invite' || type === 'm.call.hangup') {
    const callContent = content as Record<string, unknown>;
    const callId = callContent.call_id as string | undefined;
    const isOwner = event.getSender() === client.getUserId();

    if (type === 'm.call.invite') {
      // Detect video vs voice from the SDP offer
      const offerSdp = (callContent.offer as Record<string, unknown> | undefined)?.sdp as
        | string
        | undefined;
      const isVideo = offerSdp?.includes('m=video') ?? false;
      const label = isOwner
        ? t(isVideo ? 'timeline.callOutgoingVideo' : 'timeline.callOutgoing', { name: senderName })
        : t(isVideo ? 'timeline.callIncomingVideo' : 'timeline.callIncoming', { name: senderName });

      return (
        <div className={css.callEventRow}>
          <div className={css.callEventIcon}>
            <PhoneIcon size={15} weight="fill" />
          </div>
          <div className={css.callEventBody}>
            <span className={css.callEventLabel}>{label}</span>
            <span className={css.callEventMeta}>{formatTime(ts)}</span>
          </div>
        </div>
      );
    }

    if (type === 'm.call.hangup') {
      // Determine if this was a missed call (no answer) or a completed call
      const reason = callContent.reason as string | undefined;
      const isMissed = reason === 'invite_timeout' || reason === 'ice_failed';

      // Calculate duration by finding the matching invite event in the room timeline
      let durationLabel = '';
      if (!isMissed && callId) {
        const room = client.getRoom(event.getRoomId() ?? '');
        if (room) {
          const inviteEvent = room
            .getLiveTimeline()
            .getEvents()
            .find(
              (e) =>
                e.getType() === 'm.call.invite' &&
                (e.getContent() as Record<string, unknown>).call_id === callId
            );
          if (inviteEvent) {
            const durationSec = Math.round((ts - inviteEvent.getTs()) / 1000);
            if (durationSec >= 3600) {
              const h = Math.floor(durationSec / 3600);
              const m = Math.floor((durationSec % 3600) / 60);
              const s = durationSec % 60;
              durationLabel = `${h}h ${m}m ${s}s`;
            } else if (durationSec >= 60) {
              const m = Math.floor(durationSec / 60);
              const s = durationSec % 60;
              durationLabel = `${m}m ${s}s`;
            } else {
              durationLabel = `${durationSec}s`;
            }
          }
        }
      }

      const label = isMissed
        ? t('timeline.callMissed', { name: senderName })
        : t('timeline.callEnded');

      return (
        <div className={isMissed ? css.callEventRowMissed : css.callEventRow}>
          <div className={isMissed ? css.callEventIconMissed : css.callEventIcon}>
            {isMissed ? (
              <PhoneXIcon size={15} weight="fill" />
            ) : (
              <PhoneDisconnectIcon size={15} weight="fill" />
            )}
          </div>
          <div className={css.callEventBody}>
            <span className={css.callEventLabel}>{label}</span>
            <span className={css.callEventMeta}>
              {formatTime(ts)}
              {durationLabel && <> · {durationLabel}</>}
            </span>
          </div>
        </div>
      );
    }
  }

  if (isSystemMessage) {
    const content = event.getContent();
    const prevContent = event.getPrevContent();
    const membership = content?.membership as string | undefined;
    const prevMembership = prevContent?.membership as string | undefined;

    let icon: React.ReactNode;
    let label: React.ReactNode;

    if (membership === 'join' && prevMembership !== 'join') {
      icon = <SignInIcon size={14} />;
      label = t('timeline.userJoined', { name: senderName });
    } else if ((membership === 'leave' || membership === 'ban') && prevMembership === 'join') {
      icon = <SignOutIcon size={14} />;
      label =
        membership === 'ban'
          ? t('timeline.userBanned', { name: senderName })
          : t('timeline.userLeft', { name: senderName });
    } else if (membership === 'join' && prevMembership === 'join') {
      const newName = content?.displayname as string | undefined;
      const oldName = prevContent?.displayname as string | undefined;
      const newAvatar = content?.avatar_url as string | undefined;
      const oldAvatar = prevContent?.avatar_url as string | undefined;
      if (newName !== oldName && oldName) {
        icon = <UserCircleIcon size={14} />;
        label = t('timeline.userRenamedFromTo', { name: oldName, newName: newName ?? senderName });
      } else if (newAvatar !== oldAvatar) {
        icon = <UserCircleIcon size={14} />;
        label = t('timeline.userChangedAvatar', { name: senderName });
      } else {
        return null;
      }
    } else {
      return null;
    }

    return (
      <div className={css.systemMsgRow}>
        <span className={css.systemMsgIcon}>{icon}</span>
        <span className={css.systemMsgText}>{label}</span>
      </div>
    );
  }

  const reactionMap = new Map<string, Reaction>();
  const myId = client.getUserId() ?? '';
  const room = client.getRoom(event.getRoomId() ?? '');
  if (room) {
    const relations = room.relations?.getChildEventsForEvent(
      event.getId() ?? '',
      'm.annotation',
      'm.reaction'
    );
    if (relations) {
      for (const rel of relations.getRelations()) {
        const key: string = rel.getContent()?.['m.relates_to']?.key ?? '';
        if (!key) continue;
        const existing = reactionMap.get(key) ?? { key, count: 0, isOwn: false, ownEventId: null };
        existing.count++;
        if (rel.getSender() === myId) {
          existing.isOwn = true;
          existing.ownEventId = rel.getId() ?? null;
        }
        reactionMap.set(key, existing);
      }
    }
  }

  const handleReactionClick = async (r: Reaction) => {
    const roomId = event.getRoomId() ?? '';
    try {
      if (r.isOwn && r.ownEventId) {
        await client.redactEvent(roomId, r.ownEventId);
      } else {
        await client.sendEvent(roomId, EventType.Reaction, {
          'm.relates_to': {
            rel_type: RelationType.Annotation,
            event_id: event.getId() ?? '',
            key: r.key,
          },
        });
      }
    } catch (err) {
      toast.error(t('timeline.reactFailed', { error: getErrorMessage(err) }));
    }
  };

  const reply = getReplyContent(event, client);

  const isPinned = (() => {
    const pinnedEvent = room?.currentState.getStateEvents('m.room.pinned_events', '');
    const pinnedIds: string[] =
      (Array.isArray(pinnedEvent) ? pinnedEvent[0] : pinnedEvent)?.getContent()?.pinned ?? [];
    return pinnedIds.includes(event.getId() ?? '');
  })();

  const handlePin = async () => {
    if (!room) return;
    const pinnedEvent = room.currentState.getStateEvents('m.room.pinned_events', '');
    const stateContent =
      (Array.isArray(pinnedEvent) ? pinnedEvent[0] : pinnedEvent)?.getContent() ?? {};
    const pinned: string[] = stateContent.pinned ?? [];
    const eventId = event.getId() ?? '';
    const newPinned = isPinned ? pinned.filter((id) => id !== eventId) : [...pinned, eventId];
    await client.sendStateEvent(
      event.getRoomId() ?? '',
      EventType.RoomPinnedEvents,
      { pinned: newPinned },
      ''
    );
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEncrypted) return;
    const items = [
      {
        label: t('timeline.reply'),
        icon: <ArrowBendUpLeftIcon size={14} />,
        onClick: () => onReply(event),
      },
      { label: t('timeline.react'), icon: <SmileyIcon size={14} />, onClick: () => onReact(event) },
      {
        label: isPinned ? t('timeline.unpin') : t('timeline.pin'),
        icon: isPinned ? <PushPinSlashIcon size={14} /> : <PushPinIcon size={14} />,
        onClick: handlePin,
      },
      ...(isOwn && !isRedacted
        ? [
            {
              label: t('timeline.editAction'),
              icon: <PencilSimpleIcon size={14} />,
              onClick: () => onEdit(event),
            },
            {
              label: t('timeline.deleteAction'),
              icon: <TrashIcon size={14} />,
              danger: true,
              onClick: () => onDelete(event),
            },
          ]
        : []),
    ];
    openContextMenu(e, items);
  };

  const renderContent = () => {
    if (isRedacted) {
      return (
        <span className={css.redactedMsg}>
          <ProhibitIcon size={14} /> {t('timeline.messageDeleted')}
        </span>
      );
    }
    if (isEncrypted) {
      return (
        <span className={css.redactedMsg}>
          <LockIcon size={14} /> {t('timeline.couldNotDecrypt')}
        </span>
      );
    }
    const msgtype = content?.msgtype as string | undefined;

    if (type === 'm.sticker' || msgtype === 'm.sticker') {
      const mxcUrl = content?.url as string;
      if (mxcUrl) {
        const src = mediaSrc ?? getMediaBlobUrl(mxcUrl, client, setMediaSrc);
        return src ? (
          <img
            src={src}
            alt={(content?.body as string) ?? 'sticker'}
            className={css.msgSticker}
          />
        ) : (
          <span className={css.loadingText}>{t('timeline.loadingSticker')}</span>
        );
      }
    }

    if (msgtype === 'm.image') {
      const encFile = getEncryptedFile(content as Record<string, unknown>);
      const mxcUrl = content?.url as string | undefined;
      // For encrypted files, mediaSrc is set by the useEffect above.
      // For unencrypted files, we resolve via getMediaBlobUrl as before.
      const src =
        mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, setMediaSrc) : null);
      if (isDecrypting) {
        return <span className={css.loadingText}>{t('timeline.decrypting')}</span>;
      }
      if (encFile || mxcUrl) {
        return src ? (
          <img
            src={src}
            alt={(content?.body as string) ?? 'image'}
            className={css.msgImage}
            loading="lazy"
          />
        ) : (
          <span className={css.loadingText}>{t('timeline.loadingImage')}</span>
        );
      }
      return null;
    }

    if (msgtype === 'm.video') {
      const encFile = getEncryptedFile(content as Record<string, unknown>);
      const mxcUrl = content?.url as string | undefined;
      const src =
        mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, setMediaSrc) : null);
      if (isDecrypting) {
        return <span className={css.loadingText}>{t('timeline.decrypting')}</span>;
      }
      if (encFile || mxcUrl) {
        return src ? (
          <video src={src} controls className={css.msgVideo} />
        ) : (
          <span className={css.loadingText}>{t('timeline.loadingVideo')}</span>
        );
      }
      return null;
    }

    if (msgtype === 'm.file') {
      const encFile = getEncryptedFile(content as Record<string, unknown>);
      const mxcUrl = content?.url as string | undefined;
      const filename = (content?.body as string) ?? 'file';
      const src =
        mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, setMediaSrc) : null);
      if (isDecrypting) {
        return (
          <span className={css.loadingRow}>
            <FileTextIcon size={14} /> {t('timeline.decrypting')}
          </span>
        );
      }
      if (encFile || mxcUrl) {
        if (src) {
          return (
            <a
              href={src}
              download={filename}
              className={css.fileLink}
            >
              <FileTextIcon size={14} /> {filename}
            </a>
          );
        }
        return (
          <span className={css.loadingRow}>
            <FileTextIcon size={14} /> {t('timeline.loadingFile', { name: filename })}
          </span>
        );
      }
    }

    if (msgtype === 'm.emote') {
      return (
        <em className={css.emoteMsg}>
          * {senderName} {(content?.body as string) ?? ''}
        </em>
      );
    }

    if (msgtype === 'm.notice') {
      const html = renderTextContent(content as Record<string, unknown>, myId);
      return <span className={css.noticeMsg} dangerouslySetInnerHTML={{ __html: html }} />;
    }

    // m.text / fallback
    const body = (content?.body as string) ?? '';
    if (searchQuery && body) {
      const parts = highlightQuery(body, searchQuery);
      return (
        <span>
          {parts.map((p, i) =>
            p.highlighted ? (
              <mark key={i} className={headerCss.searchHighlight}>
                {p.text}
              </mark>
            ) : (
              <span key={i}>{p.text}</span>
            )
          )}
        </span>
      );
    }
    const html = renderTextContent(content as Record<string, unknown>, myId);
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  };

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
        {/* Avatar column — avatar on first msg, empty spacer on grouped */}
        <div className={css.msgAvatarCol}>
          {!isGrouped && (
            <Avatar name={senderName} mxcUrl={senderAvatar} client={client} size="sm" />
          )}
        </div>

        {/* Body column */}
        <div className={css.msgBodyModern}>
          {/* First message in group: sender name + timestamp inline */}
          {!isGrouped && (
            <div className={css.msgMetaModern}>
              <span className={css.msgSender}>{senderName}</span>
              <span className={css.msgTimeModern}>{formatTime(ts)}</span>
            </div>
          )}

          {/* Reply quote */}
          {reply && (
            <div className={css.replyQuote}>
              <strong>{formatUserId(reply.senderId)}: </strong>
              {reply.body.substring(0, 100)}
              {reply.body.length > 100 ? '…' : ''}
            </div>
          )}

          {/* Content — no bubble, just text. Wrap in a relative container for the toolbar. */}
          <div className={css.msgContentWrap}>
            <div className={isGrouped ? css.msgBubbleModernGrouped : css.msgBubbleModern}>
              {renderContent()}
              {isEdited && <span className={css.editedMarker}>{t('timeline.edited')}</span>}
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
      {/* Avatar column — avatar on first msg, empty spacer on grouped */}
      <div className={css.msgAvatarCol}>
        {!isGrouped && <Avatar name={senderName} mxcUrl={senderAvatar} client={client} size="sm" />}
      </div>

      {/* Body column */}
      <div className={bodyClass}>
        {/* Sender + timestamp — only on first message in group */}
        {!isGrouped && (
          <div className={css.msgMeta}>
            <span className={css.msgSender}>{senderName}</span>
            <span className={css.msgTime}>{formatTime(ts)}</span>
          </div>
        )}

        {/* Reply quote */}
        {reply && (
          <div className={css.replyQuote}>
            <strong>{formatUserId(reply.senderId)}: </strong>
            {reply.body.substring(0, 100)}
            {reply.body.length > 100 ? '…' : ''}
          </div>
        )}

        {/* Bubble */}
        <div className={bubble}>
          {renderContent()}
          {isEdited && <span className={css.editedMarker}>{t('timeline.edited')}</span>}
          {actionToolbar}
        </div>

        {reactionsBar}
        {readReceiptBar}
      </div>
    </div>
  );
}
