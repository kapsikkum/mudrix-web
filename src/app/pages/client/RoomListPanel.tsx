import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  StackIcon,
  CaretDownIcon,
  DotsThreeVerticalIcon,
  PlusIcon,
  HashStraightIcon,
  SpeakerHighIcon,
} from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tooltip } from '@/app/components/Tooltip';
import { IconButton, Button } from '@/app/components/Button';
import {
  currentRoomIdAtom,
  currentSpaceIdAtom,
  sidebarViewAtom,
  createRoomOpenAtom,
  newDmOpenAtom,
  closedNavCategoriesAtom,
  pinnedSubSpacesAtom,
  spaceSettingsRoomIdAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useDms } from '@/app/hooks/useDms';
import { useRooms, useSpaces } from '@/app/features/room';
import { useSpaceHierarchy } from '@/app/features/room/useSpaceHierarchy';
import type { RoomEntry } from '@/app/features/room/useRooms';
import type { HierarchyItem, HierarchySpaceItem } from '@/app/features/room/useSpaceHierarchy';
import { ElementCallBar } from '@/app/features/calls/ElementCallBar';
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  useElementCallMemberships,
  uniqueMembers,
} from '@/app/features/calls/useElementCallMemberships';
import { computeParticipantsBlockHeight } from '@/app/features/voice/participantSize';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
import { useRoomActions } from './hooks/useRoomActions';
import { preferencesAtom } from '@/app/store/atoms/settings';
import { buildSpaceMenu, markSpaceAsRead, buildHomeMenu, buildDmsMenu } from './spaceContextMenu';
import { RoomListItem, DmListItem } from './RoomListItem';
import { UserPanel } from './UserPanel';
import * as css from './RoomListPanel.css';
import { isVoiceRoom, roomStateMaybe } from '@/util/matrix';

