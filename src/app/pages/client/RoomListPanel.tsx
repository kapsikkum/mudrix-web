import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  StackIcon,
  CaretDownIcon,
  DotsThreeVerticalIcon,
  PlusIcon,
  HashStraightIcon,
  SpeakerHighIcon,
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
  newDmOpenAtom,
  closedNavCategoriesAtom,
  pinnedSubSpacesAtom,
  spaceSettingsRoomIdAtom,
  mobileDrawerOpenAtom,
  favouriteRoomsAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
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
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  useElementCallMemberships,
  uniqueMembers,
} from '@/app/features/calls/useElementCallMemberships';
import { computeParticipantsBlockHeight } from '@/app/features/voice/participantSize';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useRoomActions } from './hooks/useRoomActions';
import { sendReadReceiptsAtom } from '@/app/store/atoms/settings';
import { buildSpaceMenu, markSpaceAsRead, buildHomeMenu, buildDmsMenu } from './spaceContextMenu';
import { RoomListItem, DmListItem } from './RoomListItem';
import { UserPanel } from './UserPanel';
import * as css from './RoomListPanel.css';
import { isVoiceRoom } from '@/util/matrix';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';

const ROOM_ITEM_HEIGHT = 40;
const CATEGORY_HEADER_HEIGHT = 26;
const LIST_OVERSCAN = 5;

const HOME_FAVOURITES_CATEGORY = 'home-favourites';
const HOME_ROOMS_CATEGORY = 'home-rooms';

type HomeListItem =
  | { kind: 'header'; itemKey: string; label: string; hasNotif: boolean; showAdd: boolean }
  | { kind: 'room'; entry: RoomEntry };

