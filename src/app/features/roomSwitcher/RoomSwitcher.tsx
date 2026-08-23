import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  HashStraightIcon,
  SpeakerHighIcon,
  StackIcon,
  CubeIcon,
} from '@phosphor-icons/react';
import { EventType, NotificationCountType } from 'matrix-js-sdk';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId, isDmRoom, isSpace, isVoiceRoom, roomState } from '@/util/matrix';
import { MODIFIER_KEY } from '@/app/util/platform';
import { roomSwitcherOpenAtom, addRoomToSpaceAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Avatar } from '@/app/components/Avatar';
import { Dialog } from '@/app/components/Dialog/Dialog';
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

function pickerEligible(
  client: MatrixClient,
  spaceId: string,
  type: 'room' | 'subspace'
): Set<string> {
  const eligible = new Set<string>();
  const space = client.getRoom(spaceId);
  if (!space) return eligible;

  const childState = roomState(space).getStateEvents(EventType.SpaceChild);
  const childIds = new Set<string>();
  for (const ev of Array.isArray(childState) ? childState : [childState]) {
    const key = ev?.getStateKey();
    if (key) childIds.add(key);
  }

  const ancestorIds = new Set<string>();
  if (type === 'subspace') {
    let cur = spaceId;
    for (let i = 0; i < 20; i++) {
      const curRoom = client.getRoom(cur);
      if (!curRoom) break;
      const parentEvents = roomState(curRoom).getStateEvents(EventType.SpaceParent);
      const parents = Array.isArray(parentEvents) ? parentEvents : [parentEvents];
      let found: string | null = null;
      for (const ev of parents) {
        const parentId = ev?.getStateKey();
        if (parentId && ev?.getContent()?.canonical) {
          found = parentId;
          break;
        }
      }
      if (!found) break;
      ancestorIds.add(found);
      cur = found;
    }
  }

  const joinedOrInvited = new Set(['join', 'invite']);
  for (const room of client.getRooms()) {
    if (!joinedOrInvited.has(room.getMyMembership())) continue;
    if (room.roomId === spaceId) continue;
    if (childIds.has(room.roomId)) continue;
    if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;

    if (type === 'room') {
      if (isSpace(room)) continue;
    } else {
      if (!isSpace(room)) continue;
      if (ancestorIds.has(room.roomId)) continue;
    }
    eligible.add(room.roomId);
  }
  return eligible;
}