const ROOM_ITEM_HEIGHT = 48;
const CATEGORY_HEADER_HEIGHT = 28;
const LIST_OVERSCAN = 5;

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
    <button
      type="button"
      className={css.subspaceCategoryHeader}
      onClick={() => onToggle(item.categoryKey)}
      title={item.isRoot ? 'Rooms' : item.name}
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
      {!item.isInvite && (
        <button
          type="button"
          aria-label={t('common.add')}
          title={t('common.add')}
          className={css.subspaceAddButton}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(e, item);
          }}
        >
          <PlusIcon size={12} weight="bold" />
        </button>
      )}
    </button>
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
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [pinnedSubSpacesArr, setPinnedSubSpacesArr] = useAtom(pinnedSubSpacesAtom);
  const pinnedSubSpaces = useMemo(() => new Set(pinnedSubSpacesArr), [pinnedSubSpacesArr]);
  const [, setSpaceSettings] = useAtom(spaceSettingsRoomIdAtom);
  const prefs = useAtomValue(preferencesAtom);
  const { spaces } = useSpaces();

  const currentSpaceEntry = useMemo(
    () => spaces.find((s) => s.roomId === currentSpaceId) ?? null,
    [spaces, currentSpaceId]
  );

  const handleMarkSpaceAsRead = useCallback(
    (spaceId: string) => {
      markSpaceAsRead(client, prefs, spaceId);
    },
    [client, prefs]
  );

  const handleSpaceMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!currentSpaceEntry) return;
      openContextMenu(
        e,
        buildSpaceMenu(currentSpaceEntry, {
          t,
          navigate,
          roomActions,
          toast,
          pinnedSubSpaces,
          setPinnedSubSpacesArr,
          setSpaceSettings,
          markSpaceAsRead: handleMarkSpaceAsRead,
        })
      );
    },
    [
      currentSpaceEntry,
      openContextMenu,
      t,
      navigate,
      roomActions,
      toast,
      pinnedSubSpaces,
      setPinnedSubSpacesArr,
      setSpaceSettings,
      handleMarkSpaceAsRead,
    ]
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

  const handleHomeMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, buildHomeMenu({ t, client, prefs, onCreateRoom, onCreateVoiceRoom }));
    },
    [openContextMenu, t, client, prefs, onCreateRoom, onCreateVoiceRoom]
  );

  const handleDmsMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, buildDmsMenu({ t, client, prefs, onNewDm }));
    },
    [openContextMenu, t, client, prefs, onNewDm]
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

  const visibleItems = useMemo((): HierarchyItem[] => {
    if (!isSpaceView) return [];
    const result: HierarchyItem[] = [];
    for (const item of hierarchyItems) {
      if (item.kind === 'space') {
        result.push(item);
      } else {
        const isCategoryClosed = closedCategories.has(item.categoryKey);
        if (!isCategoryClosed || currentRoomId === item.roomId || item.entry.isInvite) {
          result.push(item);
        }
      }
    }
    return result;
  }, [hierarchyItems, closedCategories, currentRoomId, isSpaceView]);

  const spaceVoiceRoomIds = useMemo(
    () =>
      visibleItems
        .filter((i): i is typeof i & { kind: 'room' } => i.kind === 'room')
        .filter((i) => i.entry.hasVoiceRoom)
        .map((i) => i.roomId),
    [visibleItems]
  );
  const homeVoiceRoomIds = useMemo(
    () => homeRooms.filter((r) => r.hasVoiceRoom).map((r) => r.roomId),
    [homeRooms]
  );
  const voiceRoomIds = isSpaceView ? spaceVoiceRoomIds : homeVoiceRoomIds;

  const membershipRoomIds = useMemo(() => {
    if (isDmView) return dms.map((d) => d.roomId);
    if (isSpaceView) {
      return visibleItems
        .filter((i): i is typeof i & { kind: 'room' } => i.kind === 'room')
        .map((i) => i.roomId);
    }
    return homeRooms.map((r) => r.roomId);
  }, [isDmView, isSpaceView, visibleItems, dms, homeRooms]);

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

  const getRoomEntryHeight = useCallback(
    (entry: RoomEntry) => {
      if (!entry.hasVoiceRoom) return ROOM_ITEM_HEIGHT;
      const count = participantCounts.get(entry.roomId) ?? 0;
      return ROOM_ITEM_HEIGHT + computeParticipantsBlockHeight(count);
    },
    [participantCounts]
  );

  const roomListRef = useRef<HTMLDivElement>(null);

  const spaceVirtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: (index) => {
      const item = visibleItems[index];
      if (item.kind === 'space') return CATEGORY_HEADER_HEIGHT;
      return getRoomEntryHeight(item.entry);
    },
    getItemKey: (index) => {
      const item = visibleItems[index];
      return `${item.kind}-${item.roomId}`;
    },
    overscan: LIST_OVERSCAN,
    enabled: isSpaceView,
  });

  const homeVirtualizer = useVirtualizer({
    count: homeRooms.length,
    getScrollElement: () => roomListRef.current,
    estimateSize: (index) => getRoomEntryHeight(homeRooms[index]),
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
  }, [participantCounts, visibleItems, spaceVirtualizer, isSpaceView]);

  useEffect(() => {
    if (isSpaceView && roomListRef.current) {
      roomListRef.current.scrollTop = 0;
    }
  }, [currentSpaceId, isSpaceView]);

  useEffect(() => {
    if (!isSpaceView && !isDmView) homeVirtualizer.measure();
  }, [participantCounts, homeRooms, homeVirtualizer, isSpaceView, isDmView]);

  const selectRoom = useCallback(
    (roomId: string, isDm = false) => {
      const room = client?.getRoom(roomId);
      const isVoice = !isDm && !!room && isVoiceRoom(room);
      if (isVoice) {
        if (elementUi.roomId !== roomId) onVoiceJoin(roomId);
        return;
      }
      setCurrentRoomId(roomId);
      navigate(`/${isDm ? 'dm' : 'r'}/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
    },
    [setCurrentRoomId, navigate, sidebarView, currentSpaceId, client, elementUi.roomId, onVoiceJoin]
  );

  const openChatOnly = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      navigate(`/r/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
    },
    [setCurrentRoomId, navigate, sidebarView, currentSpaceId]
  );

  const openVoiceChat = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      navigate(`/r/${encodeURIComponent(roomId)}`, {
        state: { sidebarView, currentSpaceId },
      });
      if (client && elementUi.roomId !== roomId) {
        const room = client.getRoom(roomId);
        if (room && isVoiceRoom(room)) onVoiceJoin(roomId);
      }
    },
    [setCurrentRoomId, navigate, sidebarView, currentSpaceId, client, elementUi.roomId, onVoiceJoin]
  );

  const currentSpace = currentSpaceId && client ? client.getRoom(currentSpaceId) : null;
  const isSpaceInvite = currentSpace?.getMyMembership() === 'invite';
  const [inviteLoading, setInviteLoading] = useState(false);

  const spaceInviterEvent = roomStateMaybe(currentSpace)?.getStateEvents(
    'm.room.member',
    client?.getUserId() ?? ''
  );
  const spaceInviterId = spaceInviterEvent?.getSender() ?? null;
  const spaceInviterUser = spaceInviterId ? client?.getUser(spaceInviterId) : null;
  const spaceInviterName =
    spaceInviterUser?.displayName ?? spaceInviterId ?? t('invite.unknownInviter');

  const handleSpaceAccept = useCallback(async () => {
    if (!client || !currentSpaceId) return;
    setInviteLoading(true);
    try {
      await client.joinRoom(currentSpaceId);
    } catch (err) {
      toast.error(t('invite.acceptFailed', { error: getErrorMessage(err) }));
    } finally {
      setInviteLoading(false);
    }
  }, [client, currentSpaceId, toast, t]);

  const handleSpaceDecline = useCallback(async () => {
    if (!client || !currentSpaceId || !currentSpace) return;
    setInviteLoading(true);
    try {
      await client.leave(currentSpaceId);
      toast.info(t('invite.declined', { name: currentSpace.name }));
    } catch (err) {
      toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
    } finally {
      setInviteLoading(false);
    }
  }, [client, currentSpaceId, currentSpace, toast, t]);

  const headerLabel =
    sidebarView === 'dms'
      ? t('room.dm.directMessages')
      : currentSpaceId
        ? (client?.getRoom(currentSpaceId)?.name ?? t('room.home'))
        : t('room.home');
  const showSpaceIcon = sidebarView !== 'dms' && !!currentSpaceId;

  const renderSpaceList = () => {
    if (isSpaceInvite) return null;
    if (visibleItems.length === 0) {
      return (
        <div ref={roomListRef} className={css.roomList}>
          <div className={css.emptyList}>{t('room.noRooms')}</div>
        </div>
      );
    }

    return (
      <div ref={roomListRef} className={css.roomList}>
        <div style={{ height: spaceVirtualizer.getTotalSize(), position: 'relative' }}>
          {spaceVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = visibleItems[virtualRow.index];
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
                {item.kind === 'space' ? (
                  <SubspaceCategoryHeader
                    item={item}
                    isClosed={closedCategories.has(item.categoryKey)}
                    onToggle={toggleCategory}
                    onAdd={handleSubspaceAdd}
                    client={client}
                  />
                ) : (
                  <RoomListItem
                    entry={item.entry}
                    isActive={currentRoomId === item.roomId}
                    hasActiveCall={activeCallRoomIds.has(item.roomId) && !item.entry.hasVoiceRoom}
                    isInCall={elementUi.roomId === item.roomId}
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
    if (homeRooms.length === 0) {
      return (
        <div ref={roomListRef} className={css.roomList}>
          <div className={css.emptyList}>{t('room.noRooms')}</div>
        </div>
      );
    }
    return (
      <div ref={roomListRef} className={css.roomList}>
        <div style={{ height: homeVirtualizer.getTotalSize(), position: 'relative' }}>
          {homeVirtualizer.getVirtualItems().map((virtualRow) => {
            const entry = homeRooms[virtualRow.index];
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
                <RoomListItem
                  entry={entry}
                  isActive={currentRoomId === entry.roomId}
                  hasActiveCall={activeCallRoomIds.has(entry.roomId) && !entry.hasVoiceRoom}
                  isInCall={elementUi.roomId === entry.roomId}
                  onSelect={selectRoom}
                  onOpenChat={openVoiceChat}
                  onOpenChatOnly={openChatOnly}
                />
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
      <div className={css.roomHeader}>
        <Tooltip content={headerLabel}>
          <span className={css.roomHeaderTitle}>
            {showSpaceIcon && <StackIcon size={14} className={css.roomHeaderIcon} />}
            <span className={css.roomHeaderLabel}>{headerLabel}</span>
          </span>
        </Tooltip>
        <div className={css.roomHeaderActions}>
          {sidebarView === 'space' && currentSpaceEntry ? (
            <IconButton
              size="sm"
              tooltip={t('room.space.overview')}
              aria-label={t('room.space.overview')}
              onClick={handleSpaceMenu}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          ) : isDmView ? (
            <IconButton
              size="sm"
              tooltip={t('room.markAsRead')}
              aria-label={t('room.markAsRead')}
              onClick={handleDmsMenu}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          ) : (
            <IconButton
              size="sm"
              tooltip={t('room.markAsRead')}
              aria-label={t('room.markAsRead')}
              onClick={handleHomeMenu}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </IconButton>
          )}
        </div>
      </div>

      {isSpaceInvite && currentSpace ? (
        <div className={css.spaceInviteBanner}>
          <Avatar
            name={currentSpace.name}
            mxcUrl={currentSpace.getMxcAvatarUrl?.() ?? null}
            client={client ?? undefined}
            size="xl"
          />
          <span className={css.spaceInviteName}>{currentSpace.name}</span>
          <span className={css.spaceInviteBy}>
            {t('invite.invitedBy', { name: spaceInviterName })}
          </span>
          <div className={css.spaceInviteActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSpaceDecline}
              disabled={inviteLoading}
            >
              {t('invite.decline')}
            </Button>
            <Button
              variant="success"
              size="sm"
              onClick={handleSpaceAccept}
              disabled={inviteLoading}
            >
              {t('invite.accept')}
            </Button>
          </div>
        </div>
      ) : isDmView ? (
        renderDmList()
      ) : isSpaceView ? (
        renderSpaceList()
      ) : (
        renderHomeList()
      )}

      <ElementCallBar />

      <UserPanel />
    </div>
  );
}
