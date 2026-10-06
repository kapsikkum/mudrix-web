import { memo, useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MagnifyingGlassIcon, ArrowsDownUpIcon } from '@phosphor-icons/react';
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
import { Select } from '@/app/components/Select';
import { useSyncReady } from '@/app/hooks/useSync';
import { useMembers } from './useMembers';
import type { MemberEntry } from './useMembers';
import {
  buildRoleSections,
  getRoleKey,
  getRoleRank,
  getRoomCreators,
  isRoleHeader,
} from './memberRoles';
import type { RoleSectionItem } from './memberRoles';
import * as css from './MembersList.css';

type SortOrder = 'az' | 'za';

interface PersistedState {
  sort: SortOrder;
}

const ROLE_HEADER_SIZE = 30;
const MEMBER_ROW_SIZE = 38;

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
  const [{ sort }, setMembersPanelState] = useAtom(membersPanelStateAtom);
  const loading = membersLoading;

  function updatePersisted(next: Partial<PersistedState>) {
    setMembersPanelState((prev) => ({ ...prev, ...next }));
  }

  const room = client?.getRoom(roomId ?? '') ?? null;
  const creators = useMemo(() => getRoomCreators(room), [room]);

  const searchedMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q)
    );
  }, [members, query]);

  const sortedMembers = useMemo(() => {
    const byName =
      sort === 'za'
        ? (a: MemberEntry, b: MemberEntry) => b.displayName.localeCompare(a.displayName)
        : (a: MemberEntry, b: MemberEntry) => a.displayName.localeCompare(b.displayName);

    return [...searchedMembers]
      .sort(byName)
      .sort((a, b) => getRoleRank(getRoleKey(b, creators)) - getRoleRank(getRoleKey(a, creators)));
  }, [searchedMembers, sort, creators]);

  const roleSections = useMemo(
    () => buildRoleSections(sortedMembers, creators, t),
    [sortedMembers, creators, t]
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: roleSections.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) =>
      isRoleHeader(roleSections[index]) ? ROLE_HEADER_SIZE : MEMBER_ROW_SIZE,
    overscan: 5,
  });

  // Reset scroll position when the list content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [roomId, sort, query]);

  if (!roomId) return null;

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

        <Select
          size="sm"
          icon={<ArrowsDownUpIcon size={14} />}
          value={sort}
          options={sortOptions}
          active={sort !== 'az'}
          label={t('room.members.sortTitle')}
          onChange={(v) => updatePersisted({ sort: v })}
        />
      </div>

      {loading && sortedMembers.length === 0 ? (
        <div className={css.skeletonList}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={css.skeletonRow}>
              <div className={css.skeletonAvatar} />
              <div className={css.skeletonLine} />
            </div>
          ))}
        </div>
      ) : sortedMembers.length === 0 ? (
        <div className={css.emptyState}>
          {query.trim() ? t('room.members.noResults') : t('room.noMembers')}
        </div>
      ) : (
        <div ref={scrollRef} className={css.membersScrollArea}>
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item: RoleSectionItem = roleSections[virtualRow.index];
              const rowStyle = {
                position: 'absolute' as const,
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              };

              if (isRoleHeader(item)) {
                return (
                  <div key={`role-${item.roleKey}`} className={css.roleHeader} style={rowStyle}>
                    <span className={css.roleHeaderLabel}>{item.label}</span>
                    <span className={css.roleHeaderCount}>{item.count}</span>
                  </div>
                );
              }

              return (
                <div key={item.member.userId} style={rowStyle}>
                  <MemberRow
                    member={item.member}
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