type SpaceListItem =
  { kind: 'header'; item: HierarchySpaceItem } | { kind: 'room'; item: HierarchyRoomItem };

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
}: SubspaceCategoryHeaderProps) {
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
        {!item.isRoot && item.avatarMxc && (
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
        {item.hasNotif && <span className={css.subspaceUnreadDot} />}
      </button>
      {!item.isInvite && (
        <Tooltip content={t('common.add')}>
          <button
            type="button"
            aria-label={t('common.add')}
            className={css.subspaceAddButton}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(e, item);
            }}
          >
            <PlusIcon size={12} weight="bold" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function HomeCategoryHeader({
  label,
  isClosed,
  onToggle,
  hasNotif,
  showAdd,
  onAdd,
}: {
  label: string;
  isClosed: boolean;
  onToggle: () => void;
  hasNotif?: boolean;
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
        {hasNotif && <span className={css.subspaceUnreadDot} />}
      </button>
      {showAdd && onAdd && (
        <Tooltip content={t('common.add')}>
          <button
            type="button"
            aria-label={t('common.add')}
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
  const [currentRoomId, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const [currentSpaceId] = useAtom(currentSpaceIdAtom);
  const [sidebarView] = useAtom(sidebarViewAtom);
  const [, setCreateRoomOpen] = useAtom(createRoomOpenAtom);
  const [, setNewDmOpen] = useAtom(newDmOpenAtom);
  const elementUi = useAtomValue(elementCallUiAtom);
  const [closedNavCategoriesArr, setClosedNavCategoriesArr] = useAtom(closedNavCategoriesAtom);
  const favouriteRooms = useAtomValue(favouriteRoomsAtom);
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [pinnedSubSpacesArr, setPinnedSubSpacesArr] = useAtom(pinnedSubSpacesAtom);
  const pinnedSubSpaces = useMemo(() => new Set(pinnedSubSpacesArr), [pinnedSubSpacesArr]);
  const [, setSpaceSettings] = useAtom(spaceSettingsRoomIdAtom);
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);
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

  const onCreateVoiceRoom = useCallback(() => {
    setCreateRoomOpen({ open: true, spaceId: null, spaceName: null, voiceRoom: true });
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
    () => buildHomeMenu({ t, client, sendReadReceipts, onCreateRoom, onCreateVoiceRoom }),
    [t, client, sendReadReceipts, onCreateRoom, onCreateVoiceRoom]
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
      const spaceId = item.roomId;
      const spaceName = item.name;
      openContextMenu(e, [
        {
          label: t('room.addRoom'),
          icon: <HashStraightIcon size={14} />,
          onClick: () => setCreateRoomOpen({ open: true, spaceId, spaceName }),
        },
        {
          label: t('room.addVoiceRoom'),
          icon: <SpeakerHighIcon size={14} />,
          onClick: () => setCreateRoomOpen({ open: true, spaceId, spaceName, voiceRoom: true }),
        },
      ]);
    },
    [openContextMenu, t, setCreateRoomOpen]
  );

  const handleHomeAdd = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, [
        {
          label: t('room.addRoom'),
          icon: <HashStraightIcon size={14} />,
          onClick: () => setCreateRoomOpen({ open: true, spaceId: null, spaceName: null }),
        },
        {
          label: t('room.addVoiceRoom'),
          icon: <SpeakerHighIcon size={14} />,
          onClick: () =>
            setCreateRoomOpen({
              open: true,
              spaceId: null,
              spaceName: null,
              voiceRoom: true,
            }),
        },
      ]);
    },
    [openContextMenu, t, setCreateRoomOpen]
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

  const { rooms: homeRooms, loading: homeLoading } = useRooms(
    isSpaceView ? null : isDmView ? null : null
  );
  const dms = useDms(client);

  const hierarchyItems = useSpaceHierarchy(isSpaceView ? currentSpaceId : null);

  const spaceFavKey = isSpaceView && currentSpaceId ? `${currentSpaceId}::favourites` : null;

  const isSpaceJoined =
    currentSpaceId && client ? client.getRoom(currentSpaceId)?.getMyMembership() === 'join' : false;

  const spaceItems = useMemo((): SpaceListItem[] => {
    if (!isSpaceView || !currentSpaceId || !client) return [];
    const favSet = favouriteRooms;

    const favRooms: HierarchyRoomItem[] = [];
    const rest: HierarchyItem[] = [];
    for (const item of hierarchyItems) {
      if (item.kind === 'room' && favSet.has(item.roomId)) favRooms.push(item);
      else rest.push(item);
    }

    const items: SpaceListItem[] = [];
    if (favRooms.length > 0 && spaceFavKey) {
      const favClosed = closedCategories.has(spaceFavKey);
      const favHasNotif = favRooms.some((r) => r.entry.unreadCount > 0 || r.entry.isInvite);
      items.push({
        kind: 'header',
        item: {
          kind: 'space',
          roomId: spaceFavKey,
          categoryKey: spaceFavKey,
          name: t('room.favourites'),
          avatarMxc: null,
          unreadCount: 0,
          hasNotif: favHasNotif,
          isInvite: false,
          isRoot: false,
        },
      });
      for (const room of favRooms) {
        if (favClosed && currentRoomId !== room.roomId && !room.entry.isInvite) continue;
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
          unreadCount: 0,
          hasNotif: false,
          isInvite: !isSpaceJoined,
          isRoot: true,
        },
      });
    }

    let idx = 0;
    while (idx < rest.length) {
      const item = rest[idx];
      if (item.kind === 'room') {
        items.push({ kind: 'room', item });
        idx++;
        continue;
      }
      const sectionRooms: HierarchyRoomItem[] = [];
      while (idx + 1 < rest.length) {
        const next = rest[idx + 1];
        if (next.kind !== 'room') break;
        sectionRooms.push(next);
        idx++;
      }
      const closed = closedCategories.has(item.categoryKey);
      const visibleRooms = sectionRooms.filter(
        (r) => !closed || currentRoomId === r.roomId || r.entry.isInvite
      );
      if (item.isRoot || sectionRooms.length > 0) {
        items.push({ kind: 'header', item });
        for (const room of visibleRooms) {
          items.push({ kind: 'room', item: room });
        }
      } else if (item.isInvite) {
        items.push({ kind: 'header', item });
      }
      idx++;
    }

    return items;
  }, [
    isSpaceView,
    currentSpaceId,
    client,
    favouriteRooms,
    hierarchyItems,
    closedCategories,
    currentRoomId,
    spaceFavKey,
    isSpaceJoined,
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
      if (!entry.hasVoiceRoom) return ROOM_ITEM_HEIGHT;
      const count = participantCounts.get(entry.roomId) ?? 0;
      return ROOM_ITEM_HEIGHT + computeParticipantsBlockHeight(count);
    },
    [participantCounts]
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

    const otherEntries = homeRooms.filter((entry) => !favSet.has(entry.roomId));

    const items: HomeListItem[] = [];
    const pushSection = (itemKey: string, entries: RoomEntry[]) => {
      const hasNotif = entries.some((entry) => entry.unreadCount > 0 || entry.isInvite);
      items.push({
        kind: 'header',
        itemKey,
        label: itemKey === HOME_FAVOURITES_CATEGORY ? t('room.favourites') : t('room.title'),
        hasNotif,
        showAdd: itemKey === HOME_ROOMS_CATEGORY,
      });
      const closed = closedCategories.has(itemKey);
      for (const entry of entries) {
        if (closed && currentRoomId !== entry.roomId && !entry.isInvite) continue;
        items.push({ kind: 'room', entry });
      }
    };

    if (favEntries.length > 0) pushSection(HOME_FAVOURITES_CATEGORY, favEntries);
    pushSection(HOME_ROOMS_CATEGORY, otherEntries);
    return items;
  }, [
    isSpaceView,
    isDmView,
    client,
    favouriteRooms,
    homeRooms,
    closedCategories,
    currentRoomId,
    t,
  ]);

  const roomListRef = useRef<HTMLDivElement>(null);

  const spaceVirtualizer = useVirtualizer({
    count: spaceItems.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: (index) => {
      const item = spaceItems[index];
      if (item.kind === 'header') return CATEGORY_HEADER_HEIGHT;
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
      return item.kind === 'header' ? CATEGORY_HEADER_HEIGHT : getRoomEntryHeight(item.entry);
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
    estimateSize: () => ROOM_ITEM_HEIGHT,
    overscan: LIST_OVERSCAN,
    enabled: isDmView,
  });

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
      if (room?.getMyMembership() === 'invite') {
        navigateToRoom();
        return;
      }
      const isVoice = !isDm && !!room && isVoiceRoom(room);
      if (isVoice) {
        if (elementUi.roomId !== roomId) onVoiceJoin(roomId);
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
      onVoiceJoin,
      setDrawerOpen,
    ]
  );

  const openChatOnly = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      setDrawerOpen(false);
      navigate(`/r/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
    },
    [setCurrentRoomId, navigate, sidebarView, currentSpaceId, setDrawerOpen]
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

  const headerLabel =
    sidebarView === 'dms'
      ? t('room.dm.directMessages')
      : currentSpaceId
        ? (client?.getRoom(currentSpaceId)?.name ?? t('room.home'))
        : t('room.home');
  const showSpaceIcon = sidebarView !== 'dms' && !!currentSpaceId;

  const renderSpaceList = () => {
    return (
      <div ref={roomListRef} className={css.roomList}>
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
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {item.kind === 'header' ? (
                  spaceFavKey && item.item.categoryKey === spaceFavKey ? (
                    <HomeCategoryHeader
                      label={item.item.name}
                      isClosed={closedCategories.has(spaceFavKey)}
                      onToggle={() => toggleCategory(spaceFavKey)}
                      hasNotif={item.item.hasNotif}
                    />
                  ) : (
                    <SubspaceCategoryHeader
                      item={item.item}
                      isClosed={closedCategories.has(item.item.categoryKey)}
                      onToggle={toggleCategory}
                      onAdd={handleSubspaceAdd}
                      client={client}
                    />
                  )
                ) : (
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
                  />
                )}
              </div>
            );
          })}
        </div>
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
      <header className={css.roomHeader}>
        <Tooltip content={headerLabel}>
          <h2 className={css.roomHeaderTitle}>
            {showSpaceIcon && <StackIcon size={14} className={css.roomHeaderIcon} />}
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
              tooltip={t('room.markAsRead')}
              aria-label={t('room.markAsRead')}
              onClick={handleDmsMenu}
              {...dmMenuTrigger}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          ) : (
            <IconButton
              size="sm"
              tooltip={t('room.markAsRead')}
              aria-label={t('room.markAsRead')}
              onClick={handleHomeMenu}
              {...homeMenuTrigger}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          )}
        </div>
      </header>

      {isDmView ? renderDmList() : isSpaceView ? renderSpaceList() : renderHomeList()}

      <ElementCallBar />

      <UserPanel />
    </div>
  );
}
