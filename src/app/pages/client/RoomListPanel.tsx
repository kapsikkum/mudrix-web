import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CaretDownIcon,
  DotsThreeVerticalIcon,
  HashStraightIcon,
  HouseIcon,
  PlusIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useSpaceListStyle } from '@/app/features/space/spaceListStyle';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tooltip } from '@/app/components/Tooltip';
import { IconButton } from '@/app/components/Button';
import {
  currentRoomIdAtom,
  currentSpaceIdAtom,
  sidebarViewAtom,
  createRoomOpenAtom,
  createCategoryOpenAtom,
  createSpaceOpenAtom,
  addRoomToSpaceAtom,
  newDmOpenAtom,
  closedNavCategoriesAtom,
  pinnedSubSpacesAtom,
  spaceSettingsRoomIdAtom,
  mobileDrawerOpenAtom,
  favouriteRoomsAtom,
  lowPriorityRoomsAtom,
  openRoomChatAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { useSpaceNicknamePrompt } from '@/app/hooks/useSpaceNicknames';
import { getErrorMessage } from '@/util/error';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type Modifier,
  type DragEndEvent,
} from '@dnd-kit/core';
import { vars } from '@/theme/vars.css';
import { RoomDragRow } from './RoomDragRow';
import { mayMoveBetween, moveVoiceUser } from '@/app/features/voice/voiceMove';
import { SpaceBannerView } from '@/app/features/space/SpaceBannerView';
import { useSpaceBanner } from '@/app/features/space/spaceBanner';
import * as bannerCss from '@/app/features/space/SpaceBanner.css';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useContextMenuTrigger } from '@/app/hooks/useContextMenuTrigger';
import { useDms } from '@/app/hooks/useDms';
import { useRooms, useSpaces } from '@/app/features/room';
import { useSpaceHierarchy } from '@/app/features/room/useSpaceHierarchy';
import type { RoomEntry } from '@/app/features/room/useRooms';
import type {
  HierarchyItem,
  HierarchyRoomItem,
  HierarchySpaceItem,
} from '@/app/features/room/useSpaceHierarchy';
import { ElementCallBar } from '@/app/features/calls/ElementCallBar';
import { callActionsAtom, callUiAtom } from '@/app/store/atoms/call';
import { useCallMemberships, uniqueMembers } from '@/app/features/calls/useCallMemberships';
import { computeParticipantsBlockHeight } from '@/app/features/voice/participantSize';
import { useUiDensitySizes } from '@/app/hooks/useUiDensitySync';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useRoomActions } from './hooks/useRoomActions';
import {
  canOrderSpace,
  moveRoomToCategory,
  moveSpaceChild,
  placeSpaceChild,
} from '@/app/features/space/spaceOrder';
import {
  sendReadReceiptsAtom,
  roomAvatarsVisibleAtom,
  activeRoomListStyleAtom,
} from '@/app/store/atoms/settings';
import { buildSpaceMenu, markSpaceAsRead, buildHomeMenu, buildDmsMenu } from './spaceContextMenu';
import { RoomListItem, DmListItem } from './RoomListItem';
import { UserPanel } from './UserPanel';
import { isTextFieldTarget } from '@/app/features/keyboardShortcuts/keyEvents';
import * as css from './RoomListPanel.css';
import { isVoiceRoom } from '@/util/matrix';
import { VoiceJoinSheet } from '@/app/features/calls/VoiceJoinSheet';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';

const LIST_OVERSCAN = 5;

const HOME_FAVOURITES_CATEGORY = 'home-favourites';
const HOME_ROOMS_CATEGORY = 'home-rooms';
const HOME_LOW_PRIORITY_CATEGORY = 'home-lowpriority';

type HomeListItem =
  | {
      kind: 'header';
      itemKey: string;
      label: string;
      hasNotif: boolean;
      hasMention: boolean;
      showAdd: boolean;
    }
  | { kind: 'room'; entry: RoomEntry };

type SpaceListItem =
  | { kind: 'header'; item: HierarchySpaceItem }
  | { kind: 'room'; item: HierarchyRoomItem };

interface RoomListPanelProps {
  onVoiceJoin: (roomId: string) => void;
}

interface SubspaceCategoryHeaderProps {
  item: HierarchySpaceItem;
  isClosed: boolean;
  onToggle: (categoryKey: string) => void;
  onAdd: (e: React.MouseEvent, item: HierarchySpaceItem) => void;
  client: ReturnType<typeof getMatrixClientOrNull>;
}

function SubspaceCategoryHeader({
  item,
  isClosed,
  onToggle,
  onAdd,
  client,
  showAvatar,
}: SubspaceCategoryHeaderProps & { showAvatar: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={css.subspaceCategoryHeader} onClick={() => onToggle(item.categoryKey)}>
      <button
        type="button"
        className={css.subspaceToggle}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.categoryKey);
        }}
        aria-expanded={!isClosed}
      >
        {showAvatar && !item.isRoot && (
          <Avatar name={item.name} mxcUrl={item.avatarMxc} client={client ?? undefined} size="xs" />
        )}
        <span className={css.subspaceName}>{item.isRoot ? t('room.title') : item.name}</span>
        <CaretDownIcon
          size={10}
          weight="bold"
          className={[css.subspaceChevron, isClosed ? css.subspaceChevronClosed : '']
            .filter(Boolean)
            .join(' ')}
        />
        <span className={css.subspaceSpacer} />
        {item.hasNotif && (
          <span
            className={item.hasMention ? css.subspaceUnreadDotMention : css.subspaceUnreadDot}
          />
        )}
      </button>
      <Tooltip content={t('room.create.title')}>
        <button
          type="button"
          aria-label={t('room.create.title')}
          className={css.subspaceAddButton}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(e, item);
          }}
        >
          <PlusIcon size={12} weight="bold" />
        </button>
      </Tooltip>
    </div>
  );
}

// Sits just below the pointer, so the row being dropped on stays in view.
const GHOST_OFFSET: Modifier[] = [
  ({ transform }) => ({ ...transform, x: transform.x + 14, y: transform.y + 26 }),
];

/**
 * What follows the pointer while a room or person is dragged; the rows themselves stay put. A
 * dragged room is shown as a copy of its own row.
 */
