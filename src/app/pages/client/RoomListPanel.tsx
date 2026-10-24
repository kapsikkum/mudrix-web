import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  CaretDownIcon,
  DotsThreeVerticalIcon,
  HashStraightIcon,
  PlusIcon,
  StackIcon,
} from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useNavigate } from 'react-router-dom';
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
import { getErrorMessage } from '@/util/error';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { RoomDragRow } from './RoomDragRow';
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
import { elementCallActionsAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  useElementCallMemberships,
  uniqueMembers,
} from '@/app/features/calls/useElementCallMemberships';
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
  roomListStyleAtom,
} from '@/app/store/atoms/settings';
import { buildSpaceMenu, markSpaceAsRead, buildHomeMenu, buildDmsMenu } from './spaceContextMenu';
import { RoomListItem, DmListItem } from './RoomListItem';
import { UserPanel } from './UserPanel';
import { isTextFieldTarget } from '@/app/features/keyboardShortcuts/keyEvents';
import * as css from './RoomListPanel.css';
import { isVoiceRoom } from '@/util/matrix';
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
        <span className={css.subspaceName}>{item.isRoot ? 'Rooms' : item.name}</span>
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

function DragWrap({
  drag,
  id,
  children,
}: {
  drag: { group: string; index: number } | undefined;
  id: string;
  children: React.ReactNode;
}) {
  if (!drag) return <>{children}</>;
  return (
    <RoomDragRow id={id} group={drag.group} index={drag.index}>
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
  const [, setNewDmOpen] = useAtom(newDmOpenAtom);
  const elementUi = useAtomValue(elementCallUiAtom);
  const elementCallActions = useAtomValue(elementCallActionsAtom);
  const [closedNavCategoriesArr, setClosedNavCategoriesArr] = useAtom(closedNavCategoriesAtom);
  const favouriteRooms = useAtomValue(favouriteRoomsAtom);
  const lowPriorityRooms = useAtomValue(lowPriorityRoomsAtom);
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const modernList = useAtomValue(roomListStyleAtom) === 'modern';
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
    return buildSpaceMenu(currentSpaceEntry, {
      t,
      navigate,
      roomActions,
      toast,
      pinnedSubSpaces,
      setPinnedSubSpacesArr,
      setSpaceSettings,
      markSpaceAsRead: handleMarkSpaceAsRead,
    });
  }, [
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
      createChannel();
    },
    [setCreateRoomOpen, setCreateCategoryOpen, modernList, client, openContextMenu, t]
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

  const hierarchyItems = useSpaceHierarchy(isSpaceView ? currentSpaceId : null, favouriteRooms);

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
    if (!hasRootSection) {
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
        const closed = closedCategories.has(head.categoryKey);
        const fullyOpen = !closed;
        if (fullyOpen || head.isRoot || chunk.length > 0) {
          out.push({ kind: 'header', item: head });
          if (fullyOpen) {
            out.push(...collect(chunk));
          } else {
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

  const membershipsMap = useElementCallMemberships(client, membershipRoomIds);

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
        : `room-${item.item.roomId}`;
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
      if (it.item.categoryKey === spaceFavKey || it.item.categoryKey === spaceLowKey) continue;
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
  }, [modernList, isSpaceView, client, spaceItems, spaceFavKey, spaceLowKey]);

  // Where each movable room can go: the space itself and its other categories.
  const categoriesOf = useMemo(() => {
    const out = new Map<string, { id: string; name: string }[]>();
    if (!modernList || !isSpaceView || !client) return out;
    const headers = spaceItems.flatMap((it) =>
      it.kind === 'header' &&
      it.item.categoryKey !== spaceFavKey &&
      it.item.categoryKey !== spaceLowKey
        ? [it.item]
        : []
    );
    for (const it of spaceItems) {
      if (it.kind !== 'room' || !movable.has(it.item.roomId)) continue;
      const here = it.item.parentSpaceId;
      const targets = headers
        .filter((h) => h.roomId !== here && canOrderSpace(client, h.roomId))
        .map((h) => ({ id: h.roomId, name: h.isRoot ? t('room.noCategory') : h.name }));
      out.set(it.item.roomId, targets);
    }
    return out;
  }, [modernList, isSpaceView, client, spaceItems, movable, spaceFavKey, spaceLowKey, t]);

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
  const handleRoomDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!client || !over || active.id === over.id) return;
      const from = groupOf.get(String(active.id));
      const to = groupOf.get(String(over.id));
      const ids = siblingsOf.get(String(active.id));
      const row = spaceItems.find((it) => it.kind === 'room' && it.item.roomId === active.id);
      if (!from || !to || from.group !== to.group || !ids || !row || row.kind !== 'room') return;
      placeSpaceChild(client, row.item.parentSpaceId, ids, String(active.id), to.index).catch(
        (err) => toast.error(t('room.moveFailed', { error: getErrorMessage(err) }))
      );
    },
    [client, groupOf, siblingsOf, spaceItems, toast, t]
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
        onVoiceJoin(roomId);
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
        <DndContext sensors={dragSensors} onDragEnd={handleRoomDragEnd}>
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
                      <SubspaceCategoryHeader
                        item={item.item}
                        isClosed={closedCategories.has(item.item.categoryKey)}
                        onToggle={toggleCategory}
                        onAdd={handleSubspaceAdd}
                        client={client}
                        showAvatar={showRoomAvatars}
                      />
                    )
                  ) : (
                    <DragWrap drag={groupOf.get(item.item.roomId)} id={item.item.roomId}>
                      <RoomListItem
                        entry={item.item.entry}
                        isActive={currentRoomId === item.item.roomId}
                        hasActiveCall={
                          activeCallRoomIds.has(item.item.roomId) && !item.item.entry.hasVoiceRoom
                        }
                        isInCall={elementUi.roomId === item.item.roomId}
                        voiceMembers={voiceMembersByRoom.get(item.item.roomId)}
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

      {isDmView ? renderDmList() : isSpaceView ? renderSpaceList() : renderHomeList()}

      <div ref={bottomDockRef} className={css.bottomDock}>
        <ElementCallBar />
        <UserPanel />
      </div>
    </div>
  );
}
