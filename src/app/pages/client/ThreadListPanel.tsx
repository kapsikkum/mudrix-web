import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { ThreadEvent, RoomEvent, Direction } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, EventTimelineSet } from 'matrix-js-sdk';
import {
  ChatDotsIcon,
  XIcon,
  EyeIcon,
  FunnelIcon,
  ArrowsDownUpIcon,
  LockIcon,
  ArrowsInSimpleIcon,
  ArrowsOutSimpleIcon,
} from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import { Tooltip } from '@/app/components/Tooltip';
import { formatUserId } from '@/util/matrix';
import {
  threadFilterAtom,
  threadLastSeenAtom,
  threadPanelWidthAtom,
  threadPanelExpandedAtom,
  THREAD_PANEL_WIDTH_MIN,
  THREAD_PANEL_WIDTH_MAX,
  THREAD_PANEL_WIDTH_DEFAULT,
} from '@/app/store/atoms';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { PanelResizer } from '@/app/components/PanelResizer/PanelResizer';
import * as css from './ThreadListPanel.css';

interface ThreadListPanelProps {
  client: MatrixClient;
  roomId: string;
  className?: string;
  onSelectThread: (rootEvent: MatrixEvent) => void;
  onClose: () => void;
}

function SelectButton<T extends string>({
  icon,
  value,
  options,
  active,
  title,
  onChange,
}: {
  icon: React.ReactNode;
  value: T;
  options: { value: T; label: string }[];
  active: boolean;
  title: string;
  onChange: (value: T) => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <Tooltip content={title}>
      <div className={css.selectBtnWrap}>
        <span className={active ? css.toolbarBtnActive : css.toolbarBtn}>{icon}</span>
        <select
          ref={selectRef}
          className={css.select}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </Tooltip>
  );
}

function relativeTime(ts: number, locale: string): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString(locale);
}

