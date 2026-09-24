import { useCallback, useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  UserPlusIcon,
  SpeakerHighIcon,
  GearIcon,
  SignOutIcon,
  UsersIcon,
  XIcon,
  DotsThreeVerticalIcon,
  CaretDownIcon,
  CubeIcon,
  StackIcon,
  HashStraightIcon,
  PushPinIcon,
  StarIcon,
} from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import {
  currentRoomIdAtom,
  createRoomOpenAtom,
  createSpaceOpenAtom,
  addRoomToSpaceAtom,
  roomSettingsRoomIdAtom,
  spaceSettingsRoomIdAtom,
  membersPanelOpenAtom,
  closedLobbyCategoriesAtom,
  pinnedSubSpacesAtom,
} from '@/app/store/atoms';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
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
import { useContextMenuTrigger } from '@/app/hooks/useContextMenuTrigger';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import { spaceRoomOrderAtom } from '@/app/store/atoms/rooms';
import type { SpaceRoomEntry } from '@/app/features/room/useSpaceRoomsGrouped';
import { getErrorMessage } from '@/util/error';
import { applyCustomOrder } from '@/app/util/applyCustomOrder';
import * as css from './SpaceOverview.css';
import { vars } from '@/theme/vars.css';

interface SpaceOverviewProps {
  spaceId: string;
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
  const { openContextMenu } = useContextMenu();
  const client = getMatrixClientOrNull();
  const isBusy = joiningRooms.has(entry.roomId) || acceptingRooms.has(entry.roomId);
  const isClickable = entry.isJoined && !entry.isInvite;
  const hasMeta = entry.memberCount > 0 || !!entry.topic;

  const menuTrigger = useContextMenuTrigger(() =>
    entry.isJoined && !entry.isInvite ? buildRoomMenu(entry, parentSpaceId) : []
  );

  return (
    <div
      {...menuTrigger}
      className={css.roomRow}
      onClick={() => isClickable && onSelect(entry.roomId)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              menuTrigger.onKeyDown(e);
              if (e.defaultPrevented) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(entry.roomId);
              }
            }
          : menuTrigger.onKeyDown
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
            color: vars.color.textMuted,
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
            onClick={(e) => openContextMenu(e, buildRoomMenu(entry, parentSpaceId))}
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
  isHeaderDraggable: boolean;
  roomOrder: string[] | undefined;
  insertLine: { id: string; position: 'before' | 'after' } | null;
  joiningRooms: Set<string>;
  acceptingRooms: Set<string>;
  onAddRoom: (spaceId: string, spaceName: string) => void;
  onAddVoiceRoom: (spaceId: string, spaceName: string) => void;
  onAddExistingRoom: (spaceId: string, spaceName: string) => void;
  onAddExistingSubSpace: (spaceId: string, spaceName: string) => void;
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

function SortableRoomItem({
  roomId,
  disabled,
  insertLine,
  children,
}: {
  roomId: string;
  disabled: boolean;
  insertLine: { id: string; position: 'before' | 'after' } | null;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: roomId,
    disabled,
  });

  const lineClass =
    insertLine?.id === roomId
      ? insertLine.position === 'before'
        ? css.insertionLineBefore
        : css.insertionLineAfter
      : '';