function DragGhost({ client }: { client: ReturnType<typeof getMatrixClientOrNull> }) {
  const { active, activeNode } = useDndContext();
  const key = active ? String(active.id) : '';
  const isPerson = key.startsWith('participant:');
  let label: string | undefined;
  if (isPerson) {
    const userId = key.slice('participant:'.length).split(':!')[0];
    label = client?.getUser(userId)?.displayName ?? userId;
  }
  const rowHtml = !isPerson ? activeNode?.innerHTML : undefined;
  const style = {
    width: active?.rect.current.initial?.width,
    boxSizing: 'border-box',
    borderRadius: vars.radius.sm,
    background: vars.color.bgTertiary,
    color: vars.color.textPrimary,
    border: `1px solid ${vars.color.accent}`,
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.45)',
    overflow: 'hidden',
    cursor: 'grabbing',
    pointerEvents: 'none',
  } as const;
  return (
    <DragOverlay dropAnimation={null} zIndex={1000} modifiers={GHOST_OFFSET}>
      {rowHtml ? (
        <div style={style} dangerouslySetInnerHTML={{ __html: rowHtml }} />
      ) : label ? (
        <div style={{ ...style, padding: '6px 12px', whiteSpace: 'nowrap' }}>{label}</div>
      ) : null}
    </DragOverlay>
  );
}

/**
 * A category heading. A room dropped on it moves into the category; the heading itself can be
 * dragged onto a sibling category to take its place.
 */
