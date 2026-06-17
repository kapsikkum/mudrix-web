import { useState, useEffect, useRef, useCallback } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  PushPinIcon,
  XIcon,
  MagnifyingGlassIcon,
  CaretUpIcon,
  CaretDownIcon,
  PhoneIcon,
  HashStraightIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { Tooltip } from '@/app/components/Tooltip';
import { membersPanelOpenAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { MODIFIER_KEY } from '@/app/util/platform';
import { formatUserId } from '@/util/matrix';
import * as css from './RoomHeader.css';

function usePinnedMessages(client: MatrixClient, roomId: string) {
  const room = client.getRoom(roomId);

  const getPinned = useCallback((): MatrixEvent[] => {
    if (!room) return [];
    const stateEvent = room.currentState.getStateEvents('m.room.pinned_events', '');
    const event = Array.isArray(stateEvent) ? stateEvent[0] : stateEvent;
    const content = event?.getContent() as { pinned?: string[] } | undefined;
    const ids: string[] = content?.pinned ?? [];
    const events: MatrixEvent[] = [];
    for (const id of ids) {
      const ev = room.findEventById(id);
      if (ev) events.push(ev);
    }
    return events;
  }, [room]);

  const [pinned, setPinned] = useState<MatrixEvent[]>(getPinned);

  const refresh = useCallback(() => setPinned(getPinned()), [getPinned]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useMatrixEvent(client, 'RoomState.events', refresh);

  return pinned;
}

interface PinnedPanelProps {
  client: MatrixClient;
  roomId: string;
  onJumpTo: (eventId: string) => void;
  onClose: () => void;
}

function PinnedPanel({ client, roomId, onJumpTo, onClose }: PinnedPanelProps) {
  const { t } = useTranslation();
  const pinned = usePinnedMessages(client, roomId);

  return (
    <div className={css.pinnedPanel}>
      <div className={css.pinnedPanelHeader}>
        <span className={css.pinnedPanelTitle}>
          <PushPinIcon size={14} />
          {t('room.header.pinnedMessages')}
          {pinned.length > 0 && ` (${pinned.length})`}
        </span>
        <button
          type="button"
          className={css.headerBtn}
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <XIcon size={16} />
        </button>
      </div>

      {pinned.length === 0 ? (
        <div className={css.pinnedEmpty}>{t('room.header.noPinnedMessages')}</div>
      ) : (
        [...pinned].reverse().map((ev) => {
          const room = client.getRoom(roomId);
          const senderId = ev.getSender() ?? '';
          const member = room?.getMember(senderId);
          const senderName = member?.name ?? formatUserId(senderId);
          const content = ev.getContent();
          const body: string =
            (content?.body as string) ?? (ev.isRedacted() ? '(deleted)' : '(media)');

          return (
            <div
              key={ev.getId()}
              className={css.pinnedItem}
              role="button"
              tabIndex={0}
              onClick={() => {
                onJumpTo(ev.getId() ?? '');
                onClose();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onJumpTo(ev.getId() ?? '');
                  onClose();
                }
              }}
            >
              <PushPinIcon size={12} className={css.pinnedPin} />
              <div className={css.pinnedContent}>
                <div className={css.pinnedSender}>{senderName}</div>
                <div className={css.pinnedBody} title={body}>
                  {body}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

interface RoomHeaderProps {
  client: MatrixClient;
  roomId: string;
  searchQuery: string;
  searchMatchCount: number;
  searchActiveMatch: number;
  isSearching: boolean;
  onSearchChange: (q: string) => void;
  onSearchNext: () => void;
  onSearchPrev: () => void;
  onSearchClose: () => void;
  onJumpToEvent: (eventId: string) => void;
  onStartCall?: (roomId: string) => void;
  callActive?: boolean;
}

export function RoomHeader({
  client,
  roomId,
  searchQuery,
  searchMatchCount,
  searchActiveMatch,
  isSearching,
  onSearchChange,
  onSearchNext,
  onSearchPrev,
  onSearchClose,
  onJumpToEvent,
  onStartCall,
  callActive = false,
}: RoomHeaderProps) {
  const { t } = useTranslation();
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);
  const room = client.getRoom(roomId);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pinnedEvents = usePinnedMessages(client, roomId);

  // A room is a 1:1 DM if it has exactly 2 joined/invited members and is not a space.
  const isDM = (() => {
    if (!room) return false;
    if (room.isSpaceRoom()) return false;
    const members = room
      .getMembers()
      .filter((m) => ['join', 'invite'].includes(m.membership ?? ''));
    return members.length === 2;
  })();

  // Ctrl+F / Cmd+F opens search
  useEffect(() => {
    const handler = () => setShowSearch(true);
    window.addEventListener('wizard:openSearch', handler);
    return () => window.removeEventListener('wizard:openSearch', handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      onSearchClose();
    }
  }, [showSearch, onSearchClose]);

  // Close pinned panel on outside click
  const panelRef = useRef<HTMLDivElement>(null);
  const pinnedBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!showPinned) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        pinnedBtnRef.current &&
        !pinnedBtnRef.current.contains(target)
      ) {
        setShowPinned(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPinned]);

  const roomName = room?.name ?? roomId;
  const topic =
    room?.currentState
      .getStateEvents('m.room.topic', '')
      ?.getContent<{ topic?: string }>()
      ?.topic?.trim() ?? '';

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSearch(false);
    } else if (e.key === 'Enter') {
      if (e.shiftKey) onSearchPrev();
      else onSearchNext();
    }
  };

  return (
    <div className={css.headerWrapper}>
      {/* Main header bar */}
      <div className={css.header}>
        <div className={css.nameContainer}>
          <HashStraightIcon size={16} className={css.roomIcon} />
          <Tooltip content={roomId}>
            <span className={css.roomName}>{roomName}</span>
          </Tooltip>
          {topic && (
            <>
              <span className={css.topicDivider} />
              <Tooltip content={topic}>
                <span className={css.topicText}>{topic}</span>
              </Tooltip>
            </>
          )}
        </div>

        {/* Call button — only visible for 1:1 DMs */}
        {isDM && onStartCall && (
          <Tooltip content={callActive ? t('voice.callActive') : t('voice.startCall')}>
            <button
              type="button"
              className={callActive ? css.headerBtnActive : css.headerBtn}
              aria-label={callActive ? t('voice.callActive') : t('voice.startCall')}
              onClick={() => onStartCall(roomId)}
              disabled={callActive}
            >
              <PhoneIcon size={16} weight={callActive ? 'fill' : 'regular'} />
            </button>
          </Tooltip>
        )}

        {/* Pinned button */}
        <Tooltip
          content={`${t('room.header.pinnedMessages')}${pinnedEvents.length > 0 ? ` (${pinnedEvents.length})` : ''}`}
        >
          <button
            type="button"
            ref={pinnedBtnRef}
            className={showPinned ? css.headerBtnActive : css.headerBtn}
            aria-label={`${t('room.header.pinnedMessages')}${pinnedEvents.length > 0 ? ` (${pinnedEvents.length})` : ''}`}
            onClick={() => {
              setShowPinned((v) => !v);
              setShowSearch(false);
            }}
          >
            <PushPinIcon size={16} weight={showPinned ? 'fill' : 'regular'} />
            {pinnedEvents.length > 0 && <span className={css.notifDot} />}
          </button>
        </Tooltip>

        {/* Search button */}
        <Tooltip content={t('room.header.searchMessagesShortcut', { mod: MODIFIER_KEY })}>
          <button
            type="button"
            className={showSearch ? css.headerBtnActive : css.headerBtn}
            aria-label={t('room.header.searchMessagesShortcut', { mod: MODIFIER_KEY })}
            onClick={() => {
              setShowSearch((v) => !v);
              setShowPinned(false);
            }}
          >
            <MagnifyingGlassIcon size={16} weight={showSearch ? 'fill' : 'regular'} />
          </button>
        </Tooltip>

        <div className={css.headerDivider} />

        {/* Members toggle button */}
        <Tooltip content={t('common.members')}>
          <button
            type="button"
            className={css.headerBtn}
            aria-label={t('common.members')}
            onClick={() => toggleMembersPanel((v) => !v)}
          >
            <UsersIcon size={16} weight="regular" />
          </button>
        </Tooltip>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className={css.searchBar}>
          <div className={css.searchInputWrap}>
            <MagnifyingGlassIcon size={14} className={css.searchIcon} />
            <input
              ref={searchInputRef}
              className={css.searchInput}
              placeholder={t('room.header.searchMessages')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>

          {isSearching && (
            <>
              <span className={css.searchCount}>
                {searchMatchCount === 0
                  ? t('room.header.noResults')
                  : t('room.header.searchResultCount', {
                      active: searchActiveMatch + 1,
                      total: searchMatchCount,
                    })}
              </span>
              <button
                type="button"
                className={css.searchNavBtn}
                onClick={onSearchPrev}
                disabled={searchMatchCount === 0}
                aria-label={t('room.header.prevMatch')}
              >
                <CaretUpIcon size={16} />
              </button>
              <button
                type="button"
                className={css.searchNavBtn}
                onClick={onSearchNext}
                disabled={searchMatchCount === 0}
                aria-label={t('room.header.nextMatch')}
              >
                <CaretDownIcon size={16} />
              </button>
            </>
          )}

          <button
            type="button"
            className={css.searchCloseBtn}
            onClick={() => setShowSearch(false)}
            aria-label={t('common.close')}
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {/* Pinned panel */}
      {showPinned && (
        <div ref={panelRef}>
          <PinnedPanel
            client={client}
            roomId={roomId}
            onJumpTo={onJumpToEvent}
            onClose={() => setShowPinned(false)}
          />
        </div>
      )}
    </div>
  );
}
