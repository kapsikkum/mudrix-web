import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GearIcon,
  UserPlusIcon,
  SignOutIcon,
  HouseIcon,
  ChatCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CompassIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/app/components/Tooltip';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Avatar } from '@/app/components/Avatar';
import {
  spaceSettingsRoomIdAtom,
  createSpaceOpenAtom,
  globalSearchOpenAtom,
  exploreOpenAtom,
  spaceOrderAtom,
} from '@/app/store/atoms';
import type { SidebarView } from '@/app/store/atoms';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useSpaces } from '@/app/features/room';
import type { SpaceEntry } from '@/app/features/room';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { useRoomActions } from './hooks/useRoomActions';
import * as css from './SpacesList.css';

interface SpacesListProps {
  sidebarView: SidebarView;
  currentSpaceId: string | null;
  onSelectView: (view: SidebarView, spaceId?: string | null) => void;
}

function SortableSpaceItem({
  space,
  isActive,
  isOver,
  onClick,
  onContextMenu,
  children,
}: {
  space: SpaceEntry;
  isActive: boolean;
  isOver: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: space.roomId,
    disabled: space.isInvite,
  });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : isOver ? 0.7 : 1,
    transition:
      'opacity 0.15s ease, border-radius 0.2s ease, background-color 0.15s, box-shadow 0.15s',
  };

  const className = [
    space.isInvite ? css.spaceBtnInvite : isActive ? css.spaceBtnActive : css.spaceBarBtn,
    isOver ? css.spaceBtnOver : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={setNodeRef} className={className} style={style} {...attributes} {...listeners}>
      <Tooltip placement="right" content={space.name}>
        <button
          type="button"
          className={css.spaceBtnInner}
          onClick={onClick}
          onContextMenu={onContextMenu}
          tabIndex={-1}
        >
          {children}
        </button>
      </Tooltip>
    </div>
  );
}

function SpaceAvatar({ space }: { space: SpaceEntry }) {
  const client = getMatrixClientOrNull();
  return (
    <>
      <Avatar name={space.name} mxcUrl={space.avatarMxc} client={client ?? undefined} size="fill" />
      {space.isInvite && <span className={css.inviteDot} />}
      {space.hasNotif && !space.isInvite && <span className={css.notifDot} />}
    </>
  );
}

