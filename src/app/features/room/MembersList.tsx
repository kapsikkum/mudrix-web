import { memo, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { MagnifyingGlassIcon, UsersIcon, ArrowsDownUpIcon } from '@phosphor-icons/react';
import { currentRoomIdAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { useMembers } from './useMembers';
import type { MemberEntry } from './useMembers';
import * as css from './MembersList.css';

type PermissionFilter = 'all' | 'admin' | 'moderator' | 'member';
type SortOrder = 'az' | 'za';

const STORAGE_KEY = 'wizardchat.membersPanel';

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
}: {
  member: MemberEntry;
  client: ReturnType<typeof getMatrixClientOrNull>;
}) {
  return (
    <div className={css.memberRow} title={member.userId}>
      <Avatar
        name={member.displayName}
        mxcUrl={member.avatarMxc}
        client={client ?? undefined}
        size="sm"
      />
      <span className={css.memberName}>{member.displayName}</span>
    </div>
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
    <div className={css.selectBtnWrap} title={title}>
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
  );
}

export function MembersList() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const roomId = useAtomValue(currentRoomIdAtom);
  const members = useMembers(client, roomId);

  const [query, setQuery] = useState('');
  const [{ filter, sort }, setPersistedState] = useState<PersistedState>(loadPersistedState);

  function updatePersisted(next: Partial<PersistedState>) {
    setPersistedState((prev) => {
      const merged = { ...prev, ...next };
      savePersistedState(merged);
      return merged;
    });
  }

  const displayedMembers = useMemo(() => {
    let result = members;

    if (filter !== 'all') {
      result = result.filter((m) => matchesFilter(m, filter));
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
  }, [members, filter, query, sort]);

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

        <SelectButton
          icon={<UsersIcon size={14} weight={filter !== 'all' ? 'fill' : 'regular'} />}
          value={filter}
          options={filterOptions}
          active={filter !== 'all'}
          title={t('room.members.filterTitle')}
          onChange={(v) => updatePersisted({ filter: v })}
        />

        <SelectButton
          icon={<ArrowsDownUpIcon size={14} />}
          value={sort}
          options={sortOptions}
          active={sort !== 'az'}
          title={t('room.members.sortTitle')}
          onChange={(v) => updatePersisted({ sort: v })}
        />
      </div>

      {displayedMembers.length === 0 ? (
        <div className={css.emptyState}>
          {query.trim() || filter !== 'all' ? t('room.members.noResults') : t('room.noMembers')}
        </div>
      ) : (
        displayedMembers.map((m) => <MemberRow key={m.userId} member={m} client={client} />)
      )}
    </div>
  );
}
