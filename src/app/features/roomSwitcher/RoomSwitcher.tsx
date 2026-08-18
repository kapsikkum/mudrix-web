import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  HashStraightIcon,
  SpeakerHighIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { EventType, NotificationCountType } from 'matrix-js-sdk';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId, isDmRoom, isSpace, isVoiceRoom, roomState } from '@/util/matrix';
import { MODIFIER_KEY } from '@/app/util/platform';
import { roomSwitcherOpenAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { Avatar } from '@/app/components/Avatar';
import * as css from './RoomSwitcher.css';

type RoomKind = 'room' | 'dm' | 'space';

type RoomEntry = {
  roomId: string;
  name: string;
  kind: RoomKind;
  isVoice: boolean;
  avatarMxc: string | null;
  unread: number;
  highlight: boolean;
  lastActiveTs: number;
};

function dmPartnerId(room: Room, client: MatrixClient): string | null {
  const dmData = client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();
  if (dmData) {
    for (const [userId, roomIds] of Object.entries(dmData)) {
      if (roomIds.includes(room.roomId)) return userId;
    }
  }
  return room.getDMInviter() ?? null;
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const parts: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;
  let idx: number;
  while ((idx = lower.indexOf(q, cursor)) !== -1) {
    if (idx > cursor) parts.push({ text: text.slice(cursor, idx), highlighted: false });
    parts.push({ text: text.slice(idx, idx + q.length), highlighted: true });
    cursor = idx + q.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });
  return (
    <>
      {parts.map((p, i) =>
        p.highlighted ? (
          <mark key={i} className={css.highlight}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export function RoomSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useAtom(roomSwitcherOpenAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const client = getMatrixClientOrNull();

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setHighlightedIndex(0);
  }, [setOpen]);

  const select = useCallback(
    (entry: RoomEntry) => {
      const path = entry.kind === 'space' ? '/space/' : entry.kind === 'dm' ? '/dm/' : '/r/';
      navigate(path + encodeURIComponent(entry.roomId));
      close();
    },
    [navigate, close]
  );

  const getEntries = useCallback((): RoomEntry[] => {
    if (!client) return [];
    const joinedOrInvited = new Set(['join', 'invite']);
    const entries: RoomEntry[] = [];
    for (const room of client.getRooms()) {
      if (!joinedOrInvited.has(room.getMyMembership())) continue;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;

      const dm = isDmRoom(room, client);
      const space = isSpace(room);

      let name: string;
      let avatarMxc: string | null = null;
      if (dm) {
        const partnerId = dmPartnerId(room, client);
        const member = partnerId ? room.getMember(partnerId) : null;
        name = member?.name || (partnerId ? formatUserId(partnerId) : room.name || '(unknown)');
        avatarMxc = member?.getMxcAvatarUrl() ?? null;
      } else {
        name = room.name || '(unknown)';
        avatarMxc = room.getMxcAvatarUrl?.() ?? null;
      }

      entries.push({
        roomId: room.roomId,
        name,
        kind: space ? 'space' : dm ? 'dm' : 'room',
        isVoice: isVoiceRoom(room),
        avatarMxc,
        unread: room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0,
        highlight: (room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0) > 0,
        lastActiveTs: room.getLastActiveTimestamp(),
      });
    }
    return entries;
  }, [client]);

  const [entries, setEntries] = useState<RoomEntry[]>(() => getEntries());

  const getEntriesRef = useRef(getEntries);
  getEntriesRef.current = getEntries;
  const refresh = useCallback(() => setEntries(getEntriesRef.current()), []);

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'RoomState.events', refresh);
  useMatrixEvent(client, 'sync', refresh);

  const scope = useMemo<'room' | 'dm' | 'space' | null>(() => {
    const prefix = query.match(/^[#@*]/)?.[0];
    if (!prefix) return null;
    return prefix === '#' ? 'room' : prefix === '@' ? 'dm' : 'space';
  }, [query]);

  const searchText = useMemo(
    () =>
      query
        .replace(/^[#@*]/, '')
        .trim()
        .toLowerCase(),
    [query]
  );

  const displayed = useMemo(() => {
    const matchesScope = (e: RoomEntry) => scope === null || e.kind === scope;
    const matchesText = (e: RoomEntry) => !searchText || e.name.toLowerCase().includes(searchText);
    const byActivity = (a: RoomEntry, b: RoomEntry) =>
      Number(b.highlight) - Number(a.highlight) ||
      b.unread - a.unread ||
      b.lastActiveTs - a.lastActiveTs;

    if (!searchText) {
      return [...entries].filter(matchesScope).sort(byActivity).slice(0, 15);
    }
    return entries
      .filter(matchesScope)
      .filter(matchesText)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, scope, searchText]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, displayed.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const entry = displayed[highlightedIndex];
        if (entry) {
          select(entry);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, displayed, highlightedIndex, close, select]);

  useEffect(() => {
    if (!open) return;
    setHighlightedIndex(0);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    const el = resultsRef.current?.querySelector('[data-highlighted="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  if (!open) return null;

  return (
    <div className={css.overlay} onClick={close}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={css.searchBar}>
          <MagnifyingGlassIcon size={18} className={css.searchIcon} />
          <input
            ref={inputRef}
            className={css.searchInput}
            type="text"
            placeholder={t('roomSwitcher.placeholder', { mod: MODIFIER_KEY })}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className={css.results} ref={resultsRef}>
          {displayed.length === 0 ? (
            <div className={css.emptyState}>{t('roomSwitcher.noResults')}</div>
          ) : (
            displayed.map((entry, idx) => {
              return (
                <div
                  key={entry.roomId}
                  className={css.resultItem}
                  data-highlighted={idx === highlightedIndex}
                  onClick={() => select(entry)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  {entry.kind === 'dm' && (
                    <Avatar
                      name={entry.name}
                      mxcUrl={entry.avatarMxc}
                      client={client ?? null}
                      size="sm"
                    />
                  )}
                  {entry.kind === 'room' && (
                    <span className={css.typeIcon}>
                      {entry.isVoice ? (
                        <SpeakerHighIcon size={14} weight="fill" />
                      ) : (
                        <HashStraightIcon size={14} weight="bold" />
                      )}
                    </span>
                  )}
                  {entry.kind === 'space' && (
                    <span className={css.typeIcon}>
                      <StackIcon size={14} weight="bold" />
                    </span>
                  )}
                  <span className={css.resultName}>
                    <HighlightedText text={entry.name} query={searchText} />
                  </span>
                  {entry.highlight && entry.unread > 0 && (
                    <span className={css.resultBadgeNotif}>
                      {entry.unread > 99 ? '99+' : entry.unread}
                    </span>
                  )}
                  {!entry.highlight && entry.unread > 0 && (
                    <span className={css.resultBadge}>
                      {entry.unread > 99 ? '99+' : entry.unread}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className={css.footer}>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>↑</kbd>
            <kbd className={css.kbd}>↓</kbd>
            {t('roomSwitcher.hintNavigate')}
          </span>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>↵</kbd>
            {t('roomSwitcher.hintOpen')}
          </span>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>Esc</kbd>
            {t('roomSwitcher.hintClose')}
          </span>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>#</kbd>
            {t('roomSwitcher.prefixRooms')}
          </span>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>@</kbd>
            {t('roomSwitcher.prefixDms')}
          </span>
          <span className={css.footerHint}>
            <kbd className={css.kbd}>*</kbd>
            {t('roomSwitcher.prefixSpaces')}
          </span>
        </div>
      </div>
    </div>
  );
}