async function addToSpace(
  entry: RoomEntry,
  addState: {
    spaceId: string;
    spaceName: string;
    type?: 'room' | 'subspace';
  },
  toast: ReturnType<typeof useToast>,
  setLoadingId: (id: string | null) => void,
  setAddState: (state: null) => void,
  t: (key: string, opts?: Record<string, unknown>) => string
) {
  const client = getMatrixClientOrNull();
  if (!client) return;
  setLoadingId(entry.roomId);
  const isSubspace = addState.type === 'subspace';
  const successKey = isSubspace
    ? 'room.space.addExistingSubSpaceSuccess'
    : 'room.space.addExistingRoomSuccess';
  const failKey = isSubspace
    ? 'room.space.addExistingSubSpaceFailed'
    : 'room.space.addExistingRoomFailed';
  try {
    const domain = client.getDomain() ?? '';
    await client.sendStateEvent(
      addState.spaceId,
      EventType.SpaceChild,
      { suggested: false, via: [domain] },
      entry.roomId
    );
    toast.success(t(successKey, { name: entry.name }));
    setAddState(null);
  } catch (err) {
    toast.error(t(failKey, { error: getErrorMessage(err) }));
  } finally {
    setLoadingId(null);
  }
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
  const toast = useToast();
  const [open, setOpen] = useAtom(roomSwitcherOpenAtom);
  const [addState, setAddState] = useAtom(addRoomToSpaceAtom);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const listboxId = useId();

  const client = getMatrixClientOrNull();

  const inPickerMode = addState?.open === true;
  const isSubspace = inPickerMode && addState.type === 'subspace';
  const spaceId = inPickerMode ? addState.spaceId : '';
  const spaceName = inPickerMode ? addState.spaceName : '';

  const close = useCallback(() => {
    if (addState?.open) setAddState(null);
    else setOpen(false);
    setQuery('');
    setHighlightedIndex(0);
    setLoadingId(null);
  }, [setOpen, setAddState, addState]);

  const select = useCallback(
    (entry: RoomEntry) => {
      if (addState?.open) {
        void addToSpace(entry, addState, toast, setLoadingId, setAddState, t);
      } else {
        const path = entry.kind === 'space' ? '/space/' : entry.kind === 'dm' ? '/dm/' : '/r/';
        navigate(path + encodeURIComponent(entry.roomId));
        close();
      }
    },
    [addState, navigate, close, toast, setAddState, t]
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

    if (inPickerMode) {
      if (!client || !spaceId) return [];
      const eligible = pickerEligible(client, spaceId, isSubspace ? 'subspace' : 'room');
      const matchesKind = (e: RoomEntry) => (isSubspace ? e.kind === 'space' : e.kind === 'room');
      return entries
        .filter((e) => eligible.has(e.roomId))
        .filter(matchesKind)
        .filter(matchesScope)
        .filter(matchesText)
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (!searchText) {
      return [...entries].filter(matchesScope).sort(byActivity).slice(0, 15);
    }
    return entries
      .filter(matchesScope)
      .filter(matchesText)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, scope, searchText, inPickerMode, client, spaceId, isSubspace]);

  const dialogOpen = open || addState?.open === true;

  useEffect(() => {
    if (!dialogOpen) return;
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
  }, [dialogOpen, displayed, highlightedIndex, close, select]);

  useEffect(() => {
    if (!dialogOpen) return;
    setHighlightedIndex(0);
    setQuery('');
  }, [dialogOpen]);

  useEffect(() => {
    const el = resultsRef.current?.querySelector('[data-highlighted="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  if (!dialogOpen) return null;

  return (
    <Dialog
      open={dialogOpen}
      onClose={close}
      size="lg"
      zIndex={9500}
      bodyClassName={css.dialogBody}
      title={
        inPickerMode
          ? t(isSubspace ? 'room.space.addExistingSubSpace' : 'room.space.addExistingRoom', {
              name: spaceName,
            })
          : undefined
      }
      titleIcon={inPickerMode ? <CubeIcon size={18} /> : undefined}
    >
      <div className={css.searchBar}>
        <MagnifyingGlassIcon size={18} className={css.searchIcon} />
        <input
          className={css.searchInput}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={
            displayed.length > 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
          }
          placeholder={
            inPickerMode
              ? t(
                  isSubspace
                    ? 'room.space.addExistingSubSpaceSearchPlaceholder'
                    : 'room.space.addExistingRoomSearchPlaceholder'
                )
              : t('roomSwitcher.placeholder', { mod: MODIFIER_KEY })
          }
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
          data-dialog-autofocus
        />
      </div>
      <div className={css.results} ref={resultsRef} id={listboxId} role="listbox">
        {displayed.length === 0 ? (
          <div className={css.emptyState}>
            {inPickerMode
              ? query
                ? t(
                    isSubspace
                      ? 'room.space.addExistingSubSpaceNoResults'
                      : 'room.space.addExistingRoomNoResults'
                  )
                : t(
                    isSubspace
                      ? 'room.space.addExistingSubSpaceEmpty'
                      : 'room.space.addExistingRoomEmpty'
                  )
              : t('roomSwitcher.noResults')}
          </div>
        ) : (
          displayed.map((entry, idx) => {
            const isPending = loadingId === entry.roomId;
            const entryClass = `${css.resultItem}${isPending ? ` ${css.resultItemLoading}` : ''}`;
            return (
              <div
                key={entry.roomId}
                id={`${listboxId}-option-${idx}`}
                role="option"
                aria-selected={idx === highlightedIndex}
                aria-disabled={isPending}
                tabIndex={-1}
                className={entryClass}
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
                {!inPickerMode && entry.highlight && entry.unread > 0 && (
                  <span className={css.resultBadgeNotif}>
                    {entry.unread > 99 ? '99+' : entry.unread}
                  </span>
                )}
                {!inPickerMode && !entry.highlight && entry.unread > 0 && (
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
        {!inPickerMode && (
          <>
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
          </>
        )}
      </div>
    </Dialog>
  );
}