  return (
    <div
      ref={setNodeRef}
      className={[css.spaceSectionRoomItem, isDragging ? css.roomRowDragging : '', lineClass]
        .filter(Boolean)
        .join(' ')}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function SpaceSectionView({
  section,
  rootSpaceId,
  isOpen,
  onToggle,
  canAddRoom,
  isHeaderDraggable,
  roomOrder,
  insertLine,
  joiningRooms,
  acceptingRooms,
  onAddRoom,
  onAddVoiceRoom,
  onAddExistingRoom,
  onAddExistingSubSpace,
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

  // Section header drag
  const {
    attributes: sectionAttrs,
    listeners: sectionListeners,
    setNodeRef: sectionNodeRef,
    isDragging: isSectionDragging,
  } = useSortable({
    id: section.spaceId ?? 'root',
    disabled: !isHeaderDraggable,
  });

  // Per-section lazy fetch: fires when first opened, then refreshes live as the
  const [localRooms, setLocalRooms] = useState<SpaceRoomEntry[]>(section.rooms);
  const [isFetching, setIsFetching] = useState(false);
  const fetchedRef = useRef(section.roomsLoaded);
  const cachedRoomsRef = useRef<SpaceRoomEntry[]>(section.rooms);

  const fetchRooms = useCallback(() => {
    if (isRoot || !client || !section.spaceId) return;
    if (cachedRoomsRef.current.length === 0) setIsFetching(true);
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
  }, [isRoot, section.spaceId, client]);

  const refreshSuggestedFlags = useCallback(() => {
    if (isRoot || !section.spaceId || !client) return;
    const subSpace = client.getRoom(section.spaceId);
    if (!subSpace) return;
    const updated = cachedRoomsRef.current.map((entry) => {
      const ev = roomState(subSpace).getStateEvents(EventType.SpaceChild, entry.roomId);
      const content = (Array.isArray(ev) ? ev[0] : ev)?.getContent() as
        | Record<string, unknown>
        | undefined;
      const isSuggested = content?.['suggested'] === true;
      return entry.isSuggested === isSuggested ? entry : { ...entry, isSuggested };
    });
    const changed = updated.some((e, i) => e !== cachedRoomsRef.current[i]);
    if (changed) {
      cachedRoomsRef.current = updated;
      setLocalRooms(updated);
    }
  }, [isRoot, section.spaceId, client]);

  useMatrixEvent(client ?? null, 'RoomState.events', refreshSuggestedFlags);

  useEffect(() => {
    if (!isOpen || isRoot || fetchedRef.current || !client || !section.spaceId) return;

    fetchedRef.current = true;
    fetchRooms();
  }, [isOpen, isRoot, client, section.spaceId, fetchRooms]);

  const throttledFetchRooms = useThrottle(fetchRooms, 500);

  const handleSpaceChildChange = useCallback(
    (
      event: { getType?: () => string },
      _state: unknown,
      _prev: unknown,
      room: { roomId?: string }
    ) => {
      if (event?.getType?.() !== EventType.SpaceChild) return;
      if (room?.roomId !== section.spaceId) return;
      throttledFetchRooms();
    },
    [throttledFetchRooms, section.spaceId]
  );

  const handleMembershipChange = useCallback(() => {
    if (isRoot) return;
    throttledFetchRooms();
  }, [isRoot, throttledFetchRooms]);

  useMatrixEvent(client ?? null, 'RoomState.events', handleSpaceChildChange);
  useMatrixEvent(client ?? null, 'Room.myMembership', handleMembershipChange);

  const displayRooms = isRoot ? section.rooms : localRooms;

  // Apply custom ordering
  const orderedRooms = useMemo(() => {
    if (!roomOrder || roomOrder.length === 0) return displayRooms;
    return applyCustomOrder(displayRooms, roomOrder, (e) => e.roomId);
  }, [displayRooms, roomOrder]);

  const sortableRoomIds = useMemo(
    () => orderedRooms.filter((e) => e.isJoined && !e.isInvite).map((e) => e.roomId),
    [orderedRooms]
  );

  return (
    <div className={css.spaceSection}>
      {isHeaderDraggable ? (
        <div
          ref={sectionNodeRef}
          className={[css.spaceSectionHeader, isSectionDragging ? css.sectionHeaderDragging : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => onToggle(section.categoryKey)}
          {...sectionAttrs}
          {...sectionListeners}
        >
          <button
            type="button"
            className={css.spaceSectionToggle}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(section.categoryKey);
            }}
            aria-expanded={isOpen}
            aria-label={isRoot ? t('room.title') : section.spaceName}
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
          </button>
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
            {canAddRoom && (isRoot || section.isJoined) && (
              <IconButton
                size="sm"
                tooltip={t('common.add')}
                aria-label={t('common.add')}
                onClick={(e) =>
                  openContextMenu(e, [
                    {
                      label: t('room.addRoom'),
                      icon: <HashStraightIcon size={14} />,
                      onClick: () => onAddRoom(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      label: t('room.addVoiceRoom'),
                      icon: <SpeakerHighIcon size={14} />,
                      onClick: () =>
                        onAddVoiceRoom(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      label: t('room.space.addExistingRoom'),
                      icon: <CubeIcon size={14} />,
                      onClick: () =>
                        onAddExistingRoom(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      divider: true,
                      label: '',
                      onClick: () => {},
                    },
                    {
                      label: t('room.addSubSpace'),
                      icon: <StackIcon size={14} />,
                      onClick: () =>
                        onAddSubSpace(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      label: t('room.space.addExistingSubSpace'),
                      icon: <StackIcon size={14} />,
                      onClick: () =>
                        onAddExistingSubSpace(section.spaceId ?? rootSpaceId, section.spaceName),
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
        </div>
      ) : (
        <div className={css.spaceSectionHeader} onClick={() => onToggle(section.categoryKey)}>
          <button
            type="button"
            className={css.spaceSectionToggle}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(section.categoryKey);
            }}
            aria-expanded={isOpen}
            aria-label={isRoot ? t('room.title') : section.spaceName}
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
          </button>
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
            {canAddRoom && (isRoot || section.isJoined) && (
              <IconButton
                size="sm"
                tooltip={t('common.add')}
                aria-label={t('common.add')}
                onClick={(e) =>
                  openContextMenu(e, [
                    {
                      label: t('room.addRoom'),
                      icon: <HashStraightIcon size={14} />,
                      onClick: () => onAddRoom(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      label: t('room.addVoiceRoom'),
                      icon: <SpeakerHighIcon size={14} />,
                      onClick: () =>
                        onAddVoiceRoom(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      label: t('room.space.addExistingRoom'),
                      icon: <CubeIcon size={14} />,
                      onClick: () =>
                        onAddExistingRoom(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      divider: true,
                      label: '',
                      onClick: () => {},
                    },
                    {
                      label: t('room.addSubSpace'),
                      icon: <StackIcon size={14} />,
                      onClick: () =>
                        onAddSubSpace(section.spaceId ?? rootSpaceId, section.spaceName),
                    },
                    {
                      label: t('room.space.addExistingSubSpace'),
                      icon: <StackIcon size={14} />,
                      onClick: () =>
                        onAddExistingSubSpace(section.spaceId ?? rootSpaceId, section.spaceName),
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
        </div>
      )}

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
          ) : orderedRooms.length === 0 ? (
            <div className={css.emptyState} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              {t('room.noRooms')}
            </div>
          ) : (
            <SortableContext items={sortableRoomIds} strategy={verticalListSortingStrategy}>
              {orderedRooms.map((entry) => {
                const isDraggable = entry.isJoined && !entry.isInvite;
                return (
                  <SortableRoomItem
                    key={entry.roomId}
                    roomId={entry.roomId}
                    disabled={!isDraggable}
                    insertLine={insertLine}
                  >
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
                  </SortableRoomItem>
                );
              })}
            </SortableContext>
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
  const { sections } = useSpaceRoomsGrouped(spaceId, t('common.unknown'));
  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const setCreateRoomOpen = useSetAtom(createRoomOpenAtom);
  const setCreateSpaceOpen = useSetAtom(createSpaceOpenAtom);
  const setAddRoomToSpace = useSetAtom(addRoomToSpaceAtom);
  const [pinnedSubSpacesArr, setPinnedSubSpacesArr] = useAtom(pinnedSubSpacesAtom);
  const pinnedSubSpaces = new Set(pinnedSubSpacesArr);
  const setSpaceSettings = useSetAtom(spaceSettingsRoomIdAtom);
  const setRoomSettings = useSetAtom(roomSettingsRoomIdAtom);
  const roomActions = useRoomActions();
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);
  const [closedLobbyCategoriesArr, setClosedLobbyCategoriesArr] =
    useAtom(closedLobbyCategoriesAtom);
  const [spaceRoomOrder, setSpaceRoomOrder] = useAtom(spaceRoomOrderAtom);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // Tracks which item is hovered and whether the dragged item lands before or after it
  const [insertLine, setInsertLine] = useState<{ id: string; position: 'before' | 'after' } | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

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

  // Split sections into root and subspaces
  const rootSection = sections.find((s) => s.spaceId === null);
  const subspaceSections = sections.filter((s) => s.spaceId !== null);

  const orderedSubspaceSections = useMemo(() => {
    const savedOrder = spaceRoomOrder[spaceId];
    if (!savedOrder || savedOrder.length === 0) return subspaceSections;
    return applyCustomOrder(subspaceSections, savedOrder, (s) => s.spaceId!);
  }, [subspaceSections, spaceRoomOrder, spaceId]);

  const subspaceSectionIds = useMemo(
    () => orderedSubspaceSections.filter((s) => s.isJoined).map((s) => s.spaceId!),
    [orderedSubspaceSections]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setInsertLine(null);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) {
        setInsertLine(null);
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      // Try subspace sections first
      if (subspaceSections.some((s) => s.spaceId === activeId)) {
        const orderedIds = orderedSubspaceSections.map((s) => s.spaceId!);
        const ai = orderedIds.indexOf(activeId);
        const oi = orderedIds.indexOf(overId);
        if (ai === -1 || oi === -1) {
          setInsertLine(null);
          return;
        }
        setInsertLine({ id: overId, position: ai < oi ? 'after' : 'before' });
        return;
      }

      // Try rooms in each section
      for (const section of sections) {
        const roomIds = section.rooms.map((r) => r.roomId);
        if (!roomIds.includes(overId)) continue;

        const parentId = section.spaceId ?? spaceId;
        const savedOrder = spaceRoomOrder[parentId];
        const orderedRoomIds = savedOrder?.length
          ? applyCustomOrder(section.rooms, savedOrder, (r) => r.roomId).map((r) => r.roomId)
          : roomIds;
        const ai = orderedRoomIds.indexOf(activeId);
        const oi = orderedRoomIds.indexOf(overId);
        if (ai === -1 || oi === -1) break;

        setInsertLine({ id: overId, position: ai < oi ? 'after' : 'before' });
        return;
      }

      setInsertLine(null);
    },
    [subspaceSections, orderedSubspaceSections, sections, spaceId, spaceRoomOrder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setInsertLine(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      setInsertLine(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const isSectionDrag = subspaceSections.some((s) => s.spaceId === activeId);
      if (isSectionDrag) {
        const orderedIds = orderedSubspaceSections.map((s) => s.spaceId!);
        const oldIndex = orderedIds.indexOf(activeId);
        const newIndex = orderedIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(orderedIds, oldIndex, newIndex);
        setSpaceRoomOrder((prev) => ({ ...prev, [spaceId]: reordered }));
        return;
      }

      for (const section of sections) {
        const parentId = section.spaceId ?? spaceId;
        const roomIds =
          section.spaceId === null
            ? section.rooms.map((r) => r.roomId)
            : (section as SpaceSection & { rooms: SpaceRoomEntry[] }).rooms.map((r) => r.roomId);
        if (!roomIds.includes(activeId)) continue;

        const savedIds = spaceRoomOrder[parentId] ?? roomIds;
        const oldIndex = savedIds.indexOf(activeId);
        const newIndex = savedIds.indexOf(overId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(savedIds, oldIndex, newIndex);
        setSpaceRoomOrder((prev) => ({ ...prev, [parentId]: reordered }));
        return;
      }
    },
    [
      spaceId,
      sections,
      subspaceSections,
      orderedSubspaceSections,
      spaceRoomOrder,
      setSpaceRoomOrder,
    ]
  );

  const activeDragSection = useMemo(
    () => subspaceSections.find((s) => s.spaceId === activeDragId) ?? null,
    [subspaceSections, activeDragId]
  );

  const activeDragRoomEntry = useMemo(() => {
    if (!activeDragId) return null;
    for (const section of sections) {
      const entry = section.rooms.find((r) => r.roomId === activeDragId);
      if (entry) return entry;
    }
    return null;
  }, [sections, activeDragId]);

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

  const handleAddVoiceRoom = useCallback(
    (targetSpaceId: string, targetSpaceName: string) => {
      setCreateRoomOpen({
        open: true,
        spaceId: targetSpaceId,
        spaceName: targetSpaceName,
        voiceRoom: true,
      });
    },
    [setCreateRoomOpen]
  );

  const handleAddExistingRoom = useCallback(
    (targetSpaceId: string, targetSpaceName: string) => {
      setAddRoomToSpace({ open: true, spaceId: targetSpaceId, spaceName: targetSpaceName });
    },
    [setAddRoomToSpace]
  );

  const handleAddExistingSubSpace = useCallback(
    (targetSpaceId: string, targetSpaceName: string) => {
      setAddRoomToSpace({
        open: true,
        spaceId: targetSpaceId,
        spaceName: targetSpaceName,
        type: 'subspace',
      });
    },
    [setAddRoomToSpace]
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
      } catch (err) {
        toast.error(t('room.space.removeFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, spaceId, toast, t]
  );

  const handleToggleSuggested = useCallback(
    async (childId: string, parentSpaceId: string) => {
      if (!client) return;
      const parentSpace = client.getRoom(parentSpaceId);
      if (!parentSpace) return;
      const existing = roomState(parentSpace).getStateEvents(EventType.SpaceChild, childId);
      const existingContent = (Array.isArray(existing) ? existing[0] : existing)?.getContent() as
        | Record<string, unknown>
        | undefined;
      if (!existingContent || !Array.isArray(existingContent['via'])) return;
      try {
        await client.sendStateEvent(
          parentSpaceId,
          EventType.SpaceChild,
          { ...existingContent, suggested: !existingContent['suggested'] },
          childId
        );
      } catch (err) {
        toast.error(t('common.error', { error: getErrorMessage(err) }));
      }
    },
    [client, toast, t]
  );

  const buildRoomMenu = useCallback(
    (entry: SpaceRoomEntry, fromSpaceId: string): ContextMenuItem[] => {
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
          label: entry.isSuggested ? t('room.space.unsetSuggested') : t('room.space.setSuggested'),
          icon: <StarIcon size={14} weight={entry.isSuggested ? 'fill' : 'regular'} />,
          onClick: () => handleToggleSuggested(entry.roomId, fromSpaceId),
        });
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
    [
      t,
      roomActions,
      setRoomSettings,
      canRemoveFromSpace,
      handleRemoveFromSpace,
      handleToggleSuggested,
    ]
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
          label: section.isSuggested
            ? t('room.space.unsetSuggested')
            : t('room.space.setSuggested'),
          icon: <StarIcon size={14} weight={section.isSuggested ? 'fill' : 'regular'} />,
          onClick: () => handleToggleSuggested(section.spaceId!, spaceId),
        });
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
      handleToggleSuggested,
      pinnedSubSpaces,
      setPinnedSubSpacesArr,
      spaceId,
    ]
  );

  const handleJoinRoom = useCallback(
    async (roomId: string, _name: string, viaServers: string[]) => {
      if (!client) return;
      setJoiningRooms((prev) => new Set(prev).add(roomId));
      try {
        await client.joinRoom(roomId, viaServers.length > 0 ? { viaServers } : undefined);
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
          {
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {rootSection && (
                <SpaceSectionView
                  key={rootSection.categoryKey}
                  section={rootSection}
                  rootSpaceId={spaceId}
                  isOpen={!closedCategories.has(rootSection.categoryKey)}
                  onToggle={toggleCategory}
                  canAddRoom={canAddRoom}
                  isHeaderDraggable={false}
                  roomOrder={spaceRoomOrder[spaceId]}
                  insertLine={insertLine}
                  joiningRooms={joiningRooms}
                  acceptingRooms={acceptingRooms}
                  onAddRoom={handleAddRoom}
                  onAddVoiceRoom={handleAddVoiceRoom}
                  onAddExistingRoom={handleAddExistingRoom}
                  onAddExistingSubSpace={handleAddExistingSubSpace}
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
              )}

              <SortableContext items={subspaceSectionIds} strategy={verticalListSortingStrategy}>
                {orderedSubspaceSections.map((section) => {
                  const isOpen = !closedCategories.has(section.categoryKey);
                  const showBefore =
                    insertLine?.id === section.spaceId && insertLine.position === 'before';
                  const showAfter =
                    insertLine?.id === section.spaceId && insertLine.position === 'after';
                  return (
                    <Fragment key={section.categoryKey}>
                      {showBefore && <div className={css.sectionInsertionLine} />}
                      <SpaceSectionView
                        section={section}
                        rootSpaceId={spaceId}
                        isOpen={isOpen}
                        onToggle={toggleCategory}
                        canAddRoom={canAddRoom}
                        isHeaderDraggable={section.isJoined}
                        roomOrder={spaceRoomOrder[section.spaceId!]}
                        insertLine={insertLine}
                        joiningRooms={joiningRooms}
                        acceptingRooms={acceptingRooms}
                        onAddRoom={handleAddRoom}
                        onAddVoiceRoom={handleAddVoiceRoom}
                        onAddExistingRoom={handleAddExistingRoom}
                        onAddExistingSubSpace={handleAddExistingSubSpace}
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
                      {showAfter && <div className={css.sectionInsertionLine} />}
                    </Fragment>
                  );
                })}
              </SortableContext>

              <DragOverlay>
                {activeDragSection && (
                  <div className={css.dragOverlay}>
                    <CubeIcon size={16} weight="fill" />
                    {activeDragSection.spaceName}
                  </div>
                )}
                {activeDragRoomEntry && (
                  <div className={css.dragOverlayRow}>
                    <Avatar
                      name={activeDragRoomEntry.name}
                      mxcUrl={activeDragRoomEntry.avatarMxc}
                      client={client ?? undefined}
                      size="xs"
                    />
                    {activeDragRoomEntry.name}
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          }
        </div>
      </div>
    </div>
  );
}