export function SpacesList({ sidebarView, currentSpaceId, onSelectView }: SpacesListProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { spaces, homeHasNotif, dmsHasNotif } = useSpaces();
  const [spaceOrder, setSpaceOrder] = useAtom(spaceOrderAtom);
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [, setSpaceSettings] = useAtom(spaceSettingsRoomIdAtom);
  const [, setCreateSpaceOpen] = useAtom(createSpaceOpenAtom);
  const openGlobalSearch = useSetAtom(globalSearchOpenAtom);
  const openExplore = useSetAtom(exploreOpenAtom);

  const navigate = useNavigate();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overDragId, setOverDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const buildSpaceMenu = useCallback(
    (space: SpaceEntry) => {
      // Invited but not yet joined
      if (space.isInvite) {
        return [
          {
            label: t('invite.declineInvite'),
            icon: <XCircleIcon size={14} />,
            danger: true,
            onClick: async () => {
              const client = roomActions.client;
              if (!client) return;
              try {
                await client.leave(space.roomId);
                toast.info(t('invite.declined', { name: space.name }));
              } catch (err) {
                toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
              }
            },
          },
        ];
      }
      return [
        {
          label: t('common.invite'),
          icon: <UserPlusIcon size={14} />,
          onClick: () =>
            roomActions.inviteToRoom({ roomId: space.roomId, name: space.name, isSpace: true }),
        },
        {
          label: t('common.settings'),
          icon: <GearIcon size={14} />,
          onClick: () => setSpaceSettings(space.roomId),
        },
        {
          divider: true,
          label: '',
          onClick: () => {},
        },
        {
          label: t('room.space.leave'),
          icon: <SignOutIcon size={14} />,
          danger: true,
          onClick: () => roomActions.leaveSpace(space.roomId, space.name),
        },
      ];
    },
    [roomActions, setSpaceSettings, t, toast]
  );

  // Apply persisted user order
  const orderedSpaces = useMemo(() => {
    if (spaceOrder.length === 0) return spaces;
    const spaceMap = new Map(spaces.map((s) => [s.roomId, s]));
    const ordered: SpaceEntry[] = [];
    for (const id of spaceOrder) {
      const s = spaceMap.get(id);
      if (s) ordered.push(s);
    }
    // Append spaces not in saved order (newly joined, etc.)
    const spaceOrderSet = new Set(spaceOrder);
    for (const s of spaces) {
      if (!spaceOrderSet.has(s.roomId)) ordered.push(s);
    }
    return ordered;
  }, [spaces, spaceOrder]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setOverDragId(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverDragId(event.over ? (event.over.id as string) : null);
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveDragId(null);
    setOverDragId(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null);
      setOverDragId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = orderedSpaces.findIndex((s) => s.roomId === active.id);
      const newIndex = orderedSpaces.findIndex((s) => s.roomId === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(orderedSpaces, oldIndex, newIndex);
      setSpaceOrder(reordered.map((s) => s.roomId));
    },
    [orderedSpaces, setSpaceOrder]
  );

  const activeDragSpace = useMemo(
    () => spaces.find((s) => s.roomId === activeDragId) ?? null,
    [spaces, activeDragId]
  );

  return (
    <div className={css.spacesList}>
      {/* Home button */}
      <Tooltip placement="right" content={t('room.home')}>
        <button
          type="button"
          className={sidebarView === 'home' ? css.spaceBarBtnActive : css.spaceBarBtn}
          aria-label={t('room.home')}
          onClick={() => onSelectView('home', null)}
        >
          <HouseIcon size={20} weight={sidebarView === 'home' ? 'fill' : 'regular'} />
          {homeHasNotif && <span className={css.notifDot} />}
        </button>
      </Tooltip>

      {/* DMs button */}
      <Tooltip placement="right" content={t('room.dm.directMessages')}>
        <button
          type="button"
          className={sidebarView === 'dms' ? css.spaceBarBtnActive : css.spaceBarBtn}
          aria-label={t('room.dm.directMessages')}
          onClick={() => onSelectView('dms', null)}
        >
          <ChatCircleIcon size={20} weight={sidebarView === 'dms' ? 'fill' : 'regular'} />
          {dmsHasNotif && <span className={css.notifDot} />}
        </button>
      </Tooltip>

      {/* Separator */}
      {orderedSpaces.length > 0 && <div className={css.spacesSeparator} />}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={orderedSpaces.map((s) => s.roomId)}
          strategy={verticalListSortingStrategy}
        >
          <div className={css.spacesScrollArea}>
            {orderedSpaces.map((space) => {
              const isActive = sidebarView === 'space' && currentSpaceId === space.roomId;
              const isOver = overDragId === space.roomId;
              return (
                <SortableSpaceItem
                  key={space.roomId}
                  space={space}
                  isActive={isActive}
                  isOver={isOver}
                  onClick={() => {
                    if (sidebarView === 'space' && currentSpaceId === space.roomId) {
                      navigate(`/space/${encodeURIComponent(space.roomId)}`, {
                        state: { sidebarView: 'space', currentSpaceId: space.roomId },
                      });
                    } else {
                      onSelectView('space', space.roomId);
                    }
                  }}
                  onContextMenu={(e) => openContextMenu(e, buildSpaceMenu(space))}
                >
                  <SpaceAvatar space={space} />
                </SortableSpaceItem>
              );
            })}

            <DragOverlay>
              {activeDragSpace ? (
                <div className={css.spaceBtnDragOverlay}>
                  <SpaceAvatar space={activeDragSpace} />
                </div>
              ) : null}
            </DragOverlay>

            <div className={css.spacesStickyBottom}>
              {orderedSpaces.length > 0 && <div className={css.spacesSeparator} />}
              {/* Create / Join Space button */}
              <Tooltip placement="right" content={t('room.space.create.title')}>
                <button
                  type="button"
                  className={css.spaceBarBtn}
                  aria-label={t('room.space.create.title')}
                  onClick={() => setCreateSpaceOpen(true)}
                >
                  <PlusIcon size={20} />
                </button>
              </Tooltip>
              {/* Explore button */}
              <Tooltip placement="right" content={t('explore.title')}>
                <button
                  type="button"
                  className={css.spaceBarBtn}
                  aria-label={t('explore.title')}
                  onClick={() => openExplore(true)}
                >
                  <CompassIcon size={20} />
                </button>
              </Tooltip>
              <Tooltip placement="right" content={t('globalSearch.title')}>
                <button
                  type="button"
                  className={css.spaceBarBtn}
                  aria-label={t('globalSearch.title')}
                  onClick={() => openGlobalSearch(true)}
                >
                  <MagnifyingGlassIcon size={20} />
                </button>
              </Tooltip>
            </div>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
