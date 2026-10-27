import { memo, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useUiDensitySizes } from '@/app/hooks/useUiDensitySync';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { Tooltip } from '@/app/components/Tooltip';
import {
  currentRoomIdAtom,
  userProfileAtom,
  showPresenceAtom,
  ownPresenceAtom,
  userIdAtom,
} from '@/app/store/atoms';
import type { PresenceState } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Avatar } from '@/app/components/Avatar';
import { useSyncReady } from '@/app/hooks/useSync';
import { useActiveStatus, useExtendedProfile } from '@/app/hooks/useExtendedProfile';
import { effectiveDotPresence } from '@/util/profileCosmetics';
import { ListDecoratedAvatar, ListNameplate } from '@/app/features/profile/ListCosmetics';
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
import type { BuiltinRoleKey } from '@/app/features/space/spaceRoles';
import { builtinKeyOf, roleColorOf, useRoomRoles } from '@/app/features/space/spaceRoles';
import * as css from './MembersList.css';

/** Custom statuses have no push; visible rows re-check this often (paused while hidden). */
const STATUS_REFRESH_MS = 60_000;

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
  const nameColor = roleColorOf(
    useRoomRoles(client, roomId),
    member.userId,
    builtinKeyOf(client?.getRoom(roomId ?? ''), member.userId)
  );

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

  // Only rows the virtualizer renders mount this, so requests stay bounded to the visible
  // window (plus a small overscan); the query is cached (staleTime) and concurrency-limited
  // (see useExtendedProfile's fetch slot). It only polls on an interval while presence display
  // is on, matching the one-shot fetch used elsewhere (e.g. DmListItem's useListCosmetics) when
  // it's off.
  const { data: ext } = useExtendedProfile(client, member.userId, {
    refetchInterval: showPresence ? STATUS_REFRESH_MS : undefined,
  });
  const status = useActiveStatus(ext?.status, ext?.activity);

  const basePresence = showPresence
    ? member.userId === localUserId
      ? ownPresence
      : member.presence
    : undefined;
  const presence = showPresence ? effectiveDotPresence(basePresence, status?.mode) : undefined;
  const hasStatusText = !!status && (!!status.emoji || !!status.text);

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
        <ListNameplate nameplate={ext?.nameplate} client={client} />
        <ListDecoratedAvatar decoration={ext?.avatarDecoration ?? null} client={client}>
          <Avatar
            name={member.displayName}
            mxcUrl={member.avatarMxc}
            client={client ?? undefined}
            size="sm"
            placeholder="logo"
            presence={presence}
          />
        </ListDecoratedAvatar>
        <span className={css.memberTextColumn}>
          <span className={css.memberName} style={nameColor ? { color: nameColor } : undefined}>
            {member.displayName}
          </span>
          {status && hasStatusText && (
            <span className={css.memberStatus} title={status.text || undefined}>
              {status.emoji && <span className={css.memberStatusEmoji}>{status.emoji}</span>}
              {status.text && <span className={css.memberStatusText}>{status.text}</span>}
            </span>
          )}
        </span>
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
  const { members, loading } = useMembers(client, roomId);

  const room = client?.getRoom(roomId ?? '') ?? null;
  const creators = useMemo(() => getRoomCreators(room), [room]);

  const sortedMembers = useMemo(() => {
    return [...members]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .sort((a, b) => getRoleRank(getRoleKey(b, creators)) - getRoleRank(getRoleKey(a, creators)));
  }, [members, creators]);

  const spaceRoles = useRoomRoles(client, roomId);

  // Roles marked "show separately" get their own heading above the power level groups.
  const roleSections = useMemo(() => {
    const hoisted: RoleSectionItem[] = [];
    const taken = new Set<string>();
    for (const role of spaceRoles.roles) {
      if (!role.hoist) continue;
      const holders = sortedMembers.filter(
        (m) =>
          !taken.has(m.userId) &&
          spaceRoles.byUser.get(m.userId)?.find((r) => r.hoist)?.id === role.id
      );
      if (holders.length === 0) continue;
      hoisted.push({
        kind: 'role',
        roleKey: `space-role:${role.id}`,
        label: role.name,
        count: holders.length,
      });
      for (const member of holders) {
        taken.add(member.userId);
        hoisted.push({ kind: 'member', member });
      }
    }
    const rest = taken.size ? sortedMembers.filter((m) => !taken.has(m.userId)) : sortedMembers;
    // Admin, Moderator and Member can be renamed in the space's Roles settings.
    const base = buildRoleSections(rest, creators, t).map((item) =>
      isRoleHeader(item) && spaceRoles.builtin[item.roleKey as BuiltinRoleKey]?.name
        ? { ...item, label: spaceRoles.builtin[item.roleKey as BuiltinRoleKey]!.name! }
        : item
    );
    return [...hoisted, ...base];
  }, [sortedMembers, creators, t, spaceRoles]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const { roleHeader: roleHeaderSize, memberRow: memberRowSize } = useUiDensitySizes();

  const virtualizer = useVirtualizer({
    count: roleSections.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => (isRoleHeader(roleSections[index]) ? roleHeaderSize : memberRowSize),
    overscan: 5,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [roleHeaderSize, memberRowSize, virtualizer]);

  // Reset scroll position when switching rooms
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [roomId]);

  if (!roomId) return null;

  return (
    <div className={css.membersListContainer}>
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
        <div className={css.emptyState}>{t('room.noMembers')}</div>
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
