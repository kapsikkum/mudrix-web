import { memo, useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { MagnifyingGlassIcon, UsersIcon, ArrowsDownUpIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { currentRoomIdAtom, userProfileAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { useMembers, useKnockRequests } from './useMembers';
import type { MemberEntry } from './useMembers';
import * as css from './MembersList.css';

type PermissionFilter = 'all' | 'admin' | 'moderator' | 'member' | 'pending';
type SortOrder = 'az' | 'za';

import { STORAGE_KEY_MEMBERS_PANEL } from '@/const/storageKeys';

const STORAGE_KEY = STORAGE_KEY_MEMBERS_PANEL;

interface PersistedState {
  filter: PermissionFilter;
  sort: SortOrder;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedState;
  } catch {
    /* ignore */
  }
  return { filter: 'all', sort: 'az' };
}

function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
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
}: {
  member: MemberEntry;
  client: ReturnType<typeof getMatrixClientOrNull>;
  roomId: string | null;
}) {
  const { t } = useTranslation();
  const setProfile = useSetAtom(userProfileAtom);

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

  return (
    <Tooltip content={member.userId}>
      <div className={css.memberRow} onClick={handleClick} style={{ cursor: 'pointer' }}>
        <Avatar
          name={member.displayName}
          mxcUrl={member.avatarMxc}
          client={client ?? undefined}
          size="sm"
        />
        <span className={css.memberName}>{member.displayName}</span>
        {member.isPending && <span className={css.pendingBadge}>{t('room.members.pending')}</span>}
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
  const { members, loading: membersLoading } = useMembers(client, roomId);
  const { knockRequests, loading: knockLoading } = useKnockRequests(client, roomId);
  const myUserId = client?.getUserId() ?? '';
  const room = client?.getRoom(roomId ?? '');
  const myPowerLevel = room?.getMember(myUserId)?.powerLevel ?? 0;
  const canModerate = myPowerLevel >= 50;

  const [query, setQuery] = useState('');
  const [{ filter, sort }, setPersistedState] = useState<PersistedState>(loadPersistedState);
  const isPendingView = canModerate && filter === 'pending';
  const loading = isPendingView ? knockLoading : membersLoading;

  function updatePersisted(next: Partial<PersistedState>) {
    setPersistedState((prev) => {
      const merged = { ...prev, ...next };
      savePersistedState(merged);
      return merged;
    });
  }

  const displayedMembers = useMemo(() => {
    const isPending = canModerate && filter === 'pending';
    const source = isPending
      ? knockRequests
      : filter === 'all' && canModerate
        ? [...members, ...knockRequests]
        : members;
    let result = source;

    if (!isPending && filter !== 'all') {
      result = result.filter((m) => matchesFilter(m, filter));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (m) => m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q)
      );
    }

    if (!isPending && sort === 'za') {
      result = [...result].reverse();
    }

    return result;
  }, [members, knockRequests, filter, query, sort, canModerate]);

  if (!roomId) return null;

  const filterOptions: { value: PermissionFilter; label: string }[] = [
    { value: 'all', label: t('room.members.filterAll') },
    { value: 'admin', label: t('room.members.admin') },
    { value: 'moderator', label: t('room.members.moderator') },
    { value: 'member', label: t('room.members.member') },
    ...(canModerate ? [{ value: 'pending' as const, label: t('room.members.pending') }] : []),
  ];

  const sortOptions: { value: SortOrder; label: string }[] = [
    { value: 'az', label: t('room.members.sortAZ') },
    { value: 'za', label: t('room.members.sortZA') },
  ];

  return (
    <div>
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
            value={filter}
            options={filterOptions}
            active={filter !== 'all'}
            title={t('room.members.filterTitle')}
            onChange={(v) => updatePersisted({ filter: v })}
          />
          {canModerate && knockRequests.length > 0 && <span className={css.pendingDot} />}
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
          {isPendingView
            ? query.trim()
              ? t('room.members.noResults')
              : t('room.members.noPendingRequests')
            : query.trim() || filter !== 'all'
              ? t('room.members.noResults')
              : t('room.noMembers')}
        </div>
      ) : (
        displayedMembers.map((m) => (
          <MemberRow key={m.userId} member={m} client={client} roomId={roomId} />
        ))
      )}
    </div>
  );
}