export function ThreadListPanel({
  client,
  roomId,
  className,
  onSelectThread,
  onClose,
}: ThreadListPanelProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useAtom(threadFilterAtom);
  const [threadLastSeen, setThreadLastSeen] = useAtom(threadLastSeenAtom);
  const [threadPanelWidth, setThreadPanelWidth] = useAtom(threadPanelWidthAtom);
  const [expanded, setExpanded] = useAtom(threadPanelExpandedAtom);
  const isDesktop = useMediaQuery('(min-width: 769px)');
  const [version, setVersion] = useState(0);
  const [sortOrder, setSortOrder] = useState<'latest' | 'unread'>('latest');

  const threadListSetRef = useRef<EventTimelineSet | null>(null);
  const paginatingRef = useRef(false);

  const room = useMemo(() => client.getRoom(roomId), [client, roomId]);

  const hasAnyUnread = useMemo(() => {
    if (!room) return false;
    return room.getThreads().some((th) => {
      const rootId = th.id;
      const lastReplyId = th.lastReply()?.getId();
      const lastSeen = threadLastSeen[rootId];
      return lastSeen === undefined || (lastReplyId !== undefined && lastReplyId !== lastSeen);
    });
  }, [room, threadLastSeen, version]);

  function hasNewReplies(rootEventId: string, lastReplyEventId: string | undefined): boolean {
    const lastSeen = threadLastSeen[rootEventId];
    return (
      lastSeen === undefined || (lastReplyEventId !== undefined && lastReplyEventId !== lastSeen)
    );
  }

  useEffect(() => {
    if (!room) return;
    const bump = () => setVersion((v) => v + 1);
    room.on(ThreadEvent.New, bump);
    room.on(ThreadEvent.Update, bump);
    room.on(ThreadEvent.Delete, bump);
    room.on(RoomEvent.Timeline, bump);
    return () => {
      room.off(ThreadEvent.New, bump);
      room.off(ThreadEvent.Update, bump);
      room.off(ThreadEvent.Delete, bump);
      room.off(RoomEvent.Timeline, bump);
    };
  }, [room]);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    const load = async () => {
      threadListSetRef.current = null;
      paginatingRef.current = false;
      try {
        await room.createThreadsTimelineSets();
        threadListSetRef.current = room.threadsTimelineSets[0] ?? null;
        await room.fetchRoomThreads();
      } catch (err) {
        console.error('[ThreadListPanel] failed to fetch thread list', err);
      } finally {
        if (!cancelled) setVersion((v) => v + 1);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [room]);

  const loadMore = useCallback(async () => {
    const set = threadListSetRef.current;
    if (!set || paginatingRef.current) return;
    if (set.getLiveTimeline().getPaginationToken(Direction.Backward) === null) return;
    paginatingRef.current = true;
    try {
      await client.paginateEventTimeline(set.getLiveTimeline(), {
        backwards: true,
        limit: 20,
      });
    } catch (err) {
      console.error('[ThreadListPanel] failed to paginate thread list', err);
    } finally {
      paginatingRef.current = false;
      setVersion((v) => v + 1);
    }
  }, [client]);

  const threads = useMemo(() => {
    if (!room) return [];
    let all = room.getThreads();

    if (filter === 'my') {
      all = all.filter((th) => th.hasCurrentUserParticipated);
    }

    const sorted = [...all].sort((a, b) => {
      const aTime = a.lastReply()?.getTs() ?? a.rootEvent?.getTs() ?? 0;
      const bTime = b.lastReply()?.getTs() ?? b.rootEvent?.getTs() ?? 0;
      return bTime - aTime;
    });

    if (sortOrder === 'unread') {
      const seen = threadLastSeen;
      const isUnread = (th: (typeof all)[number]) => {
        const rootId = th.id;
        const lastReplyId = th.lastReply()?.getId();
        const lastSeen = seen[rootId];
        return lastSeen === undefined || (lastReplyId !== undefined && lastReplyId !== lastSeen);
      };
      sorted.sort((a, b) => {
        const aUnread = isUnread(a);
        const bUnread = isUnread(b);
        if (aUnread && !bUnread) return -1;
        if (!aUnread && bUnread) return 1;
        const aTime = a.lastReply()?.getTs() ?? a.rootEvent?.getTs() ?? 0;
        const bTime = b.lastReply()?.getTs() ?? b.rootEvent?.getTs() ?? 0;
        return bTime - aTime;
      });
    }

    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, filter, sortOrder, threadLastSeen, version]);

  return (
    <aside
      className={`${css.threadListPanel}${className ? ` ${className}` : ''}${expanded ? ` ${css.threadListPanelExpanded}` : ''}`}
      aria-label={t('timeline.threads')}
      style={isDesktop && !expanded ? { width: `${threadPanelWidth}px` } : undefined}
    >
      {isDesktop && !expanded && (
        <PanelResizer
          width={threadPanelWidth}
          onWidthChange={setThreadPanelWidth}
          defaultWidth={THREAD_PANEL_WIDTH_DEFAULT}
          min={THREAD_PANEL_WIDTH_MIN}
          max={THREAD_PANEL_WIDTH_MAX}
        />
      )}
      <div className={css.threadListHeader}>
        <h2 className={css.threadListTitle}>{t('timeline.threads')}</h2>
        {isDesktop && (
          <Tooltip content={expanded ? t('common.collapse') : t('common.expand')}>
            <button
              type="button"
              className={css.threadListClose}
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? t('common.collapse') : t('common.expand')}
            >
              {expanded ? <ArrowsInSimpleIcon size={16} /> : <ArrowsOutSimpleIcon size={16} />}
            </button>
          </Tooltip>
        )}
        <button
          type="button"
          className={css.threadListClose}
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <XIcon size={16} />
        </button>
      </div>

      <div className={css.threadFilterBar}>
        <SelectButton
          icon={<FunnelIcon size={14} weight={filter !== 'all' ? 'fill' : 'regular'} />}
          value={filter}
          options={[
            { value: 'all', label: t('timeline.threadsAll') },
            { value: 'my', label: t('timeline.threadsMy') },
          ]}
          active={filter !== 'all'}
          title={t('timeline.threadsFilter')}
          onChange={(v) => setFilter(v)}
        />
        <SelectButton
          icon={<ArrowsDownUpIcon size={14} weight={sortOrder !== 'latest' ? 'fill' : 'regular'} />}
          value={sortOrder}
          options={[
            { value: 'latest', label: t('timeline.sortLatest') },
            { value: 'unread', label: t('timeline.sortUnreadFirst') },
          ]}
          active={sortOrder !== 'latest'}
          title={t('timeline.sortTitle')}
          onChange={(v) => setSortOrder(v)}
        />
        <Tooltip content={t('timeline.markAllRead')}>
          <button
            type="button"
            className={css.toolbarIconBtn}
            disabled={!hasAnyUnread}
            onClick={() => {
              if (!hasAnyUnread) return;
              const newSeen: Record<string, string> = { ...threadLastSeen };
              for (const th of threads) {
                const rootId = th.rootEvent?.getId();
                if (!rootId) continue;
                const lastReply = th.lastReply();
                const lastId = lastReply?.getId();
                if (lastId) newSeen[rootId] = lastId;
              }
              setThreadLastSeen(newSeen);
            }}
            aria-label={t('timeline.markAllRead')}
          >
            <EyeIcon size={14} />
          </button>
        </Tooltip>
      </div>

      <div
        className={css.threadListBody}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
            loadMore();
          }
        }}
      >
        {threads.length === 0 ? (
          <div className={css.threadListEmpty}>
            {filter === 'my' ? t('timeline.threadListEmptyMy') : t('timeline.threadListEmpty')}
          </div>
        ) : (
          threads.map((thread) => {
            const rootEvent = thread.rootEvent;
            if (!rootEvent) return null;

            const rootId = rootEvent.getId() ?? '';
            const senderId = rootEvent.getSender() ?? '';
            const member = room?.getMember(senderId);
            const senderName = member?.name ?? formatUserId(senderId);
            const senderAvatar = member?.getMxcAvatarUrl() ?? null;
            const body = rootEvent.isDecryptionFailure()
              ? t('timeline.couldNotDecrypt')
              : ((rootEvent.getContent()?.body as string) ?? '');
            const rootIsUndecryptable = rootEvent.isDecryptionFailure();
            const lastReply = thread.lastReply();
            const lastTs = lastReply?.getTs() ?? rootEvent.getTs();
            const lastReplyId = lastReply?.getId();
            const unread = hasNewReplies(rootId, lastReplyId);

            return (
              <div
                key={rootId}
                className={css.threadListItem}
                role="button"
                tabIndex={0}
                onClick={() => onSelectThread(rootEvent)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectThread(rootEvent);
                  }
                }}
              >
                <div className={css.threadItemAvatar}>
                  <Avatar name={senderName} mxcUrl={senderAvatar} client={client} size="sm" />
                </div>
                <div className={css.threadItemContent}>
                  <div className={css.threadItemMeta}>
                    <span className={css.threadItemSender}>{senderName}</span>
                    <span className={css.threadItemTime}>
                      {relativeTime(lastTs, i18n.language)}
                    </span>
                  </div>
                  <div className={css.threadItemBody}>
                    {rootIsUndecryptable ? (
                      <span className={css.threadItemBodyUndecryptable}>
                        <LockIcon size={12} /> {body}
                      </span>
                    ) : (
                      body
                    )}
                  </div>
                  <div className={css.threadItemFooter}>
                    <span className={css.threadItemReplyCount}>
                      <ChatDotsIcon size={12} />
                      {thread.length}
                    </span>
                    {unread && <span className={css.threadItemUnreadDot} />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
