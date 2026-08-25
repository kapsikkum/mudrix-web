import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { LockIcon, ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { Input } from '@/app/components/Input';
import { IconButton } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import { useMembers, useKnockRequests, useBannedMembers } from '@/app/features/room/useMembers';
import type { MemberEntry } from '@/app/features/room/useMembers';
import { userProfileAtom } from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';
import { getErrorMessage } from '@/util/error';
import * as css from '@/app/components/Settings/Settings.css';

import { roomStateMaybe } from '@/util/matrix';

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
  const confirmDialog = useConfirm();
  const setProfile = useSetAtom(userProfileAtom);
  const myUserId = client?.getUserId() ?? '';
  const { members: allMembers } = useMembers(client, roomId);
  const { knockRequests } = useKnockRequests(client, roomId);
  const { bannedMembers } = useBannedMembers(client, roomId);
  const room = client?.getRoom(roomId) ?? null;
  const myLevel = room?.getMember(myUserId)?.powerLevel ?? 0;
  const canModerate = myLevel >= 50;
  const powerLevelsEvent = roomStateMaybe(room)?.getStateEvents('m.room.power_levels', '');
  const plContent = powerLevelsEvent?.getContent() ?? {};
  const banThreshold = plContent.ban ?? 50;

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [bannedExpanded, setBannedExpanded] = useState(false);
  const [pendingExpanded, setPendingExpanded] = useState(false);

  const handleUnbanMember = useCallback(
    async (member: MemberEntry) => {
      if (!client) return;
      const confirmed = await confirmDialog({
        title: t('room.members.unbanConfirm', { name: member.displayName }),
        message: t('room.members.unbanConfirmMessage', { name: member.displayName }),
      });
      if (!confirmed) return;
      try {
        await client.unban(roomId, member.userId);
        toast.success(t('room.members.unbanSuccess', { name: member.displayName }));
      } catch (err) {
        toast.error(t('room.members.unbanFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, roomId, toast, t, confirmDialog]
  );

  const openProfile = useCallback(
    (member: MemberEntry, e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setProfile({
        userId: member.userId,
        roomId,
        anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
    },
    [roomId, setProfile]
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

  const renderMemberRow = (m: MemberEntry) => (
    <div
      key={m.userId}
      className={css.permRow}
      onClick={(e) => openProfile(m, e)}
      style={{ cursor: 'pointer' }}
    >
      <Avatar name={m.displayName} mxcUrl={m.avatarMxc} client={client ?? undefined} size="sm" />
      <div className={css.permRowName}>
        <div>{m.displayName}</div>
        <div className={css.permRowId}>{m.userId}</div>
      </div>
      <span className={powerLevelBadgeClass(m.powerLevel, css)}>
        {powerLevelLabel(m.powerLevel, t)}
      </span>
    </div>
  );

  const renderPendingRow = (m: MemberEntry) => (
    <div
      key={m.userId}
      className={css.permRow}
      onClick={(e) => openProfile(m, e)}
      style={{ cursor: 'pointer' }}
    >
      <Avatar name={m.displayName} mxcUrl={m.avatarMxc} client={client ?? undefined} size="sm" />
      <div className={css.permRowName}>
        <div>{m.displayName}</div>
        <div className={css.permRowId}>{m.userId}</div>
      </div>
    </div>
  );

  const renderBannedRow = (m: MemberEntry) => (
    <div
      key={m.userId}
      className={css.permRow}
      onClick={(e) => openProfile(m, e)}
      style={{ cursor: 'pointer' }}
    >
      <Avatar name={m.displayName} mxcUrl={m.avatarMxc} client={client ?? undefined} size="sm" />
      <div className={css.permRowName}>
        <div>{m.displayName}</div>
        <div className={css.permRowId}>{m.userId}</div>
      </div>
      <IconButton
        size="xs"
        tooltip={t('room.members.unban')}
        aria-label={t('room.members.unban')}
        onClick={(e) => {
          e.stopPropagation();
          handleUnbanMember(m);
        }}
      >
        <ArrowCounterClockwiseIcon size={14} />
      </IconButton>
    </div>
  );

  return (
    <div>
      <h2 className={css.panelTitle}>{t('common.members')}</h2>

      {!canModerate && (
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
                  <button
                    type="button"
                    className={css.permShowMore}
                    onClick={() => toggleExpand(group.key)}
                  >
                    {t('room.settings.members.showMore', { count: hidden })}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {canModerate && (
        <div className={css.section}>
          <div className={css.permGroupHeader}>
            {t('room.members.pending')}
            <span className={css.permGroupBadge}>{knockRequests.length}</span>
          </div>
          {knockRequests.length === 0 ? (
            <div className={css.noResults}>{t('room.members.noPendingRequests')}</div>
          ) : (
            <>
              {(pendingExpanded ? knockRequests : knockRequests.slice(0, INITIAL_VISIBLE)).map(
                renderPendingRow
              )}
              {knockRequests.length > INITIAL_VISIBLE && (
                <button
                  type="button"
                  className={css.permShowMore}
                  onClick={() => setPendingExpanded((e) => !e)}
                >
                  {pendingExpanded
                    ? t('room.settings.members.showLess')
                    : t('room.settings.members.showMore', {
                        count: knockRequests.length - INITIAL_VISIBLE,
                      })}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {myLevel >= banThreshold && (
        <div className={css.section}>
          <div className={css.permGroupHeader}>
            {t('room.members.banned')}
            <span className={css.permGroupBadge}>{bannedMembers.length}</span>
          </div>
          {bannedMembers.length === 0 ? (
            <div className={css.noResults}>{t('room.members.noBannedMembers')}</div>
          ) : (
            <>
              {(bannedExpanded ? bannedMembers : bannedMembers.slice(0, INITIAL_VISIBLE)).map(
                renderBannedRow
              )}
              {bannedMembers.length > INITIAL_VISIBLE && (
                <button
                  type="button"
                  className={css.permShowMore}
                  onClick={() => setBannedExpanded((e) => !e)}
                >
                  {bannedExpanded
                    ? t('room.settings.members.showLess')
                    : t('room.settings.members.showMore', {
                        count: bannedMembers.length - INITIAL_VISIBLE,
                      })}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
