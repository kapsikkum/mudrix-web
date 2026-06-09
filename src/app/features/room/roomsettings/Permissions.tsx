import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LockIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { Input } from '@/app/components/Input';
import { useToast } from '@/app/hooks/useToast';
import { useMembers } from '@/app/features/room/useMembers';
import type { MemberEntry } from '@/app/features/room/useMembers';
import { getErrorMessage } from '@/util/error';
import * as css from '@/app/components/Settings/Settings.css';

function powerLevelLabel(level: number, t: (key: string) => string): string {
  if (level >= 100) return t('room.settings.members.admin');
  if (level >= 50) return t('room.settings.members.moderator');
  return t('room.settings.members.member');
}

function powerLevelBadgeClass(
  level: number,
  styles: { permLevelAdmin: string; permLevelMod: string; permLevelMember: string }
): string {
  if (level >= 100) return styles.permLevelAdmin;
  if (level >= 50) return styles.permLevelMod;
  return styles.permLevelMember;
}

interface PermissionsPanelProps {
  roomId: string;
}

const INITIAL_VISIBLE = 10;

export function PermissionsPanel({ roomId }: PermissionsPanelProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const myUserId = client?.getUserId() ?? '';
  const { members: allMembers } = useMembers(client, roomId);
  const room = client?.getRoom(roomId) ?? null;
  const myLevel = room?.getMember(myUserId)?.powerLevel ?? 0;
  const isAdmin = myLevel >= 100;

  const [query, setQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map());
  const [applying, setApplying] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const groups: { label: string; key: string; members: MemberEntry[] }[] = [
      { label: t('room.settings.members.admin'), key: 'admin', members: [] },
      { label: t('room.settings.members.moderator'), key: 'moderator', members: [] },
      { label: t('room.settings.members.member'), key: 'member', members: [] },
    ];

    for (const m of allMembers) {
      if (m.powerLevel >= 100) groups[0].members.push(m);
      else if (m.powerLevel >= 50) groups[1].members.push(m);
      else groups[2].members.push(m);
    }

    return groups;
  }, [allMembers, t]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allMembers.filter(
      (m) => m.displayName.toLowerCase().includes(q) || m.userId.toLowerCase().includes(q)
    );
  }, [allMembers, query]);

  const handleChange = (userId: string, newLevel: number) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      next.set(userId, newLevel);
      return next;
    });
  };

  const handleApply = async (userId: string, newLevel: number) => {
    if (!client) return;
    setApplying(true);
    try {
      await client.setPowerLevel(roomId, userId, newLevel);
      toast.success(
        t('room.settings.members.permissionsApplySuccess', {
          name: allMembers.find((m) => m.userId === userId)?.displayName ?? userId,
          level: powerLevelLabel(newLevel, t),
        })
      );
      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    } catch (err) {
      toast.error(
        t('room.settings.members.permissionsApplyFailed', { error: getErrorMessage(err) })
      );
    } finally {
      setApplying(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderMemberRow = (m: MemberEntry) => {
    const pendingLevel = pendingChanges.get(m.userId);
    const currentLevel = pendingLevel ?? m.powerLevel;

    return (
      <div key={m.userId} className={css.permRow}>
        <Avatar name={m.displayName} mxcUrl={m.avatarMxc} client={client ?? undefined} size="sm" />
        <div className={css.permRowName}>
          <div>{m.displayName}</div>
          <div className={css.permRowId}>{m.userId}</div>
        </div>
        {isAdmin ? (
          <>
            <select
              className={css.permRowSelect}
              value={currentLevel}
              onChange={(e) => handleChange(m.userId, Number(e.target.value))}
            >
              <option value={0}>{t('room.settings.members.member')} (0)</option>
              <option value={50}>{t('room.settings.members.moderator')} (50)</option>
              <option value={100}>{t('room.settings.members.admin')} (100)</option>
            </select>
            {pendingLevel !== undefined && pendingLevel !== m.powerLevel && (
              <button
                className={css.permRowApply}
                disabled={applying}
                onClick={() => handleApply(m.userId, pendingLevel)}
              >
                {t('common.apply')}
              </button>
            )}
          </>
        ) : (
          <span className={powerLevelBadgeClass(m.powerLevel, css)}>
            {powerLevelLabel(m.powerLevel, t)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('room.settings.members.title')}</h2>

      {!isAdmin && (
        <div className={css.readOnlyNote}>
          <LockIcon size={14} />
          {t('room.settings.readOnlyPermissions')}
        </div>
      )}

      <div className={css.section}>
        <div className={css.permSearchRow}>
          <div className={css.permSearchWrap}>
            <Input
              label={t('room.settings.members.searchMembers')}
              placeholder={t('room.settings.members.searchMembersPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {searchResults !== null ? (
          searchResults.length === 0 ? (
            <div className={css.noResults}>{t('room.settings.members.noMembersFound')}</div>
          ) : (
            <div className={css.permResults}>{searchResults.map(renderMemberRow)}</div>
          )
        ) : (
          grouped.map((group) => {
            if (group.members.length === 0) return null;
            const isExpanded = expanded.has(group.key);
            const showCount = isExpanded ? group.members.length : INITIAL_VISIBLE;
            const hidden = group.members.length - showCount;
            const visible = group.members.slice(0, showCount);

            return (
              <div key={group.key}>
                <div className={css.permGroupHeader}>
                  {group.label}
                  <span className={css.permGroupBadge}>{group.members.length}</span>
                </div>
                {visible.map(renderMemberRow)}
                {hidden > 0 && (
                  <button className={css.permShowMore} onClick={() => toggleExpand(group.key)}>
                    {t('room.settings.members.showMore', { count: hidden })}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
