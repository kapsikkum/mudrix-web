import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  ThreadEvent,
  RoomEvent,
  EventType,
  RelationType,
  ReceiptType,
  Direction,
  TimelineWindow,
} from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Thread } from 'matrix-js-sdk';
import { XIcon, ArrowLeftIcon } from '@phosphor-icons/react';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { Avatar } from '@/app/components/Avatar';
import { formatTime } from '@/util/format';
import { formatUserId } from '@/util/matrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Composer } from '@/app/features/timeline';
import { Message } from '@/app/features/timeline/message/Message';
import {
  threadLastSeenAtom,
  editMessageAtom,
  confirmModalAtom,
  emojiPickerAtom,
  messageLayoutAtom,
  preferencesAtom,
} from '@/app/store/atoms';
import { buildReactionMap } from '@/app/features/timeline/message/reactions';
import { useRoomReceipts } from '@/app/hooks/useRoomReceipts';
import { useWidgets } from '@/app/hooks/useWidgets';
import { buildItems } from '@/app/hooks/useTimeline';
import type { TimelineItem } from '@/app/hooks/useTimeline';
import * as css from './ThreadPanel.css';

const INITIAL_SIZE = 50;
const PAGE_SIZE = 50;
const MAX_PAGES = 10;

interface ThreadPanelProps {
  client: MatrixClient;
  roomId: string;
  rootEvent: MatrixEvent;
  className?: string;
  onClose: () => void;
  onBack?: () => void;
}

