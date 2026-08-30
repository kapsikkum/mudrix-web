import { memo, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MagnifyingGlassIcon, UsersIcon, ArrowsDownUpIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import {
  currentRoomIdAtom,
  membersPanelStateAtom,
  userProfileAtom,
  showPresenceAtom,
  ownPresenceAtom,
  userIdAtom,
} from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { useSyncReady } from '@/app/hooks/useSync';
import { useMembers } from './useMembers';
import type { MemberEntry } from './useMembers';
import * as css from './MembersList.css';

type PermissionFilter = 'all' | 'admin' | 'moderator' | 'member';
type SortOrder = 'az' | 'za';

interface PersistedState {
  filter: PermissionFilter;
  sort: SortOrder;
}

function matchesFilter(member: MemberEntry, filter: PermissionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'admin') return member.powerLevel >= 100;
  if (filter === 'moderator') return member.powerLevel >= 50 && member.powerLevel < 100;
  return member.powerLevel < 50;
}

const MemberRow = memo(function MemberRow({
  member,
  client,
  roomId,
  showPresence,
  ownPresence,
}: {
  member: MemberEntry;
  client: ReturnType<typeof getMatrixClientOrNull>;
  roomId: string | null;
  showPresence: boolean;
  ownPresence: PresenceState | undefined;
}) {
  const setProfile = useSetAtom(userProfileAtom);
  const localUserId = useAtomValue(userIdAtom);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!roomId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setProfile({
        userId: member.userId,
        roomId,
        anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
    },
    [member.userId, roomId, setProfile]
  );

  const presence = showPresence
    ? member.userId === localUserId
      ? ownPresence
      : member.presence
    : undefined;

  return (
    <Tooltip content={member.userId}>
      <div
        className={css.memberRow}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        style={{ cursor: 'pointer' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
      >
        <Avatar
          name={member.displayName}
          mxcUrl={member.avatarMxc}
          client={client ?? undefined}
          size="sm"
          presence={presence}
        />
        <span className={css.memberName}>{member.displayName}</span>
      </div>
    </Tooltip>
  );
});

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

interface MembersListProps {
  roomId?: string | null;
}

export function MembersList({ roomId: propRoomId }: MembersListProps = {}) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const atomRoomId = useAtomValue(currentRoomIdAtom);
  const roomId = propRoomId ?? atomRoomId;
  const showPresence = useAtomValue(showPresenceAtom);
  const ownPresence = useAtomValue(ownPresenceAtom);
  const syncReady = useSyncReady();
  const ownPresenceGated: PresenceState | undefined =
    showPresence && syncReady ? ownPresence : undefined;
  const { members, loading: membersLoading } = useMembers(client, roomId);

  const [query, setQuery] = useState('');
  const [{ filter, sort }, setMembersPanelState] = useAtom(membersPanelStateAtom);
  const loading = membersLoading;

  function updatePersisted(next: Partial<PersistedState>) {
    setMembersPanelState((prev) => ({ ...prev, ...next }));
  }

  const effectiveFilter = filter === ('pending' as PermissionFilter) ? 'all' : filter;

  const displayedMembers = useMemo(() => {
    let result = members;

    if (effectiveFilter !== 'all') {
      result = result.filter((m) => matchesFilter(m, effectiveFilter));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) => m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q)
      );
    }

    if (sort === 'za') {
      result = [...result].reverse();
    }

    return result;
  }, [members, effectiveFilter, query, sort]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: displayedMembers.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 5,
  });

  // Reset scroll position when the list content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [roomId, filter, sort, query]);

  if (!roomId) return null;

  const filterOptions: { value: PermissionFilter; label: string }[] = [
    { value: 'all', label: t('room.members.filterAll') },
    { value: 'admin', label: t('room.members.admin') },
    { value: 'moderator', label: t('room.members.moderator') },
    { value: 'member', label: t('room.members.member') },
  ];

  const sortOptions: { value: SortOrder; label: string }[] = [
    { value: 'az', label: t('room.members.sortAZ') },
    { value: 'za', label: t('room.members.sortZA') },
  ];

  return (
    <div className={css.membersListContainer}>
      <div className={css.toolbar}>
        <div className={css.searchWrapper}>
          <span className={css.searchIcon}>
            <MagnifyingGlassIcon size={13} />
          </span>
          <input
            className={css.searchInput}
            type="search"
            placeholder={t('room.members.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={css.filterBadgeWrap}>
          <SelectButton
            icon={<UsersIcon size={14} weight={filter !== 'all' ? 'fill' : 'regular'} />}
            value={effectiveFilter}
            options={filterOptions}
            active={filter !== 'all'}
            title={t('room.members.filterTitle')}
            onChange={(v) => updatePersisted({ filter: v })}
          />
        </div>

        <SelectButton
          icon={<ArrowsDownUpIcon size={14} />}
          value={sort}
          options={sortOptions}
          active={sort !== 'az'}
          title={t('room.members.sortTitle')}
          onChange={(v) => updatePersisted({ sort: v })}
        />
      </div>

      {loading && displayedMembers.length === 0 ? (
        <div className={css.skeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={css.skeletonRow}>
              <div className={css.skeletonAvatar} />
              <div className={css.skeletonLine} />
            </div>
          ))}
        </div>
      ) : displayedMembers.length === 0 ? (
        <div className={css.emptyState}>
          {query.trim() || filter !== 'all' ? t('room.members.noResults') : t('room.noMembers')}
        </div>
      ) : (
        <div ref={scrollRef} className={css.membersScrollArea}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const m = displayedMembers[virtualRow.index];
              return (
                <div
                  key={m.userId}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MemberRow
                    member={m}
                    client={client}
                    roomId={roomId}
                    showPresence={showPresence}
                    ownPresence={ownPresenceGated}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
