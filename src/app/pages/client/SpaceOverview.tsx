import { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  UserPlusIcon,
  GearIcon,
  SignOutIcon,
  UsersIcon,
  XIcon,
  DotsThreeVerticalIcon,
  ArrowsDownUpIcon,
  CaretDownIcon,
  CubeIcon,
  StackIcon,
  HashIcon,
  PushPinIcon,
} from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import { Tooltip } from '@/app/components/Tooltip';
import {
  currentRoomIdAtom,
  createRoomOpenAtom,
  createSpaceOpenAtom,
  roomSettingsRoomIdAtom,
  spaceSettingsRoomIdAtom,
  membersPanelOpenAtom,
  closedLobbyCategoriesAtom,
  pinnedSubSpacesAtom,
} from '@/app/store/atoms';
import { roomSortAtom } from '@/app/store/atoms/settings';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { EventType } from 'matrix-js-sdk';
import {
  useSpaceRoomsGrouped,
  fetchSpaceHierarchyLevel,
  buildRoomEntryFromSummary,
} from '@/app/features/room/useSpaceRoomsGrouped';
import type { SpaceSection } from '@/app/features/room/useSpaceRoomsGrouped';
import { RoomInvitePreview } from '@/app/features/room/RoomInvitePreview';
import { formatUserId, roomState, roomStateMaybe } from '@/util/matrix';
import { useRoomActions } from './hooks/useRoomActions';
import { useToast } from '@/app/hooks/useToast';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import type { SpaceRoomEntry } from '@/app/features/room/useSpaceRooms';
import { getErrorMessage } from '@/util/error';
import * as css from './SpaceOverview.css';

interface SpaceOverviewProps {
  spaceId: string;
}

