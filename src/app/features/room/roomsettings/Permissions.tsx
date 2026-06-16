import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { LockIcon, SignOutIcon, ProhibitInsetIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { Input } from '@/app/components/Input';
import { IconButton } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import { useMembers } from '@/app/features/room/useMembers';
import type { MemberEntry } from '@/app/features/room/useMembers';
import { promptModalAtom } from '@/app/store/atoms';
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
  const setPrompt = useSetAtom(promptModalAtom);
  const myUserId = client?.getUserId() ?? '';
  const { members: allMembers } = useMembers(client, roomId);
  const room = client?.getRoom(roomId) ?? null;
  const myLevel = room?.getMember(myUserId)?.powerLevel ?? 0;
  const isAdmin = myLevel >= 100;
  const powerLevelsEvent = room?.currentState?.getStateEvents('m.room.power_levels', '');
  const plContent = powerLevelsEvent?.getContent() ?? {};
  const kickThreshold = plContent.kick ?? 50;
  const banThreshold = plContent.ban ?? 50;

  const [query, setQuery] = useState('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, number>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleKickMember = useCallback(
    async (member: MemberEntry) => {
      if (!client) return;
      const reason = await new Promise<string | null>((resolve) => {
        setPrompt({
          open: true,
          title: t('room.members.kickConfirm', { name: member.displayName }),
          message: t('room.members.reasonLabel'),
          defaultValue: '',
          resolve,
        });
      });
      if (reason === null) return;
      try {
        await client.kick(roomId, member.userId, reason || undefined);
        toast.success(t('room.members.kickSuccess', { name: member.displayName }));
      } catch (err) {
        toast.error(t('room.members.kickFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, roomId, toast, t, setPrompt]
  );

  const handleBanMember = useCallback(
    async (member: MemberEntry) => {
      if (!client) return;
      const reason = await new Promise<string | null>((resolve) => {
        setPrompt({
          open: true,
          title: t('room.members.banConfirm', { name: member.displayName }),
          message: t('room.members.reasonLabel'),
          defaultValue: '',
          resolve,
        });
      });
      if (reason === null) return;
      try {
        await client.ban(roomId, member.userId, reason || undefined);
        toast.success(t('room.members.banSuccess', { name: member.displayName }));
      } catch (err) {
        toast.error(t('room.members.banFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, roomId, toast, t, setPrompt]
  );

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

    const canKick = myLevel >= kickThreshold && myLevel > m.powerLevel && m.userId !== myUserId;
    const canBan = myLevel >= banThreshold && myLevel > m.powerLevel && m.userId !== myUserId;

    return (
      <div key={m.userId} className={css.permRow}>
        <Avatar name={m.displayName} mxcUrl={m.avatarMxc} client={client ?? undefined} size="sm" />
        <div className={css.permRowName}>
          <div>{m.displayName}</div>
          <div className={css.permRowId}>{m.userId}</div>
        </div>
        {canKick && (
          <IconButton
            size="xs"
            danger
            onClick={() => handleKickMember(m)}
            title={t('room.members.kick')}
          >
            <SignOutIcon size={14} />
          </IconButton>
        )}
        {canBan && (
          <IconButton
            size="xs"
            danger
            onClick={() => handleBanMember(m)}
            title={t('room.members.ban')}
          >
            <ProhibitInsetIcon size={14} />
          </IconButton>
        )}
        {isAdmin ? (
          <div className={css.permSelectWrap}>
            <span className={powerLevelBadgeClass(currentLevel, css)}>
              {powerLevelLabel(currentLevel, t)}
            </span>
            <select
              className={css.permSelectHidden}
              value={currentLevel}
              onChange={async (e) => {
                if (!client) return;
                const newLevel = Number(e.target.value);
                const prevLevel = m.powerLevel;
                setPendingChanges((prev) => {
                  const next = new Map(prev);
                  next.set(m.userId, newLevel);
                  return next;
                });
                try {
                  await client.setPowerLevel(roomId, m.userId, newLevel);
                  toast.success(
                    t('room.settings.members.permissionsApplySuccess', {
                      name: m.displayName,
                      level: e.target.options[e.target.selectedIndex].text,
                    })
                  );
                  setPendingChanges((prev) => {
                    const next = new Map(prev);
                    next.delete(m.userId);
                    return next;
                  });
                } catch (err) {
                  toast.error(
                    t('room.settings.members.permissionsApplyFailed', {
                      error: getErrorMessage(err),
                    })
                  );
                  setPendingChanges((prev) => {
                    const next = new Map(prev);
                    next.set(m.userId, prevLevel);
                    return next;
                  });
                }
              }}
            >
              <option value={100}>{t('room.settings.members.admin')}</option>
              <option value={50}>{t('room.settings.members.moderator')}</option>
              <option value={0}>{t('room.settings.members.member')}</option>
            </select>
          </div>
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
      <h2 className={css.panelTitle}>{t('common.members')}</h2>

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