export function ThreadPanel({
  client,
  roomId,
  rootEvent,
  className,
  onClose,
  onBack,
}: ThreadPanelProps) {
  const { t, i18n } = useTranslation();
  const myId = client.getUserId() ?? '';
  const toast = useToast();
  const prefs = useAtomValue(preferencesAtom);
  const [, setConfirm] = useAtom(confirmModalAtom);
  const [, setEditMessage] = useAtom(editMessageAtom);
  const [, setEmojiPicker] = useAtom(emojiPickerAtom);

  const [replies, setReplies] = useState<MatrixEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MatrixEvent | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);
  const rootId = rootEvent.getId() ?? '';
  const setThreadLastSeen = useSetAtom(threadLastSeenAtom);

  const twRef = useRef<TimelineWindow | null>(null);

  const room = useMemo(() => client.getRoom(roomId) ?? null, [client, roomId]);
  const receiptMap = useRoomReceipts(client, room);
  const layout = useAtomValue(messageLayoutAtom);
  const isModern = layout === 'modern';

  const items = useMemo<TimelineItem[]>(
    () => buildItems(replies, client, roomId, t, i18n.language),
    [replies, client, roomId, t, i18n.language, renderVersion]
  );

  const { stickerWidget } = useWidgets(client, roomId);

  useMatrixEvent(client, 'Event.decrypted', () => setRenderVersion((v) => v + 1));

  const markRead = useCallback(
    (event: MatrixEvent) => {
      const eventId = event.getId();
      if (!eventId) return;
      setThreadLastSeen((prev) => ({ ...prev, [rootId]: eventId }));
      const receiptType = prefs.sendReadReceipts ? ReceiptType.Read : ReceiptType.ReadPrivate;
      client.sendReadReceipt(event, receiptType).catch(() => {});
    },
    [client, rootId, prefs.sendReadReceipts, setThreadLastSeen]
  );

  const rebuildFromWindow = useCallback(
    (tw: TimelineWindow) => {
      const all = tw.getEvents().filter((e) => e.getId() !== rootId);
      setReplies(all);
    },
    [rootId]
  );

  useEffect(() => {
    if (items.length === 0) return;
    const lastItem = items[items.length - 1];
    markRead(lastItem.event);
  }, [items, markRead]);

  useEffect(() => {
    if (!room) return;
    twRef.current = null;
    setReplies([]);
    setLoading(true);

    let cancelled = false;

    const load = async () => {
      try {
        const thread = room.getThread(rootId);

        if (thread) {
          const tw = new TimelineWindow(client, thread.getUnfilteredTimelineSet(), {
            windowLimit: INITIAL_SIZE * MAX_PAGES,
          });
          twRef.current = tw;

          await tw.load(undefined, INITIAL_SIZE);
          if (cancelled) return;

          let pages = 0;
          while (tw.canPaginate(Direction.Backward) && pages < MAX_PAGES) {
            const more = await tw.paginate(Direction.Backward, PAGE_SIZE);
            if (cancelled) return;
            if (!more) break;
            pages++;
          }

          rebuildFromWindow(tw);
          return;
        }

        const allEvents: MatrixEvent[] = [];
        let nextBatch: string | null | undefined;
        do {
          const result = await client.relations(roomId, rootId, 'm.thread', null, {
            dir: Direction.Backward,
            ...(nextBatch ? { from: nextBatch } : {}),
          });
          allEvents.push(...(result.events ?? []));
          nextBatch = result.nextBatch;
        } while (nextBatch);

        if (cancelled) return;

        const events = allEvents.reverse().filter((e) => e.getId() !== rootId);
        setReplies(events);
        // markRead fires via the items useEffect once buildItems has filtered to renderable events.
      } catch (err) {
        if (!cancelled) console.error('[ThreadPanel] failed to load thread', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [client, room, roomId, rootId, rebuildFromWindow, markRead]);

  useEffect(() => {
    if (!room) return;

    const thread = room.getThread(rootId);

    if (thread) {
      const onNewReply = async () => {
        const tw = twRef.current;
        if (!tw) return;
        try {
          if (tw.canPaginate(Direction.Forward)) {
            await tw.paginate(Direction.Forward, PAGE_SIZE);
          }
        } catch {
          // ignore
        }
        rebuildFromWindow(tw);
      };
      thread.on(ThreadEvent.NewReply, onNewReply);
      return () => {
        thread.off(ThreadEvent.NewReply, onNewReply);
      };
    }

    const onTimeline = (event: MatrixEvent) => {
      if (event.getRoomId() !== roomId) return;
      const rel = event.getRelation();
      if (rel?.rel_type !== 'm.thread' || rel.event_id !== rootId) return;
      setReplies((prev) => {
        if (prev.some((e) => e.getId() === event.getId())) return prev;
        return [...prev, event];
      });
      // markRead fires via the items useEffect.
    };
    room.on(RoomEvent.Timeline, onTimeline);
    return () => {
      room.off(RoomEvent.Timeline, onTimeline);
    };
  }, [room, roomId, rootId, rebuildFromWindow]);

  useEffect(() => {
    if (!room) return;
    const onThreadNew = (thread: Thread) => {
      if (thread.id !== rootId) return;
      if (twRef.current) return; // already using TimelineWindow
      const tw = new TimelineWindow(client, thread.getUnfilteredTimelineSet(), {
        windowLimit: INITIAL_SIZE * MAX_PAGES,
      });
      twRef.current = tw;
      tw.load(undefined, INITIAL_SIZE).then(async () => {
        let pages = 0;
        while (tw.canPaginate(Direction.Backward) && pages < MAX_PAGES) {
          const more = await tw.paginate(Direction.Backward, PAGE_SIZE);
          if (!more) break;
          pages++;
        }
        rebuildFromWindow(tw);
      });
    };
    room.on(ThreadEvent.New, onThreadNew);
    return () => {
      room.off(ThreadEvent.New, onThreadNew);
    };
  }, [client, room, roomId, rootId, rebuildFromWindow]);

  const rootSenderId = rootEvent.getSender() ?? '';
  const rootMember = room?.getMember(rootSenderId);
  const rootSenderName = rootMember?.name ?? formatUserId(rootSenderId);
  const rootSenderAvatar = rootMember?.getMxcAvatarUrl() ?? null;
  const rootBody = (rootEvent.getContent()?.body as string) ?? '';

  const handleEdit = useCallback(
    (event: MatrixEvent) => {
      const eventId = event.getId();
      if (!eventId) return;
      setEditMessage({ roomId, eventId, body: (event.getContent()?.body as string) ?? '' });
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

  const handleResend = useCallback(
    (event: MatrixEvent) => {
      if (!room) return;
      client.resendEvent(event, room).catch((err) => {
        console.error('[ThreadPanel] resendEvent failed', err);
        toast.error(t('timeline.sendFailed', { error: getErrorMessage(err) }));
      });
    },
    [client, room, toast, t]
  );

  const handleCancel = useCallback(
    (event: MatrixEvent) => {
      try {
        client.cancelPendingEvent(event);
      } catch (err) {
        console.error('[ThreadPanel] cancelPendingEvent failed', err);
      }
    },
    [client]
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
        client,
        roomId,
        onPick: async (emoji: string, mxcUrl?: string) => {
          try {
            const r = client.getRoom(roomId);
            const reactionKey = mxcUrl ?? emoji;
            const reactionMap = buildReactionMap(r, event, myId);
            const existing = reactionMap.get(reactionKey);
            if (existing?.isOwn && existing.ownEventId) {
              await client.redactEvent(roomId, existing.ownEventId);
            } else {
              await client.sendEvent(roomId, EventType.Reaction, {
                'm.relates_to': {
                  rel_type: RelationType.Annotation,
                  event_id: eventId,
                  key: reactionKey,
                },
              });
            }
          } catch (err) {
            toast.error(t('timeline.reactFailedShort', { error: getErrorMessage(err) }));
          }
        },
      });
    },
    [client, roomId, myId, setEmojiPicker, toast, t]
  );

  const replyListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = replyListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [replies.length]);

  return (
    <aside className={`${css.threadPanel}${className ? ` ${className}` : ''}`}>
      <div className={css.threadPanelHeader}>
        {onBack ? (
          <button
            type="button"
            className={css.threadPanelBack}
            onClick={onBack}
            aria-label={t('common.back')}
          >
            <ArrowLeftIcon size={16} />
          </button>
        ) : null}
        <span>{t('timeline.threadPanel')}</span>
        <span className={css.threadPanelDivider} />
        <span className={css.threadPanelTitle}>
          {t('timeline.threadPanelCount', { count: items.length })}
        </span>
        <button
          type="button"
          className={css.threadPanelClose}
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <XIcon size={16} />
        </button>
      </div>

      <div className={css.threadRootWrap}>
        <div className={css.threadRootMeta}>
          <Avatar name={rootSenderName} mxcUrl={rootSenderAvatar} client={client} size="sm" />
          <span className={css.threadRootSender}>{rootSenderName}</span>
          <span className={css.threadRootTime}>{formatTime(rootEvent.getTs(), i18n.language)}</span>
        </div>
        <div className={css.threadRootContent}>{rootBody}</div>
      </div>

      {loading ? (
        <div className={css.threadLoading}>{t('common.loading')}</div>
      ) : (
        <div ref={replyListRef} className={css.threadReplyList}>
          {items.length === 0 && <div className={css.threadEmpty}>{t('timeline.threadEmpty')}</div>}
          {items.map((item) => {
            const eventId = item.event.getId() ?? '';
            return (
              <div key={eventId}>
                {item.showDateSep && <div className={css.dateSeparator}>{item.dateSepLabel}</div>}
                <Message
                  event={item.event}
                  isOwn={item.isOwn}
                  senderId={item.senderId}
                  senderName={item.senderName}
                  senderAvatar={item.senderAvatar}
                  isGrouped={item.isGrouped}
                  isModern={isModern}
                  isSystemMessage={item.isSystemMessage}
                  isEdited={item.isEdited}
                  isRedacted={item.isRedacted}
                  isPinned={item.isPinned}
                  isDecrypting={item.isDecrypting}
                  isUndecryptable={item.isUndecryptable}
                  isSending={item.isSending}
                  isFailed={item.isFailed}
                  sendError={item.sendError}
                  client={client}
                  receiptUsers={receiptMap.get(eventId) ?? []}
                  reactionVersion={item.reactionVersion}
                  onReply={setReplyTo}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReact={handleReact}
                  onResend={handleResend}
                  onCancel={handleCancel}
                  hideThreadBadge
                  hoveredEventId={hoveredEventId}
                  onHover={setHoveredEventId}
                />
              </div>
            );
          })}
        </div>
      )}

      <Composer
        client={client}
        roomId={roomId}
        threadId={rootId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        stickerWidget={stickerWidget}
        className={css.threadComposerBg}
        onSent={() => {}}
      />
    </aside>
  );
}