function SortButton({
  value,
  options,
  title,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  title: string;
  onChange: (value: string) => void;
}) {
  return (
    <Tooltip content={title}>
      <div className={css.sortBtnWrap}>
        <span className={css.sortBtnIcon}>
          <ArrowsDownUpIcon size={14} />
        </span>
        <select className={css.sortSelect} value={value} onChange={(e) => onChange(e.target.value)}>
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

interface RoomRowProps {
  entry: SpaceRoomEntry;
  parentSpaceId: string;
  joiningRooms: Set<string>;
  acceptingRooms: Set<string>;
  onSelect: (roomId: string) => void;
  onJoin: (roomId: string, name: string, viaServers: string[]) => void;
  onKnock: (roomId: string, viaServers: string[]) => void;
  onAccept: (roomId: string) => void;
  onDecline: (roomId: string, name: string) => void;
  buildRoomMenu: (entry: SpaceRoomEntry, fromSpaceId: string) => ContextMenuItem[];
}

// A single room (or sub-sub-space) row
function RoomRow({
  entry,
  parentSpaceId,
  joiningRooms,
  acceptingRooms,
  onSelect,
  onJoin,
  onKnock,
  onAccept,
  onDecline,
  buildRoomMenu,
}: RoomRowProps) {
  const { t } = useTranslation();
  const { openContextMenu: openCtx } = useContextMenu();
  const client = getMatrixClientOrNull();
  const isBusy = joiningRooms.has(entry.roomId) || acceptingRooms.has(entry.roomId);
  const isClickable = entry.isJoined && !entry.isInvite;

  const hasMeta = entry.memberCount > 0 || !!entry.topic;

  return (
    <div
      className={css.roomRow}
      onClick={() => isClickable && onSelect(entry.roomId)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(entry.roomId);
              }
            }
          : undefined
      }
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      {entry.isSubSpace ? (
        <span
          style={{
            width: 20,
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--color-text-muted, #888)',
          }}
        >
          <CubeIcon size={16} weight="fill" />
        </span>
      ) : (
        <Avatar name={entry.name} mxcUrl={entry.avatarMxc} client={client ?? undefined} size="xs" />
      )}

      <div className={css.roomInfo}>
        <div className={css.roomName}>
          {entry.name}
          {entry.isSuggested && <span className={css.suggestedBadge}>{t('room.suggested')}</span>}
        </div>
        {hasMeta && (
          <div className={css.roomMeta}>
            {entry.memberCount > 0 && (
              <span className={css.memberCount}>
                <UsersIcon size={10} />
                {entry.memberCount}
              </span>
            )}
            {entry.memberCount > 0 && entry.topic && <span className={css.metaDivider} />}
            {entry.topic && <span className={css.roomTopicText}>{entry.topic}</span>}
          </div>
        )}
      </div>

      {entry.isInvite ? (
        <>
          <div className={css.roomRowDivider} />
          <div className={css.roomRowActions} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="secondary"
              size="sm"
              loading={isBusy}
              onClick={() => onDecline(entry.roomId, entry.name)}
            >
              {t('invite.decline')}
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={isBusy}
              onClick={() => onAccept(entry.roomId)}
            >
              {t('invite.accept')}
            </Button>
          </div>
        </>
      ) : entry.isKnocking ? (
        <>
          <div className={css.roomRowDivider} />
          <div className={css.roomRowActions} onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="sm" disabled>
              {t('explore.knocking')}
            </Button>
          </div>
        </>
      ) : !entry.isJoined ? (
        <>
          <div className={css.roomRowDivider} />
          <div className={css.roomRowActions} onClick={(e) => e.stopPropagation()}>
            {entry.joinRule === 'knock' ? (
              <Button
                variant="secondary"
                size="sm"
                loading={isBusy}
                onClick={() => onKnock(entry.roomId, entry.viaServers)}
              >
                {t('explore.knock')}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={isBusy}
                onClick={() => onJoin(entry.roomId, entry.name, entry.viaServers)}
              >
                {t('explore.join')}
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className={css.roomRowActions} onClick={(e) => e.stopPropagation()}>
          <IconButton
            size="sm"
            tooltip={t('common.more')}
            aria-label={t('common.more')}
            onClick={(e) => openCtx(e, buildRoomMenu(entry, parentSpaceId))}
          >
            <DotsThreeVerticalIcon size={16} weight="bold" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

interface SpaceSectionViewProps {
  section: SpaceSection;
  rootSpaceId: string;
  isOpen: boolean;
  onToggle: (key: string) => void;
  canAddRoom: boolean;
  roomSort: string;
  onRoomSortChange: (v: string) => void;
  joiningRooms: Set<string>;
  acceptingRooms: Set<string>;
  onAddRoom: (spaceId: string, spaceName: string) => void;
  onAddSubSpace: (spaceId: string, spaceName: string) => void;
  buildSubSpaceMenu: (section: SpaceSection) => ContextMenuItem[];
  onSelect: (roomId: string) => void;
  onJoin: (roomId: string, name: string, viaServers: string[]) => void;
  onKnock: (roomId: string, viaServers: string[]) => void;
  onAccept: (roomId: string) => void;
  onDecline: (roomId: string, name: string) => void;
  onJoinSpace: (spaceId: string, viaServers: string[]) => void;
  onDeclineSpace: (spaceId: string, name: string) => void;
  buildRoomMenu: (entry: SpaceRoomEntry, fromSpaceId: string) => ContextMenuItem[];
}

function SpaceSectionView({
  section,
  rootSpaceId,
  isOpen,
  onToggle,
  canAddRoom,
  roomSort,
  onRoomSortChange,
  joiningRooms,
  acceptingRooms,
  onAddRoom,
  onAddSubSpace,
  buildSubSpaceMenu,
  onSelect,
  onJoin,
  onKnock,
  onAccept,
  onDecline,
  onJoinSpace,
  onDeclineSpace,
  buildRoomMenu,
}: SpaceSectionViewProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();

  const { openContextMenu } = useContextMenu();
  const isRoot = section.spaceId === null;
  const isBusySpace =
    !isRoot && (joiningRooms.has(section.spaceId!) || acceptingRooms.has(section.spaceId!));
  const spaceForSection = !isRoot ? client?.getRoom(section.spaceId!) : null;
  const memberCount = spaceForSection?.getJoinedMemberCount?.() ?? 0;

  // Per-section lazy fetch: fires when first opened, caches result
  const [localRooms, setLocalRooms] = useState<SpaceRoomEntry[]>(section.rooms);
  const [isFetching, setIsFetching] = useState(false);
  const fetchedRef = useRef(section.roomsLoaded);
  const cachedRoomsRef = useRef<SpaceRoomEntry[]>(section.rooms);

  useEffect(() => {
    if (!isOpen || isRoot || fetchedRef.current || !client || !section.spaceId) return;

    fetchedRef.current = true;
    setIsFetching(true);

    const subSpaceId = section.spaceId;

    fetchSpaceHierarchyLevel(subSpaceId, client)
      .then((summaryMap) => {
        const entries: SpaceRoomEntry[] = [];
        for (const [childId, summ] of summaryMap) {
          if (childId === subSpaceId) continue;
          const localRoom = client.getRoom(childId);
          if (localRoom?.isSpaceRoom()) {
            const m = localRoom.getMyMembership();
            if (m === 'leave' || m === 'ban') continue;
            const topicEv = roomState(localRoom).getStateEvents('m.room.topic', '');
            entries.push({
              room: localRoom,
              roomId: childId,
              name: localRoom.name ?? summ.name ?? 'Unknown',
              avatarMxc: localRoom.getMxcAvatarUrl?.() ?? summ.avatar_url ?? null,
              topic: (topicEv?.getContent()?.topic as string | undefined) ?? summ.topic ?? null,
              memberCount: localRoom.getJoinedMembers().length,
              isJoined: m === 'join',
              isInvite: m === 'invite',
              isKnocking: m === 'knock',
              isSubSpace: true,
              isSuggested: summ.suggested,
              viaServers: [],
            });
            continue;
          }
          const entry = buildRoomEntryFromSummary(
            childId,
            [],
            summaryMap,
            client,
            'Unknown',
            summ.suggested
          );
          if (entry) entries.push(entry);
        }
        cachedRoomsRef.current = entries;
        setLocalRooms(entries);
        setIsFetching(false);
      })
      .catch(() => {
        setIsFetching(false);
      });
  }, [isOpen, isRoot, section.spaceId, client]);

  const displayRooms = isRoot ? section.rooms : localRooms;

  return (
    <div className={css.spaceSection}>
      <button
        type="button"
        className={css.spaceSectionHeader}
        onClick={() => onToggle(section.categoryKey)}
      >
        <CaretDownIcon
          size={14}
          className={[css.spaceSectionChevron, !isOpen ? css.spaceSectionChevronClosed : '']
            .filter(Boolean)
            .join(' ')}
        />
        <Avatar
          name={section.spaceName}
          mxcUrl={section.spaceAvatarMxc}
          client={client ?? undefined}
          size="sm"
        />
        <div className={css.spaceSectionTitle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span className={css.spaceSectionName}>
              {isRoot ? t('room.title') : section.spaceName}
            </span>
            {!isRoot && section.isSuggested && (
              <span className={css.suggestedBadge}>{t('room.suggested')}</span>
            )}
          </div>
          {!isRoot && memberCount > 0 && (
            <span className={css.spaceSectionMeta}>
              {memberCount} {t('common.members').toLowerCase()}
            </span>
          )}
        </div>
        <div className={css.spaceSectionActions} onClick={(e) => e.stopPropagation()}>
          {!isRoot && section.isInvite && (
            <>
              <Button
                variant="secondary"
                size="sm"
                loading={isBusySpace}
                onClick={() => onDeclineSpace(section.spaceId!, section.spaceName)}
              >
                {t('invite.decline')}
              </Button>
              <Button
                variant="success"
                size="sm"
                loading={isBusySpace}
                onClick={() => onJoinSpace(section.spaceId!, section.viaServers)}
              >
                {t('invite.accept')}
              </Button>
            </>
          )}
          {!isRoot && !section.isJoined && !section.isInvite && (
            <Button
              variant="secondary"
              size="sm"
              loading={isBusySpace}
              onClick={() => onJoinSpace(section.spaceId!, section.viaServers)}
            >
              {t('explore.join')}
            </Button>
          )}
          {isRoot && (
            <span onClick={(e) => e.stopPropagation()}>
              <SortButton
                value={roomSort}
                options={[
                  { value: 'name', label: t('room.sortName') },
                  { value: 'recentActivity', label: t('room.sortRecent') },
                ]}
                title={t('room.members.sortTitle')}
                onChange={onRoomSortChange}
              />
            </span>
          )}
          {canAddRoom && (isRoot || section.isJoined) && (
            <IconButton
              size="sm"
              tooltip={t('common.add')}
              aria-label={t('common.add')}
              onClick={(e) =>
                openContextMenu(e, [
                  {
                    label: t('room.addRoom'),
                    icon: <HashIcon size={14} />,
                    onClick: () => onAddRoom(section.spaceId ?? rootSpaceId, section.spaceName),
                  },
                  {
                    label: t('room.addSubSpace'),
                    icon: <StackIcon size={14} />,
                    onClick: () => onAddSubSpace(section.spaceId ?? rootSpaceId, section.spaceName),
                  },
                ])
              }
            >
              <PlusIcon size={14} />
            </IconButton>
          )}
          {!isRoot && section.isJoined && (
            <IconButton
              size="sm"
              tooltip={t('common.more')}
              aria-label={t('common.more')}
              onClick={(e) => openContextMenu(e, buildSubSpaceMenu(section))}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          )}
        </div>
      </button>

      {isOpen && (
        <div className={css.spaceSectionRooms}>
          {isFetching ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={css.skeletonRoomRow}>
                <div className={css.skeletonRoomAvatar} />
                <div className={css.skeletonRoomInfo}>
                  <div className={css.skeletonRoomName} />
                  <div className={css.skeletonRoomMeta} />
                </div>
              </div>
            ))
          ) : displayRooms.length === 0 ? (
            <div className={css.emptyState} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              {t('room.noRooms')}
            </div>
          ) : (
            displayRooms.map((entry) => (
              <div key={entry.roomId} className={css.spaceSectionRoomItem}>
                <RoomRow
                  entry={entry}
                  parentSpaceId={section.spaceId ?? rootSpaceId}
                  joiningRooms={joiningRooms}
                  acceptingRooms={acceptingRooms}
                  onSelect={onSelect}
                  onJoin={onJoin}
                  onKnock={onKnock}
                  onAccept={onAccept}
                  onDecline={onDecline}
                  buildRoomMenu={buildRoomMenu}
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function SpaceOverview({ spaceId }: SpaceOverviewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const [joiningRooms, setJoiningRooms] = useState(() => new Set<string>());
  const [acceptingRooms, setAcceptingRooms] = useState(() => new Set<string>());
  const toast = useToast();
  const { sections, loading: sectionsLoading } = useSpaceRoomsGrouped(spaceId, t('common.unknown'));
  const [roomSort, setRoomSort] = useAtom(roomSortAtom);
  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const setCreateRoomOpen = useSetAtom(createRoomOpenAtom);
  const setCreateSpaceOpen = useSetAtom(createSpaceOpenAtom);
  const [pinnedSubSpacesArr, setPinnedSubSpacesArr] = useAtom(pinnedSubSpacesAtom);
  const pinnedSubSpaces = new Set(pinnedSubSpacesArr);
  const setSpaceSettings = useSetAtom(spaceSettingsRoomIdAtom);
  const setRoomSettings = useSetAtom(roomSettingsRoomIdAtom);
  const roomActions = useRoomActions();
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);
  const [closedLobbyCategoriesArr, setClosedLobbyCategoriesArr] =
    useAtom(closedLobbyCategoriesAtom);

  const closedCategories = new Set(closedLobbyCategoriesArr);

  const toggleCategory = useCallback(
    (categoryKey: string) => {
      setClosedLobbyCategoriesArr((prev) => {
        const next = new Set(prev);
        if (next.has(categoryKey)) {
          next.delete(categoryKey);
        } else {
          next.add(categoryKey);
        }
        return Array.from(next);
      });
    },
    [setClosedLobbyCategoriesArr]
  );

  const space = client?.getRoom(spaceId);
  const spaceName = space?.name ?? spaceId;
  const spaceAvatarMxc = space?.getMxcAvatarUrl?.() ?? null;

  const topicEvent = roomStateMaybe(space)?.getStateEvents('m.room.topic', '');
  const spaceTopic = (topicEvent?.getContent()?.topic as string | undefined) ?? null;

  const selectRoom = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      navigate(`/r/${encodeURIComponent(roomId)}`);
    },
    [setCurrentRoomId, navigate]
  );

  const handleAddRoom = useCallback(
    (targetSpaceId: string, targetSpaceName: string) => {
      setCreateRoomOpen({ open: true, spaceId: targetSpaceId, spaceName: targetSpaceName });
    },
    [setCreateRoomOpen]
  );

  const handleAddSubSpace = useCallback(
    (targetSpaceId: string, targetSpaceName: string) => {
      setCreateSpaceOpen({
        open: true,
        parentSpaceId: targetSpaceId,
        parentSpaceName: targetSpaceName,
      });
    },
    [setCreateSpaceOpen]
  );

  const handleInvite = useCallback(() => {
    roomActions.inviteToRoom({ roomId: spaceId, name: spaceName, isSpace: true });
  }, [roomActions, spaceId, spaceName]);

  const handleSettings = useCallback(() => {
    setSpaceSettings(spaceId);
  }, [setSpaceSettings, spaceId]);

  const myUserId = client?.getUserId() ?? '';
  const canRemoveFromSpace =
    roomStateMaybe(space)?.maySendStateEvent('m.space.child', myUserId) ?? false;
  const canAddRoom = roomStateMaybe(space)?.maySendStateEvent('m.space.child', myUserId) ?? false;

  const handleRemoveFromSpace = useCallback(
    async (childRoomId: string) => {
      if (!client) return;
      try {
        await client.sendStateEvent(
          spaceId,
          EventType.SpaceChild,
          {} as Record<string, never>,
          childRoomId
        );
        toast.success(t('room.space.removed'));
      } catch (err) {
        toast.error(t('room.space.removeFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, spaceId, toast, t]
  );

  const buildRoomMenu = useCallback(
    (entry: SpaceRoomEntry, _fromSpaceId: string): ContextMenuItem[] => {
      const items: ContextMenuItem[] = [
        {
          label: t('common.invite'),
          icon: <UserPlusIcon size={14} />,
          onClick: () =>
            roomActions.inviteToRoom({
              roomId: entry.roomId,
              name: entry.name,
              isSpace: false,
            }),
        },
        {
          label: t('common.settings'),
          icon: <GearIcon size={14} />,
          onClick: () => setRoomSettings(entry.roomId),
        },
      ];
      if (canRemoveFromSpace) {
        items.push({
          label: t('room.space.removeRoom'),
          icon: <XIcon size={14} />,
          danger: true,
          onClick: () => handleRemoveFromSpace(entry.roomId),
        });
      }
      items.push({
        label: t('room.leaveRoom'),
        icon: <SignOutIcon size={14} />,
        danger: true,
        onClick: () => roomActions.leaveRoom(entry.roomId, entry.name),
      });
      return items;
    },
    [t, roomActions, setRoomSettings, canRemoveFromSpace, handleRemoveFromSpace]
  );

  const buildSubSpaceMenu = useCallback(
    (section: SpaceSection): ContextMenuItem[] => {
      const isPinned = pinnedSubSpaces.has(section.spaceId!);
      const items: ContextMenuItem[] = [
        {
          label: isPinned ? t('room.space.unpinFromSidebar') : t('room.space.pinToSidebar'),
          icon: <PushPinIcon size={14} weight={isPinned ? 'fill' : 'regular'} />,
          onClick: () => {
            setPinnedSubSpacesArr((prev) => {
              const next = new Set(prev);
              if (isPinned) {
                next.delete(section.spaceId!);
              } else {
                next.add(section.spaceId!);
              }
              return Array.from(next);
            });
          },
        },
        {
          label: t('common.invite'),
          icon: <UserPlusIcon size={14} />,
          onClick: () =>
            roomActions.inviteToRoom({
              roomId: section.spaceId!,
              name: section.spaceName,
              isSpace: true,
            }),
        },
        {
          label: t('common.settings'),
          icon: <GearIcon size={14} />,
          onClick: () => setSpaceSettings(section.spaceId!),
        },
      ];
      if (canRemoveFromSpace) {
        items.push({
          label: t('room.space.removeRoom'),
          icon: <XIcon size={14} />,
          danger: true,
          onClick: () => handleRemoveFromSpace(section.spaceId!),
        });
      }
      items.push({
        label: t('room.space.leave'),
        icon: <SignOutIcon size={14} />,
        danger: true,
        onClick: () => roomActions.leaveSpace(section.spaceId!, section.spaceName),
      });
      return items;
    },
    [
      t,
      roomActions,
      setSpaceSettings,
      canRemoveFromSpace,
      handleRemoveFromSpace,
      pinnedSubSpaces,
      setPinnedSubSpacesArr,
    ]
  );

  const handleJoinRoom = useCallback(
    async (roomId: string, name: string, viaServers: string[]) => {
      if (!client) return;
      setJoiningRooms((prev) => new Set(prev).add(roomId));
      try {
        await client.joinRoom(roomId, viaServers.length > 0 ? { viaServers } : undefined);
        toast.success(t('explore.joinSuccess', { name }));
      } catch (err) {
        toast.error(t('explore.joinFailed', { error: getErrorMessage(err) }));
      } finally {
        setJoiningRooms((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      }
    },
    [client, toast, t]
  );

  const handleKnockRoom = useCallback(
    async (roomId: string, viaServers: string[]) => {
      if (!client) return;
      setJoiningRooms((prev) => new Set(prev).add(roomId));
      try {
        await client.knockRoom(roomId, { viaServers });
        toast.success(t('explore.knockSuccess', { name: '' }));
      } catch (err) {
        toast.error(t('explore.knockFailed', { error: getErrorMessage(err) }));
      } finally {
        setJoiningRooms((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      }
    },
    [client, toast, t]
  );

  const handleAcceptInvite = useCallback(
    async (roomId: string) => {
      if (!client) return;
      setAcceptingRooms((prev) => new Set(prev).add(roomId));
      try {
        await client.joinRoom(roomId);
      } catch (err) {
        toast.error(t('invite.acceptFailed', { error: getErrorMessage(err) }));
      } finally {
        setAcceptingRooms((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      }
    },
    [client, toast, t]
  );

  const handleDeclineInvite = useCallback(
    async (roomId: string, roomName: string) => {
      if (!client) return;
      setAcceptingRooms((prev) => new Set(prev).add(roomId));
      try {
        await client.leave(roomId);
        toast.info(t('invite.declined', { name: roomName }));
      } catch (err) {
        toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
      } finally {
        setAcceptingRooms((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      }
    },
    [client, toast, t]
  );

  const handleJoinSpace = useCallback(
    async (subSpaceId: string, viaServers: string[]) => {
      if (!client) return;
      setJoiningRooms((prev) => new Set(prev).add(subSpaceId));
      try {
        await client.joinRoom(subSpaceId, viaServers.length > 0 ? { viaServers } : undefined);
        toast.success(t('explore.joinSuccess', { name: subSpaceId }));
      } catch (err) {
        toast.error(t('explore.joinFailed', { error: getErrorMessage(err) }));
      } finally {
        setJoiningRooms((prev) => {
          const next = new Set(prev);
          next.delete(subSpaceId);
          return next;
        });
      }
    },
    [client, toast, t]
  );

  const handleDeclineSpace = useCallback(
    async (subSpaceId: string, name: string) => {
      if (!client) return;
      setAcceptingRooms((prev) => new Set(prev).add(subSpaceId));
      try {
        await client.leave(subSpaceId);
        toast.info(t('invite.declined', { name }));
      } catch (err) {
        toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
      } finally {
        setAcceptingRooms((prev) => {
          const next = new Set(prev);
          next.delete(subSpaceId);
          return next;
        });
      }
    },
    [client, toast, t]
  );

  if (!space) {
    return (
      <div className={css.container}>
        <div className={css.scrollArea}>
          <div className={css.skeletonHeader}>
            <div className={css.skeletonAvatarCircle} />
            <div className={css.skeletonLineWide} />
            <div className={css.skeletonLineShort} />
            <div className={css.skeletonActions}>
              <div className={css.skeletonButton} />
              <div className={css.skeletonButton} />
            </div>
          </div>
          <div className={css.skeletonSectionRow}>
            <div className={css.skeletonSectionLine} />
            <div className={css.skeletonSectionBtn} />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={css.skeletonRoomRow}>
              <div className={css.skeletonRoomAvatar} />
              <div className={css.skeletonRoomInfo}>
                <div className={css.skeletonRoomName} />
                <div className={css.skeletonRoomMeta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (client && space.getMyMembership() === 'invite') {
    const memberEv = roomState(space).getStateEvents('m.room.member', myUserId);
    const memberEvSingle = Array.isArray(memberEv) ? memberEv[0] : memberEv;
    const inviterUserId = memberEvSingle?.getSender() ?? null;
    const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
    const inviterDisplayName =
      inviterUser?.displayName ?? (inviterUserId ? formatUserId(inviterUserId) : null);
    return (
      <RoomInvitePreview
        client={client}
        roomId={spaceId}
        roomName={spaceName}
        roomAvatarMxc={spaceAvatarMxc}
        topic={spaceTopic ?? ''}
        memberCount={space.getJoinedMemberCount?.() ?? 0}
        inviterUserId={inviterUserId}
        inviterDisplayName={inviterDisplayName}
        onAccepted={() => {}}
        onDeclined={() => navigate('/')}
      />
    );
  }

  return (
    <div className={css.container}>
      <div className={css.scrollArea}>
        <div className={css.spaceHeader}>
          <Avatar name={spaceName} mxcUrl={spaceAvatarMxc} client={client ?? undefined} size="xl" />
          <div className={css.spaceInfo}>
            <h2 className={css.spaceName}>{spaceName}</h2>
            {spaceTopic && <div className={css.spaceTopic}>{spaceTopic}</div>}
          </div>
          <div className={css.spaceActions}>
            <Button variant="secondary" size="sm" onClick={handleInvite}>
              <UserPlusIcon size={14} />
              {t('common.invite')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSettings}>
              <GearIcon size={14} />
              {t('common.settings')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              tooltip={t('common.members')}
              aria-label={t('common.members')}
              onClick={() => toggleMembersPanel((v) => !v)}
            >
              <UsersIcon size={14} />
              {t('common.members')}
            </Button>
          </div>
        </div>
      </div>

      <div className={css.roomListSection}>
        <div className={css.roomListScroll}>
          {sectionsLoading
            ? Array.from({ length: 3 }).map((_, si) => (
                <div key={si} style={{ marginBottom: '16px' }}>
                  <div className={css.skeletonSectionRow}>
                    <div className={css.skeletonSectionBtn} />
                    <div className={css.skeletonSectionLine} />
                    <div className={css.skeletonSectionBtn} />
                  </div>
                  <div style={{ paddingLeft: '4px' }}>
                    {Array.from({ length: si === 0 ? 2 : si === 1 ? 4 : 3 }).map((__, ri) => (
                      <div key={ri} className={css.skeletonRoomRow}>
                        <div className={css.skeletonRoomAvatar} />
                        <div className={css.skeletonRoomInfo}>
                          <div className={css.skeletonRoomName} />
                          <div className={css.skeletonRoomMeta} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            : sections.map((section) => {
                const isOpen =
                  section.spaceId === null
                    ? !closedCategories.has(section.categoryKey)
                    : closedCategories.has(section.categoryKey);
                return (
                  <SpaceSectionView
                    key={section.categoryKey}
                    section={section}
                    rootSpaceId={spaceId}
                    isOpen={isOpen}
                    onToggle={toggleCategory}
                    canAddRoom={canAddRoom}
                    roomSort={roomSort}
                    onRoomSortChange={(v) => setRoomSort(v as 'name' | 'recentActivity')}
                    joiningRooms={joiningRooms}
                    acceptingRooms={acceptingRooms}
                    onAddRoom={handleAddRoom}
                    onAddSubSpace={handleAddSubSpace}
                    buildSubSpaceMenu={buildSubSpaceMenu}
                    onSelect={selectRoom}
                    onJoin={handleJoinRoom}
                    onKnock={handleKnockRoom}
                    onAccept={handleAcceptInvite}
                    onDecline={handleDeclineInvite}
                    onJoinSpace={handleJoinSpace}
                    onDeclineSpace={handleDeclineSpace}
                    buildRoomMenu={buildRoomMenu}
                  />
                );
              })}
        </div>
      </div>
    </div>
  );
}