function CategoryDrop({
  spaceId,
  drag,
  children,
}: {
  spaceId: string;
  /** Where the category sits among its siblings; absent when it can't be reordered. */
  drag?: { group: string; index: number };
  children: React.ReactNode;
}) {
  const data = { kind: 'category', group: drag?.group, index: drag?.index };
  const dropping = useDroppable({ id: `category:${spaceId}`, data });
  const dragging = useDraggable({ id: `category-drag:${spaceId}`, data, disabled: !drag });
  const { active } = useDndContext();
  const from = active?.data.current as
    | { kind?: string; group?: string; index?: number }
    | undefined;
  const roomOver =
    dropping.isOver && !!from && from.kind !== 'participant' && from.kind !== 'category';
  const sibling =
    dropping.isOver &&
    from?.kind === 'category' &&
    !!drag &&
    from.group === drag.group &&
    active?.id !== `category-drag:${spaceId}`;
  const line = `2px solid ${vars.color.accent}`;
  return (
    <div
      ref={(el) => {
        dropping.setNodeRef(el);
        dragging.setNodeRef(el);
      }}
      {...dragging.listeners}
      style={{
        height: '100%',
        boxSizing: 'border-box',
        opacity: dragging.isDragging ? 0.45 : 1,
        outline: roomOver ? line : undefined,
        outlineOffset: '-2px',
        borderTop: sibling && (from?.index ?? 0) > (drag?.index ?? 0) ? line : undefined,
        borderBottom: sibling && (from?.index ?? 0) < (drag?.index ?? 0) ? line : undefined,
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}

function DragWrap({
  drag,
  id,
  isVoice,
  children,
}: {
  drag: { group: string; index: number } | undefined;
  id: string;
  isVoice: boolean;
  children: React.ReactNode;
}) {
  if (!drag) return <>{children}</>;
  return (
    <RoomDragRow id={id} group={drag.group} index={drag.index} isVoice={isVoice}>
      {children}
    </RoomDragRow>
  );
}

function HomeCategoryHeader({
  label,
  isClosed,
  onToggle,
  hasNotif,
  hasMention,
  showAdd,
  onAdd,
}: {
  label: string;
  isClosed: boolean;
  onToggle: () => void;
  hasNotif?: boolean;
  hasMention?: boolean;
  showAdd?: boolean;
  onAdd?: (e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={css.subspaceCategoryHeader} onClick={onToggle}>
      <button
        type="button"
        className={css.subspaceToggle}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-expanded={!isClosed}
      >
        <span className={css.subspaceName}>{label}</span>
        <CaretDownIcon
          size={10}
          weight="bold"
          className={[css.subspaceChevron, isClosed ? css.subspaceChevronClosed : '']
            .filter(Boolean)
            .join(' ')}
        />
        <span className={css.subspaceSpacer} />
        {hasNotif && (
          <span className={hasMention ? css.subspaceUnreadDotMention : css.subspaceUnreadDot} />
        )}
      </button>
      {showAdd && onAdd && (
        <Tooltip content={t('room.create.title')}>
          <button
            type="button"
            aria-label={t('room.create.title')}
            className={css.subspaceAddButton}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(e);
            }}
          >
            <PlusIcon size={12} weight="bold" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

export function RoomListPanel({ onVoiceJoin }: RoomListPanelProps) {
  const { t } = useTranslation();
  const {
    roomRow: roomItemHeight,
    categoryHeader: categoryHeaderHeight,
    dmRow: dmRowHeight,
  } = useUiDensitySizes();
  const [currentRoomId, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const [currentSpaceId] = useAtom(currentSpaceIdAtom);
  const [sidebarView] = useAtom(sidebarViewAtom);
  const [, setCreateRoomOpen] = useAtom(createRoomOpenAtom);
  const setCreateCategoryOpen = useSetAtom(createCategoryOpenAtom);
  const setCreateSpaceOpen = useSetAtom(createSpaceOpenAtom);
  const setAddRoomToSpace = useSetAtom(addRoomToSpaceAtom);
  const [, setNewDmOpen] = useAtom(newDmOpenAtom);
  const elementUi = useAtomValue(callUiAtom);
  // Phones preview a voice room (who is in it) before joining; desktop joins on click.
  const phone = useMediaQuery(PANEL_OVERLAY_QUERY);
  const [voicePreviewId, setVoicePreviewId] = useState<string | null>(null);
  const elementCallActions = useAtomValue(callActionsAtom);
  const [closedNavCategoriesArr, setClosedNavCategoriesArr] = useAtom(closedNavCategoriesAtom);
  const favouriteRooms = useAtomValue(favouriteRoomsAtom);
  const lowPriorityRooms = useAtomValue(lowPriorityRoomsAtom);
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const setNickname = useSpaceNicknamePrompt(client);
  const setActiveStyle = useSetAtom(activeRoomListStyleAtom);
  // The style belongs to the space; the home and direct message lists are always the Matrix style.
  const spaceStyle = useSpaceListStyle(client, sidebarView === 'space' ? currentSpaceId : null);
  const effectiveStyle = sidebarView === 'space' && currentSpaceId ? spaceStyle : 'matrix';
  const modernList = effectiveStyle === 'modern';
  useLayoutEffect(() => {
    setActiveStyle(effectiveStyle);
  }, [effectiveStyle, setActiveStyle]);
  const { openContextMenu } = useContextMenu();
  const spaceBanner = useSpaceBanner(client, sidebarView === 'space' ? currentSpaceId : null);
  const roomActions = useRoomActions();
  const [pinnedSubSpacesArr, setPinnedSubSpacesArr] = useAtom(pinnedSubSpacesAtom);
  const pinnedSubSpaces = useMemo(() => new Set(pinnedSubSpacesArr), [pinnedSubSpacesArr]);
  const [, setSpaceSettings] = useAtom(spaceSettingsRoomIdAtom);
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);
  const showRoomAvatars = useAtomValue(roomAvatarsVisibleAtom);
  const { spaces } = useSpaces();
  const setDrawerOpen = useSetAtom(mobileDrawerOpenAtom);

  const currentSpaceEntry = useMemo(
    () => spaces.find((s) => s.roomId === currentSpaceId) ?? null,
    [spaces, currentSpaceId]
  );

  const handleMarkSpaceAsRead = useCallback(
    (spaceId: string) => {
      markSpaceAsRead(client, sendReadReceipts, spaceId);
    },
    [client, sendReadReceipts]
  );

  const onCreateRoom = useCallback(() => {
    setCreateRoomOpen({ open: true, spaceId: null, spaceName: null });
  }, [setCreateRoomOpen]);

  const onNewDm = useCallback(() => {
    setNewDmOpen(true);
  }, [setNewDmOpen]);

  const buildSpaceMenuItems = useCallback(() => {
    if (!currentSpaceEntry) return [];
    const items = buildSpaceMenu(currentSpaceEntry, {
      t,
      navigate,
      roomActions,
      toast,
      pinnedSubSpaces,
      setPinnedSubSpacesArr,
      setSpaceSettings,
      markSpaceAsRead: handleMarkSpaceAsRead,
      setNickname,
    });
    const spaceId = currentSpaceEntry.roomId;
    // With no "Rooms" heading in the modern style, creating things lives in the space's own menu.
    const createItems =
      effectiveStyle === 'modern' && client && canOrderSpace(client, spaceId)
        ? [
            {
              label: t('room.create.title'),
              icon: <HashStraightIcon size={14} />,
              onClick: () =>
                setCreateRoomOpen({ open: true, spaceId, spaceName: currentSpaceEntry.name }),
            },
            {
              label: t('room.createCategory'),
              icon: <StackIcon size={14} />,
              onClick: () =>
                setCreateCategoryOpen({
                  open: true,
                  parentSpaceId: spaceId,
                  parentSpaceName: currentSpaceEntry.name,
                }),
            },
            { divider: true, label: '', onClick: () => {} },
          ]
        : [];
    // Keep Leave space last.
    return [...createItems, ...items.slice(0, -1), items[items.length - 1]];
  }, [
    setNickname,
    client,
    setCreateRoomOpen,
    setCreateCategoryOpen,
    effectiveStyle,
    currentSpaceEntry,
    t,
    navigate,
    roomActions,
    toast,
    pinnedSubSpaces,
    setPinnedSubSpacesArr,
    setSpaceSettings,
    handleMarkSpaceAsRead,
  ]);

  const buildHomeMenuItems = useCallback(
    () => buildHomeMenu({ t, client, sendReadReceipts, onCreateRoom }),
    [t, client, sendReadReceipts, onCreateRoom]
  );

  const buildDmsMenuItems = useCallback(
    () => buildDmsMenu({ t, client, sendReadReceipts, onNewDm }),
    [t, client, sendReadReceipts, onNewDm]
  );

  const spaceMenuTrigger = useContextMenuTrigger(buildSpaceMenuItems);
  const homeMenuTrigger = useContextMenuTrigger(buildHomeMenuItems);
  const dmMenuTrigger = useContextMenuTrigger(buildDmsMenuItems);

  const handleSpaceMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!currentSpaceEntry) return;
      openContextMenu(e, buildSpaceMenuItems());
    },
    [currentSpaceEntry, openContextMenu, buildSpaceMenuItems]
  );

  const handleSubspaceAdd = useCallback(
    (e: React.MouseEvent, item: HierarchySpaceItem) => {
      const createChannel = () =>
        setCreateRoomOpen({ open: true, spaceId: item.roomId, spaceName: item.name });
      if (modernList && item.isRoot && client && canOrderSpace(client, item.roomId)) {
        openContextMenu(e, [
          {
            label: t('room.create.title'),
            icon: <HashStraightIcon size={14} />,
            onClick: createChannel,
          },
          {
            label: t('room.createCategory'),
            icon: <StackIcon size={14} />,
            onClick: () =>
              setCreateCategoryOpen({
                open: true,
                parentSpaceId: item.roomId,
                parentSpaceName: item.name,
              }),
          },
        ]);
        return;
      }
      // A Matrix-style space has the plain Matrix set: rooms (voice rooms too) and sub-spaces, new or
      // existing, in the space or the sub-space whose heading this is.
      if (!modernList && client && canOrderSpace(client, item.roomId)) {
        const target = { open: true as const, spaceId: item.roomId, spaceName: item.name };
        openContextMenu(e, [
          {
            label: t('room.create.title'),
            icon: <HashStraightIcon size={14} />,
            onClick: createChannel,
          },
          {
            label: t('room.space.addExistingRoom'),
            icon: <PlusIcon size={14} />,
            onClick: () => setAddRoomToSpace(target),
          },
          { divider: true, label: '', onClick: () => {} },
          {
            label: t('room.addSubSpace'),
            icon: <StackIcon size={14} />,
            onClick: () =>
              setCreateSpaceOpen({
                open: true,
                parentSpaceId: item.roomId,
                parentSpaceName: item.name,
              }),
          },
          {
            label: t('room.space.addExistingSubSpace'),
            icon: <StackIcon size={14} />,
            onClick: () => setAddRoomToSpace({ ...target, type: 'subspace' }),
          },
        ]);
        return;
      }
      createChannel();
    },
    [
      setCreateRoomOpen,
      setCreateCategoryOpen,
      setCreateSpaceOpen,
      setAddRoomToSpace,
      modernList,
      client,
      openContextMenu,
      t,
    ]
  );

  const handleHomeAdd = useCallback(
    (_e: React.MouseEvent) => {
      setCreateRoomOpen({ open: true, spaceId: null, spaceName: null });
    },
    [setCreateRoomOpen]
  );

  const handleHomeMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, buildHomeMenuItems());
    },
    [openContextMenu, buildHomeMenuItems]
  );

  const handleDmsMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, buildDmsMenuItems());
    },
    [openContextMenu, buildDmsMenuItems]
  );

  const isDmView = sidebarView === 'dms';
  const isSpaceView = sidebarView === 'space' && !!currentSpaceId;

  const closedCategories = useMemo(() => new Set(closedNavCategoriesArr), [closedNavCategoriesArr]);

  const toggleCategory = useCallback(
    (categoryKey: string) => {
      setClosedNavCategoriesArr((prev) => {
        const next = new Set(prev);
        if (next.has(categoryKey)) {
          next.delete(categoryKey);
        } else {
          next.add(categoryKey);
        }
        return Array.from(next);
      });
    },
    [setClosedNavCategoriesArr]
  );

  const { rooms: homeRooms, loading: homeLoading } = useRooms();
  const dms = useDms(client);

  const hierarchyItems = useSpaceHierarchy(
    isSpaceView ? currentSpaceId : null,
    favouriteRooms,
    modernList
  );

  const spaceFavKey = isSpaceView && currentSpaceId ? `${currentSpaceId}::favourites` : null;
  const spaceLowKey = isSpaceView && currentSpaceId ? `${currentSpaceId}::lowpriority` : null;

  const spaceItems = useMemo((): SpaceListItem[] => {
    if (!isSpaceView || !currentSpaceId || !client) return [];
    const favSet = favouriteRooms;

    const favRooms: HierarchyRoomItem[] = [];
    const lowRooms: HierarchyRoomItem[] = [];
    const rest: HierarchyItem[] = [];
    for (const item of hierarchyItems) {
      if (item.kind === 'room' && favSet.has(item.roomId)) favRooms.push(item);
      else if (item.kind === 'room' && lowPriorityRooms.has(item.roomId)) lowRooms.push(item);
      else rest.push(item);
    }

    const items: SpaceListItem[] = [];
    if (favRooms.length > 0 && spaceFavKey) {
      const favClosed = closedCategories.has(spaceFavKey);
      const favHasMention = favRooms.some((r) => r.entry.hasNotif);
      const favHasNotif = favHasMention || favRooms.some((r) => r.entry.unreadCount > 0);
      items.push({
        kind: 'header',
        item: {
          kind: 'space',
          roomId: spaceFavKey,
          categoryKey: spaceFavKey,
          name: t('room.favourites'),
          avatarMxc: null,
          hasNotif: favHasNotif,
          hasMention: favHasMention,
          isRoot: false,
          depth: 0,
        },
      });
      for (const room of favRooms) {
        if (favClosed && currentRoomId !== room.roomId) continue;
        items.push({ kind: 'room', item: room });
      }
    }

    const hasRootSection = rest.some((i) => i.kind === 'space' && i.isRoot);
    if (!hasRootSection && !modernList) {
      items.push({
        kind: 'header',
        item: {
          kind: 'space',
          roomId: currentSpaceId,
          categoryKey: `${currentSpaceId}::${currentSpaceId}`,
          name: '',
          avatarMxc: null,
          hasNotif: false,
          hasMention: false,
          isRoot: true,
          depth: 0,
        },
      });
    }

    const filterRoom = (h: HierarchyItem): boolean => {
      if (h.kind !== 'room') return true;
      return h.roomId === currentRoomId;
    };

    const collect = (list: HierarchyItem[]): SpaceListItem[] => {
      const out: SpaceListItem[] = [];
      const remaining = [...list];
      while (remaining.length > 0) {
        const head = remaining.shift()!;
        if (head.kind === 'room') {
          out.push({ kind: 'room', item: head });
          continue;
        }
        const depth = head.depth;
        const chunk: HierarchyItem[] = [];
        while (remaining.length > 0 && remaining[0].depth > depth) {
          chunk.push(remaining.shift()!);
        }
        // The modern style has no "Rooms" heading: the space's own channels simply start the list.
        if (modernList && head.isRoot) {
          out.push(...collect(chunk));
          continue;
        }
        const closed = closedCategories.has(head.categoryKey);
        const fullyOpen = !closed;
        // A category stays listed while empty in the modern style: it is how channels get put there.
        if (fullyOpen || head.isRoot || chunk.length > 0 || modernList) {
          out.push({ kind: 'header', item: head });
          if (fullyOpen) {
            out.push(...collect(chunk));
          } else if (head.isRoot) {
            // The root heading's chunk holds the sub-categories too; they keep their own state.
            for (const sub of collect(chunk)) {
              if (
                sub.kind === 'room' &&
                sub.item.depth === head.depth + 1 &&
                !filterRoom(sub.item)
              ) {
                continue;
              }
              out.push(sub);
            }
          } else {
            // A collapsed category hides everything inside it, nested categories included, except
            // the room that is open.
            for (const sub of collect(chunk)) {
              if (sub.kind === 'room' && filterRoom(sub.item)) out.push(sub);
            }
          }
        }
      }
      return out;
    };

    items.push(...collect(rest));

    if (lowRooms.length > 0 && spaceLowKey) {
      const lowClosed = closedCategories.has(spaceLowKey);
      const lowHasMention = lowRooms.some((r) => r.entry.hasNotif);
      const lowHasNotif = lowHasMention || lowRooms.some((r) => r.entry.unreadCount > 0);
      items.push({
        kind: 'header',
        item: {
          kind: 'space',
          roomId: spaceLowKey,
          categoryKey: spaceLowKey,
          name: t('room.lowPriority'),
          avatarMxc: null,
          hasNotif: lowHasNotif,
          hasMention: lowHasMention,
          isRoot: false,
          depth: 0,
        },
      });
      for (const room of lowRooms) {
        if (lowClosed && currentRoomId !== room.roomId) continue;
        items.push({ kind: 'room', item: room });
      }
    }
    return items;
  }, [
    isSpaceView,
    currentSpaceId,
    client,
    favouriteRooms,
    lowPriorityRooms,
    hierarchyItems,
    closedCategories,
    currentRoomId,
    spaceFavKey,
    spaceLowKey,
    modernList,
    t,
  ]);

  const spaceVoiceRoomIds = useMemo(
    () =>
      spaceItems
        .filter((i): i is Extract<SpaceListItem, { kind: 'room' }> => i.kind === 'room')
        .filter((i) => i.item.entry.hasVoiceRoom)
        .map((i) => i.item.roomId),
    [spaceItems]
  );
  const homeVoiceRoomIds = useMemo(
    () => homeRooms.filter((r) => r.hasVoiceRoom).map((r) => r.roomId),
    [homeRooms]
  );
  const voiceRoomIds = isSpaceView ? spaceVoiceRoomIds : homeVoiceRoomIds;

  const membershipRoomIds = useMemo(() => {
    if (isDmView) return dms.map((d) => d.roomId);
    if (isSpaceView) {
      return spaceItems
        .filter((i): i is Extract<SpaceListItem, { kind: 'room' }> => i.kind === 'room')
        .map((i) => i.item.roomId);
    }
    return homeRooms.map((r) => r.roomId);
  }, [isDmView, isSpaceView, spaceItems, dms, homeRooms]);

  const serverMemberships = useCallMemberships(client, membershipRoomIds);

  // Joining a voice room shows you in it straight away, not once the server has echoed your
  // membership back. Only while the call UI is joining this room, and not once you are listed.
  const joiningRoomId = elementUi.phase !== 'idle' ? elementUi.roomId : null;
  const myUserId = client?.getUserId() ?? null;
  const membershipsMap = useMemo(() => {
    if (!joiningRoomId || !myUserId || !voiceRoomIds.includes(joiningRoomId)) {
      return serverMemberships;
    }
    const members = serverMemberships.get(joiningRoomId) ?? [];
    if (members.some((m) => m.userId === myUserId && !m.isExpired())) return serverMemberships;
    const joinedAt = Date.now();
    const self = {
      userId: myUserId,
      isExpired: () => false,
      createdTs: () => joinedAt,
    } as unknown as CallMembership;
    return new Map(serverMemberships).set(joiningRoomId, [...members, self]);
  }, [serverMemberships, joiningRoomId, myUserId, voiceRoomIds]);

  const participantCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const roomId of voiceRoomIds) {
      const members = membershipsMap.get(roomId);
      if (!members) continue;
      const count = uniqueMembers(members).length;
      if (count > 0) map.set(roomId, count);
    }
    return map;
  }, [membershipsMap, voiceRoomIds]);

  const activeCallRoomIds = useMemo(() => {
    const active = new Set<string>();
    for (const [roomId, members] of membershipsMap) {
      if (uniqueMembers(members).length > 0) active.add(roomId);
    }
    return active;
  }, [membershipsMap]);

  const voiceMembersByRoom = useMemo(() => {
    const map = new Map<string, CallMembership[]>();
    for (const [roomId, members] of membershipsMap) {
      if (uniqueMembers(members).length > 0) map.set(roomId, members);
    }
    return map;
  }, [membershipsMap]);

  const getRoomEntryHeight = useCallback(
    (entry: RoomEntry) => {
      if (!entry.hasVoiceRoom) return roomItemHeight;
      const count = participantCounts.get(entry.roomId) ?? 0;
      return roomItemHeight + computeParticipantsBlockHeight(count);
    },
    [participantCounts, roomItemHeight]
  );

  const homeItems = useMemo((): HomeListItem[] => {
    if (isSpaceView || isDmView || !client) return [];
    const favSet = favouriteRooms;

    const favEntries: RoomEntry[] = [];
    for (const entry of homeRooms) {
      if (favSet.has(entry.roomId)) {
        favEntries.push(entry);
      }
    }

    const lowEntries = homeRooms.filter(
      (entry) => !favSet.has(entry.roomId) && lowPriorityRooms.has(entry.roomId)
    );
    const otherEntries = homeRooms.filter(
      (entry) => !favSet.has(entry.roomId) && !lowPriorityRooms.has(entry.roomId)
    );

    const items: HomeListItem[] = [];
    const pushSection = (itemKey: string, entries: RoomEntry[]) => {
      const hasMention = entries.some((entry) => entry.hasNotif);
      const hasNotif = hasMention || entries.some((entry) => entry.unreadCount > 0);
      items.push({
        kind: 'header',
        itemKey,
        label:
          itemKey === HOME_FAVOURITES_CATEGORY
            ? t('room.favourites')
            : itemKey === HOME_LOW_PRIORITY_CATEGORY
              ? t('room.lowPriority')
              : t('room.title'),
        hasNotif,
        hasMention,
        showAdd: itemKey === HOME_ROOMS_CATEGORY,
      });
      const closed = closedCategories.has(itemKey);
      for (const entry of entries) {
        if (closed && currentRoomId !== entry.roomId) continue;
        items.push({ kind: 'room', entry });
      }
    };

    if (favEntries.length > 0) pushSection(HOME_FAVOURITES_CATEGORY, favEntries);
    pushSection(HOME_ROOMS_CATEGORY, otherEntries);
    if (lowEntries.length > 0) pushSection(HOME_LOW_PRIORITY_CATEGORY, lowEntries);
    return items;
  }, [
    isSpaceView,
    isDmView,
    client,
    favouriteRooms,
    lowPriorityRooms,
    homeRooms,
    closedCategories,
    currentRoomId,
    t,
  ]);

  const roomListRef = useRef<HTMLDivElement>(null);
  const bottomDockRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = bottomDockRef.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const margin = parseFloat(style.marginTop) + parseFloat(style.marginBottom);
      root.style.setProperty('--bottom-dock-inset', `${Math.ceil(rect.height + margin + 8)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--bottom-dock-inset');
    };
  }, []);

  const spaceVirtualizer = useVirtualizer({
    count: spaceItems.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: (index) => {
      const item = spaceItems[index];
      if (item.kind === 'header') return categoryHeaderHeight;
      return getRoomEntryHeight(item.item.entry);
    },
    getItemKey: (index) => {
      const item = spaceItems[index];
      return item.kind === 'header'
        ? `header-${item.item.categoryKey}`
        : `room-${item.item.categoryKey}-${item.item.roomId}`;
    },
    overscan: LIST_OVERSCAN,
    enabled: isSpaceView,
  });

  const homeVirtualizer = useVirtualizer({
    count: homeItems.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: (index) => {
      const item = homeItems[index];
      return item.kind === 'header' ? categoryHeaderHeight : getRoomEntryHeight(item.entry);
    },
    getItemKey: (index) => {
      const item = homeItems[index];
      return item.kind === 'header' ? `header-${item.itemKey}` : item.entry.roomId;
    },
    overscan: LIST_OVERSCAN,
    enabled: !isDmView && !isSpaceView,
  });

  const dmVirtualizer = useVirtualizer({
    count: dms.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: () => dmRowHeight,
    overscan: LIST_OVERSCAN,
    enabled: isDmView,
  });

  useEffect(() => {
    spaceVirtualizer.measure();
    homeVirtualizer.measure();
    dmVirtualizer.measure();
  }, [roomItemHeight, categoryHeaderHeight, spaceVirtualizer, homeVirtualizer, dmVirtualizer]);

  useEffect(() => {
    if (isSpaceView) spaceVirtualizer.measure();
  }, [participantCounts, spaceItems, spaceVirtualizer, isSpaceView]);

  useEffect(() => {
    if (isSpaceView && roomListRef.current) {
      roomListRef.current.scrollTop = 0;
    }
  }, [currentSpaceId, isSpaceView]);

  useEffect(() => {
    if (!isSpaceView && !isDmView) homeVirtualizer.measure();
  }, [participantCounts, homeItems, homeVirtualizer, isSpaceView, isDmView]);

  // Modern style: rooms the user may reorder, with whether each can still move up or down.
  const { movable, siblingsOf, groupOf } = useMemo(() => {
    const movableRooms = new Map<string, { up: boolean; down: boolean }>();
    const siblings = new Map<string, string[]>();
    const groupOfRoom = new Map<string, { group: string; index: number }>();
    if (!modernList || !isSpaceView || !client)
      return { movable: movableRooms, siblingsOf: siblings, groupOf: groupOfRoom };
    const groups = new Map<string, HierarchyRoomItem[]>();
    for (const it of spaceItems) {
      if (it.kind !== 'room') continue;
      // Favourites and low priority are lists of their own, not part of the category's order.
      if (favouriteRooms.has(it.item.roomId) || lowPriorityRooms.has(it.item.roomId)) continue;
      // Voice channels sit below text channels, so each kind is ordered on its own.
      const key = `${it.item.categoryKey}|${it.item.entry.hasVoiceRoom ? 'voice' : 'text'}`;
      if (!canOrderSpace(client, it.item.parentSpaceId)) continue;
      groups.set(key, [...(groups.get(key) ?? []), it.item]);
    }
    for (const [group, rooms] of groups.entries()) {
      const ids = rooms.map((r) => r.roomId);
      rooms.forEach((r, i) => {
        movableRooms.set(r.roomId, { up: i > 0, down: i < rooms.length - 1 });
        groupOfRoom.set(r.roomId, { group, index: i });
        siblings.set(r.roomId, ids);
      });
    }
    return { movable: movableRooms, siblingsOf: siblings, groupOf: groupOfRoom };
  }, [modernList, isSpaceView, client, spaceItems, favouriteRooms, lowPriorityRooms]);

  // Where each movable room can go: the space itself and its other categories.
  // Modern style: where each category sits among the categories next to it, for those the user may
  // reorder. A category's parent is the segment before it in its key.
  const { categoryDrag, categorySiblings } = useMemo(() => {
    const info = new Map<string, { group: string; index: number; parent: string }>();
    const siblings = new Map<string, string[]>();
    if (!modernList || !isSpaceView || !client)
      return { categoryDrag: info, categorySiblings: siblings };
    const byParent = new Map<string, string[]>();
    for (const it of hierarchyItems) {
      if (it.kind !== 'space' || it.isRoot) continue;
      if (it.categoryKey === spaceFavKey || it.categoryKey === spaceLowKey) continue;
      const parts = it.categoryKey.split('::');
      const parent = parts[parts.length - 2];
      byParent.set(parent, [...(byParent.get(parent) ?? []), it.roomId]);
    }
    for (const [parent, ids] of byParent.entries()) {
      if (ids.length < 2 || !canOrderSpace(client, parent)) continue;
      ids.forEach((id, index) => {
        info.set(id, { group: `categories|${parent}`, index, parent });
        siblings.set(id, ids);
      });
    }
    return { categoryDrag: info, categorySiblings: siblings };
  }, [modernList, isSpaceView, client, hierarchyItems, spaceFavKey, spaceLowKey]);

  const categoriesOf = useMemo(() => {
    const out = new Map<string, { id: string; name: string }[]>();
    if (!modernList || !isSpaceView || !client) return out;
    // From the hierarchy rather than the visible rows: the space's own level has no heading here
    // but is still somewhere a room can be moved to.
    const headers = hierarchyItems.flatMap((it) => (it.kind === 'space' ? [it] : []));
    for (const it of spaceItems) {
      if (it.kind !== 'room' || !movable.has(it.item.roomId)) continue;
      const here = it.item.parentSpaceId;
      const targets = headers
        .filter((h) => h.roomId !== here && canOrderSpace(client, h.roomId))
        .map((h) => ({ id: h.roomId, name: h.isRoot ? t('room.noCategory') : h.name }));
      out.set(it.item.roomId, targets);
    }
    return out;
  }, [modernList, isSpaceView, client, spaceItems, hierarchyItems, movable, t]);

  const moveToCategory = useCallback(
    (roomId: string, targetSpaceId: string) => {
      const row = spaceItems.find((it) => it.kind === 'room' && it.item.roomId === roomId);
      if (!client || !row || row.kind !== 'room') return;
      moveRoomToCategory(client, roomId, row.item.parentSpaceId, targetSpaceId).catch((err) =>
        toast.error(t('room.moveFailed', { error: getErrorMessage(err) }))
      );
    },
    [client, spaceItems, toast, t]
  );

  // A long press (touch) or a short drag (mouse) lifts a room; dropping it on another room of the
  // same group puts it in that place.
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } })
  );
  // Screen readers get names, not the Matrix IDs the drag items are keyed by.
  const dragAnnouncements = useMemo<Announcements>(() => {
    const label = (id: string | number): string => {
      const key = String(id);
      if (key.startsWith('participant:')) {
        const userId = key.slice('participant:'.length).split(':!')[0];
        return client?.getUser(userId)?.displayName ?? userId;
      }
      const spaceId = key.replace(/^category(-drag)?:/, '');
      return client?.getRoom(spaceId)?.name ?? spaceId;
    };
    return {
      onDragStart: ({ active }) => t('room.drag.pickedUp', { name: label(active.id) }),
      onDragOver: ({ over }) => (over ? t('room.drag.over', { name: label(over.id) }) : undefined),
      onDragEnd: ({ active, over }) =>
        over
          ? t('room.drag.dropped', { name: label(active.id), target: label(over.id) })
          : t('room.drag.cancelled', { name: label(active.id) }),
      onDragCancel: ({ active }) => t('room.drag.cancelled', { name: label(active.id) }),
    };
  }, [client, t]);

  const handleRoomDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!client || !over || active.id === over.id) return;
      const dragged = active.data.current as
        | { kind?: string; userId?: string; fromRoomId?: string }
        | undefined;
      if (dragged?.kind === 'category') {
        // A category dropped on a sibling category takes its place.
        const spaceId = String(active.id).slice('category-drag:'.length);
        const overId = String(over.id);
        const targetId = overId.startsWith('category:') ? overId.slice('category:'.length) : '';
        const ids = categorySiblings.get(spaceId);
        const from = categoryDrag.get(spaceId);
        const to = categoryDrag.get(targetId);
        if (!ids || !from || !to || from.group !== to.group) return;
        placeSpaceChild(client, from.parent, ids, spaceId, to.index).catch((err) =>
          toast.error(t('room.moveFailed', { error: getErrorMessage(err) }))
        );
        return;
      }
      if (dragged?.kind === 'participant') {
        // A person dropped on a voice channel: ask them to join it.
        const targetId = String(over.id);
        const target = client.getRoom(targetId);
        if (!dragged.userId || !dragged.fromRoomId || !target || !isVoiceRoom(target)) return;
        if (!mayMoveBetween(client, client.getSafeUserId(), dragged.fromRoomId, targetId)) return;
        moveVoiceUser(client, dragged.fromRoomId, dragged.userId, targetId).catch((err) =>
          toast.error(t('room.moveFailed', { error: getErrorMessage(err) }))
        );
        return;
      }
      const from = groupOf.get(String(active.id));
      const to = groupOf.get(String(over.id));
      const ids = siblingsOf.get(String(active.id));
      const row = spaceItems.find((it) => it.kind === 'room' && it.item.roomId === active.id);
      if (!from || !ids || !row || row.kind !== 'room') return;
      // Dropped on a category heading, or on a room of another category: move it there.
      const overId = String(over.id);
      const overRow = spaceItems.find((it) => it.kind === 'room' && it.item.roomId === overId);
      const targetSpaceId = overId.startsWith('category:')
        ? overId.slice('category:'.length)
        : overRow?.kind === 'room'
          ? overRow.item.parentSpaceId
          : undefined;
      if (targetSpaceId && targetSpaceId !== row.item.parentSpaceId) {
        if (categoriesOf.get(row.item.roomId)?.some((c) => c.id === targetSpaceId))
          moveToCategory(row.item.roomId, targetSpaceId);
        return;
      }
      if (!to || from.group !== to.group) return;
      placeSpaceChild(client, row.item.parentSpaceId, ids, String(active.id), to.index).catch(
        (err) => toast.error(t('room.moveFailed', { error: getErrorMessage(err) }))
      );
    },
    [
      client,
      groupOf,
      siblingsOf,
      spaceItems,
      categoriesOf,
      moveToCategory,
      categorySiblings,
      categoryDrag,
      toast,
      t,
    ]
  );

  const moveRoom = useCallback(
    (roomId: string, direction: -1 | 1) => {
      const ids = siblingsOf.get(roomId);
      const parent =
        client?.getRoom(roomId) &&
        spaceItems.find((it) => it.kind === 'room' && it.item.roomId === roomId);
      if (!client || !ids || !parent || parent.kind !== 'room') return;
      moveSpaceChild(client, parent.item.parentSpaceId, ids, roomId, direction).catch((err) =>
        toast.error(t('room.moveFailed', { error: getErrorMessage(err) }))
      );
    },
    [client, siblingsOf, spaceItems, toast, t]
  );

  const selectRoom = useCallback(
    (roomId: string, isDm = false) => {
      const room = client?.getRoom(roomId);
      const navigateToRoom = () => {
        setCurrentRoomId(roomId);
        setDrawerOpen(false);
        navigate(`/${isDm ? 'dm' : 'r'}/${encodeURIComponent(roomId)}`, {
          state: { sidebarView, currentSpaceId },
        });
      };
      const isVoice = !isDm && !!room && isVoiceRoom(room);
      if (isVoice) {
        if (elementUi.roomId === roomId) {
          navigateToRoom();
          elementCallActions?.setPresentation('room');
          return;
        }
        if (phone) setVoicePreviewId(roomId);
        else onVoiceJoin(roomId);
        return;
      }
      navigateToRoom();
    },
    [
      setCurrentRoomId,
      navigate,
      sidebarView,
      currentSpaceId,
      client,
      elementUi.roomId,
      elementCallActions,
      onVoiceJoin,
      setDrawerOpen,
      phone,
    ]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      if (isTextFieldTarget(e)) return;
      let ids: string[];
      let virtualizer: { scrollToIndex: (index: number, opts?: { align?: 'auto' }) => void };
      if (isDmView) {
        ids = dms.map((d) => d.roomId);
        virtualizer = dmVirtualizer;
      } else if (isSpaceView) {
        ids = spaceItems.map((it) => (it.kind === 'room' ? it.item.roomId : ''));
        virtualizer = spaceVirtualizer;
      } else {
        ids = homeItems.map((it) => (it.kind === 'room' ? it.entry.roomId : ''));
        virtualizer = homeVirtualizer;
      }
      const roomIndexes = ids.flatMap((id, index) => (id ? [index] : []));
      if (roomIndexes.length === 0) return;
      e.preventDefault();
      const down = e.key === 'ArrowDown';
      const current = roomIndexes.findIndex((index) => ids[index] === currentRoomId);
      const nextPos =
        current === -1
          ? down
            ? 0
            : roomIndexes.length - 1
          : (current + (down ? 1 : -1) + roomIndexes.length) % roomIndexes.length;
      const index = roomIndexes[nextPos];
      const roomId = ids[index];
      setCurrentRoomId(roomId);
      navigate(`/${isDmView ? 'dm' : 'r'}/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
      virtualizer.scrollToIndex(index, { align: 'auto' });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    isDmView,
    isSpaceView,
    dms,
    spaceItems,
    homeItems,
    dmVirtualizer,
    spaceVirtualizer,
    homeVirtualizer,
    currentRoomId,
    setCurrentRoomId,
    navigate,
    sidebarView,
    currentSpaceId,
  ]);

  const openRoomChat = useSetAtom(openRoomChatAtom);

  const openChatOnly = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      setDrawerOpen(false);
      navigate(`/r/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
      openRoomChat(roomId);
    },
    [setCurrentRoomId, navigate, sidebarView, currentSpaceId, setDrawerOpen, openRoomChat]
  );

  const openVoiceChat = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      setDrawerOpen(false);
      navigate(`/r/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
      if (client && elementUi.roomId !== roomId) {
        const room = client.getRoom(roomId);
        if (room && room.getMyMembership() === 'join' && isVoiceRoom(room)) onVoiceJoin(roomId);
      }
    },
    [
      setCurrentRoomId,
      navigate,
      sidebarView,
      currentSpaceId,
      client,
      elementUi.roomId,
      onVoiceJoin,
      setDrawerOpen,
    ]
  );

  const isSpaceContext = sidebarView === 'space' && !!currentSpaceId;
  const headerLabel = isDmView
    ? t('room.dm.directMessages')
    : isSpaceContext
      ? (client?.getRoom(currentSpaceId!)?.name ?? t('room.home'))
      : t('room.home');

  const renderSpaceList = () => {
    return (
      <div ref={roomListRef} className={css.roomList}>
        <DndContext
          sensors={dragSensors}
          // Rows stay put while dragging, so what is under the pointer decides the drop.
          collisionDetection={pointerWithin}
          onDragEnd={handleRoomDragEnd}
          accessibility={{ announcements: dragAnnouncements }}
        >
          <DragGhost client={client} />
          <div style={{ height: spaceVirtualizer.getTotalSize(), position: 'relative' }}>
            {spaceVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = spaceItems[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    boxSizing: 'border-box',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {item.kind === 'header' ? (
                    item.item.categoryKey === spaceFavKey ||
                    item.item.categoryKey === spaceLowKey ? (
                      <HomeCategoryHeader
                        label={item.item.name}
                        isClosed={closedCategories.has(item.item.categoryKey)}
                        onToggle={() => toggleCategory(item.item.categoryKey)}
                        hasNotif={item.item.hasNotif}
                        hasMention={item.item.hasMention}
                      />
                    ) : (
                      <CategoryDrop
                        spaceId={item.item.roomId}
                        drag={categoryDrag.get(item.item.roomId)}
                      >
                        <SubspaceCategoryHeader
                          item={item.item}
                          isClosed={closedCategories.has(item.item.categoryKey)}
                          onToggle={toggleCategory}
                          onAdd={handleSubspaceAdd}
                          client={client}
                          showAvatar={showRoomAvatars}
                        />
                      </CategoryDrop>
                    )
                  ) : (
                    <DragWrap
                      drag={groupOf.get(item.item.roomId)}
                      id={item.item.roomId}
                      isVoice={item.item.entry.hasVoiceRoom}
                    >
                      <RoomListItem
                        entry={item.item.entry}
                        isActive={currentRoomId === item.item.roomId}
                        hasActiveCall={
                          activeCallRoomIds.has(item.item.roomId) && !item.item.entry.hasVoiceRoom
                        }
                        isInCall={elementUi.roomId === item.item.roomId}
                        voiceMembers={voiceMembersByRoom.get(item.item.roomId)}
                        canMoveVoiceUsers={movable.has(item.item.roomId)}
                        onSelect={selectRoom}
                        onOpenChat={openVoiceChat}
                        onOpenChatOnly={openChatOnly}
                        canMoveUp={movable.get(item.item.roomId)?.up}
                        canMoveDown={movable.get(item.item.roomId)?.down}
                        onMove={movable.has(item.item.roomId) ? moveRoom : undefined}
                        categoryTargets={categoriesOf.get(item.item.roomId)}
                        onMoveToCategory={
                          categoriesOf.has(item.item.roomId) ? moveToCategory : undefined
                        }
                      />
                    </DragWrap>
                  )}
                </div>
              );
            })}
          </div>
        </DndContext>
      </div>
    );
  };

  const renderHomeList = () => {
    if (homeLoading && homeRooms.length === 0) {
      return (
        <div ref={roomListRef} className={css.roomList}>
          <div className={css.skeletonList}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={css.skeletonRow}>
                <div className={css.skeletonAvatar} />
                <div className={css.skeletonLines}>
                  <div className={css.skeletonLine} />
                  <div className={css.skeletonLineShort} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div ref={roomListRef} className={css.roomList}>
        <div style={{ height: homeVirtualizer.getTotalSize(), position: 'relative' }}>
          {homeVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = homeItems[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {item.kind === 'header' ? (
                  <HomeCategoryHeader
                    label={item.label}
                    isClosed={closedCategories.has(item.itemKey)}
                    onToggle={() => toggleCategory(item.itemKey)}
                    hasNotif={item.hasNotif}
                    hasMention={item.hasMention}
                    showAdd={item.showAdd}
                    onAdd={handleHomeAdd}
                  />
                ) : (
                  <RoomListItem
                    entry={item.entry}
                    isActive={currentRoomId === item.entry.roomId}
                    hasActiveCall={
                      activeCallRoomIds.has(item.entry.roomId) && !item.entry.hasVoiceRoom
                    }
                    isInCall={elementUi.roomId === item.entry.roomId}
                    voiceMembers={voiceMembersByRoom.get(item.entry.roomId)}
                    onSelect={selectRoom}
                    onOpenChat={openVoiceChat}
                    onOpenChatOnly={openChatOnly}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDmList = () => {
    if (dms.length === 0) {
      return (
        <div ref={roomListRef} className={css.roomList}>
          <div className={css.emptyList}>{t('room.noDms')}</div>
        </div>
      );
    }
    return (
      <div ref={roomListRef} className={css.roomList}>
        <div style={{ height: dmVirtualizer.getTotalSize(), position: 'relative' }}>
          {dmVirtualizer.getVirtualItems().map((virtualRow) => {
            const entry = dms[virtualRow.index];
            return (
              <div
                key={entry.roomId}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <DmListItem
                  entry={entry}
                  isActive={currentRoomId === entry.roomId}
                  hasActiveCall={activeCallRoomIds.has(entry.roomId)}
                  isInCall={elementUi.roomId === entry.roomId}
                  onSelect={selectRoom}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={css.roomListPanel}>
      {sidebarView === 'space' && spaceBanner && (
        <SpaceBannerView client={client} banner={spaceBanner} className={bannerCss.headerBanner} />
      )}
      <header className={css.roomHeader}>
        <Tooltip content={headerLabel}>
          <h2 className={css.roomHeaderTitle}>
            <span className={css.roomHeaderLabel}>{headerLabel}</span>
          </h2>
        </Tooltip>
        <div className={css.roomHeaderActions}>
          {sidebarView === 'space' && currentSpaceEntry ? (
            <IconButton
              size="sm"
              tooltip={t('common.menu')}
              aria-label={t('common.menu')}
              onClick={handleSpaceMenu}
              {...spaceMenuTrigger}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          ) : isDmView ? (
            <IconButton
              size="sm"
              tooltip={t('common.markRead')}
              aria-label={t('common.markRead')}
              onClick={handleDmsMenu}
              {...dmMenuTrigger}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          ) : (
            <IconButton
              size="sm"
              tooltip={t('common.markRead')}
              aria-label={t('common.markRead')}
              onClick={handleHomeMenu}
              {...homeMenuTrigger}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          )}
        </div>
      </header>

      {!isDmView && !isSpaceView && (
        <button
          type="button"
          className={currentRoomId === null ? css.homeLinkActive : css.homeLink}
          aria-current={currentRoomId === null ? 'page' : undefined}
          onClick={() => {
            setDrawerOpen(false);
            navigate('/', { state: { sidebarView: 'home', currentSpaceId: null } });
          }}
        >
          <HouseIcon size={18} weight={currentRoomId === null ? 'fill' : 'regular'} />
          <span className={css.homeLinkLabel}>{t('room.home')}</span>
        </button>
      )}

      {isDmView ? renderDmList() : isSpaceView ? renderSpaceList() : renderHomeList()}

      <div ref={bottomDockRef} className={css.bottomDock}>
        <ElementCallBar />
        <UserPanel />
      </div>
      {voicePreviewId && client && (
        <VoiceJoinSheet
          client={client}
          roomId={voicePreviewId}
          onClose={() => setVoicePreviewId(null)}
          onJoin={() => {
            onVoiceJoin(voicePreviewId);
            setVoicePreviewId(null);
          }}
        />
      )}
    </div>
  );
}
