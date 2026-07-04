import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { MagnifyingGlassIcon, UserIcon, HashIcon } from '@phosphor-icons/react';
import { NotificationCountType } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId, isDmRoom, isSpace, roomState } from '@/util/matrix';
import { MODIFIER_KEY } from '@/app/util/platform';
import { roomSwitcherOpenAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import * as css from './RoomSwitcher.css';

type RoomEntry = {
  roomId: string;
  name: string;
  isDm: boolean;
  unread: number;
  highlight: boolean;
};

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
      const path = entry.isDm ? '/dm/' : '/r/';
      navigate(path + encodeURIComponent(entry.roomId));
      close();
    },
    [navigate, close]
  );

  const getRooms = useCallback((): { dms: RoomEntry[]; channels: RoomEntry[] } => {
    if (!client) return { dms: [], channels: [] };
    const allRooms = client.getRooms();
    const joinedOrInvited = new Set(['join', 'invite']);
    const dms: RoomEntry[] = [];
    const channels: RoomEntry[] = [];
    for (const room of allRooms) {
      if (!joinedOrInvited.has(room.getMyMembership())) continue;
      if (isSpace(room)) continue;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;
      const dm = isDmRoom(room, client);
      const name = dm
        ? (() => {
            const inviter = room.getDMInviter();
            if (inviter) {
              const member = room.getMember(inviter);
              return member?.name || formatUserId(inviter);
            }
            return room.name || '(unknown)';
          })()
        : room.name || '(unknown)';
      const unread = room.getUnreadNotificationCount(NotificationCountType.Total) ?? 0;
      const highlight = (room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0) > 0;
      const entry: RoomEntry = { roomId: room.roomId, name, isDm: dm, unread, highlight };
      if (dm) dms.push(entry);
      else channels.push(entry);
    }
    dms.sort((a, b) => a.name.localeCompare(b.name));
    channels.sort((a, b) => a.name.localeCompare(b.name));
    return { dms, channels };
  }, [client]);

  const [rooms, setRooms] = useState(() => getRooms());

  const getRoomsRef = useRef(getRooms);
  getRoomsRef.current = getRooms;
  const refresh = useCallback(() => setRooms(getRoomsRef.current()), []);

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'sync', refresh);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q)
      return {
        dms: rooms.dms,
        channels: rooms.channels,
        flat: [...rooms.dms, ...rooms.channels],
      } as { dms: RoomEntry[]; channels: RoomEntry[]; flat: RoomEntry[] };
    const filter = (list: RoomEntry[]) => list.filter((r) => r.name.toLowerCase().includes(q));
    const dms = filter(rooms.dms);
    const channels = filter(rooms.channels);
    return { dms, channels, flat: [...dms, ...channels] };
  }, [query, rooms]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.flat.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const entry = filtered.flat[highlightedIndex];
        if (entry) {
          select(entry);
        }
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, filtered, highlightedIndex, close, select]);

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

  const renderSection = (label: string, items: RoomEntry[]) => {
    if (items.length === 0) return null;
    return (
      <>
        <div className={css.sectionHeader}>{label}</div>
        {items.map((entry) => {
          const idx = filtered.flat.indexOf(entry);
          return (
            <div
              key={entry.roomId}
              className={css.resultItem}
              data-highlighted={idx === highlightedIndex}
              onClick={() => select(entry)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              {entry.isDm ? (
                <span className={css.dmIcon}>
                  <UserIcon size={16} />
                </span>
              ) : (
                <span className={css.dmIcon}>
                  <HashIcon size={16} />
                </span>
              )}
              <span className={css.resultName}>{entry.name}</span>
              {entry.highlight && entry.unread > 0 && (
                <span className={css.resultBadgeNotif}>
                  {entry.unread > 99 ? '99+' : entry.unread}
                </span>
              )}
              {!entry.highlight && entry.unread > 0 && (
                <span className={css.resultBadge}>{entry.unread > 99 ? '99+' : entry.unread}</span>
              )}
            </div>
          );
        })}
      </>
    );
  };

  const hasResults = filtered.dms.length > 0 || filtered.channels.length > 0;

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
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
            }}
          />
        </div>
        <div className={css.results} ref={resultsRef}>
          {hasResults ? (
            <>
              {renderSection(t('roomSwitcher.directMessages'), filtered.dms)}
              {renderSection(t('roomSwitcher.rooms'), filtered.channels)}
            </>
          ) : (
            <div className={css.emptyState}>{t('roomSwitcher.noResults')}</div>
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
        </div>
      </div>
    </div>
  );
}
