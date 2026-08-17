import { useCallback, useMemo, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HouseIcon,
  ChatCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CompassIcon,
  EnvelopeSimpleIcon,
} from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
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
  pinnedSubSpacesAtom,
} from '@/app/store/atoms';
import type { SidebarView } from '@/app/store/atoms';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useSpaces } from '@/app/features/room';
import type { SpaceEntry } from '@/app/features/room';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { useRoomActions } from './hooks/useRoomActions';
import { preferencesAtom } from '@/app/store/atoms/settings';
import { buildSpaceMenu, markSpaceAsRead, buildHomeMenu, buildDmsMenu } from './spaceContextMenu';
import * as css from './SpacesList.css';

interface SpacesListProps {
  sidebarView: SidebarView;
  currentSpaceId: string | null;
  onSelectView: (view: SidebarView, spaceId?: string | null) => void;
}

function SortableSpaceItem({
  space,
  isActive,
  onClick,
  onContextMenu,
  children,
}: {
  space: SpaceEntry;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: space.roomId,
    disabled: space.isInvite,
  });

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.3 : 1,
    transition:
      'opacity 0.15s ease, border-radius 0.2s ease, background-color 0.15s, box-shadow 0.15s',
  };

  const className = [isActive ? css.spaceBtnActive : css.spaceBarBtn].filter(Boolean).join(' ');

  return (
    <div ref={setNodeRef} className={className} style={style} {...attributes} {...listeners}>
      <span className={css.spacePill} />
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
      <div className={css.spaceAvatarWrap} style={{ opacity: space.isInvite ? 0.35 : 1 }}>
        <Avatar
          name={space.name}
          mxcUrl={space.avatarMxc}
          client={client ?? undefined}
          size="fill"
        />
      </div>
      {space.isInvite && (
        <span className={css.inviteBadge}>
          <EnvelopeSimpleIcon size={12} weight="fill" />
        </span>
      )}
      {space.hasNotif && !space.isInvite && <span className={css.notifDot} />}
    </>
  );
}

export function SpacesList({ sidebarView, currentSpaceId, onSelectView }: SpacesListProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { spaces, homeHasNotif, dmsHasNotif } = useSpaces();
  const [spaceOrder, setSpaceOrder] = useAtom(spaceOrderAtom);
  const [pinnedSubSpacesArr, setPinnedSubSpacesArr] = useAtom(pinnedSubSpacesAtom);
  const pinnedSubSpaces = new Set(pinnedSubSpacesArr);
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [, setSpaceSettings] = useAtom(spaceSettingsRoomIdAtom);
  const [, setCreateSpaceOpen] = useAtom(createSpaceOpenAtom);
  const openGlobalSearch = useSetAtom(globalSearchOpenAtom);
  const openExplore = useSetAtom(exploreOpenAtom);
  const prefs = useAtomValue(preferencesAtom);
  const client = getMatrixClientOrNull();

  const navigate = useNavigate();

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [insertLine, setInsertLine] = useState<{ id: string; position: 'before' | 'after' } | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleMarkSpaceAsRead = useCallback(
    (spaceId: string) => {
      markSpaceAsRead(client, prefs, spaceId);
    },
    [client, prefs]
  );

  const buildSpaceMenuCb = useCallback(
    (space: SpaceEntry) => {
      return buildSpaceMenu(space, {
        t,
        navigate,
        roomActions,
        toast,
        pinnedSubSpaces,
        setPinnedSubSpacesArr,
        setSpaceSettings,
        markSpaceAsRead: handleMarkSpaceAsRead,
      });
    },
    [
      navigate,
      roomActions,
      setSpaceSettings,
      t,
      toast,
      pinnedSubSpaces,
      setPinnedSubSpacesArr,
      handleMarkSpaceAsRead,
    ]
  );

  const buildHomeMenuCb = useCallback(() => {
    return buildHomeMenu({ t, client, prefs });
  }, [t, client, prefs]);

  const buildDmsMenuCb = useCallback(() => {
    return buildDmsMenu({ t, client, prefs });
  }, [t, client, prefs]);

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
    setInsertLine(null);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) {
        setInsertLine(null);
        return;
      }

      const orderedIds = orderedSpaces.map((s) => s.roomId);
      const ai = orderedIds.indexOf(active.id as string);
      const oi = orderedIds.indexOf(over.id as string);
      if (ai === -1 || oi === -1) {
        setInsertLine(null);
        return;
      }

      setInsertLine({ id: over.id as string, position: ai < oi ? 'after' : 'before' });
    },
    [orderedSpaces]
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
          onContextMenu={(e) => openContextMenu(e, buildHomeMenuCb())}
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
          onContextMenu={(e) => openContextMenu(e, buildDmsMenuCb())}
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
              const showBefore =
                insertLine?.id === space.roomId && insertLine.position === 'before';
              const showAfter = insertLine?.id === space.roomId && insertLine.position === 'after';
              return (
                <Fragment key={space.roomId}>
                  {showBefore && <div className={css.insertionLine} />}
                  <SortableSpaceItem
                    space={space}
                    isActive={isActive}
                    onClick={() => {
                      if (
                        space.isInvite ||
                        (sidebarView === 'space' && currentSpaceId === space.roomId)
                      ) {
                        navigate(`/space/${encodeURIComponent(space.roomId)}`, {
                          state: { sidebarView: 'space', currentSpaceId: space.roomId },
                        });
                      } else {
                        onSelectView('space', space.roomId);
                      }
                    }}
                    onContextMenu={(e) => openContextMenu(e, buildSpaceMenuCb(space))}
                  >
                    <SpaceAvatar space={space} />
                  </SortableSpaceItem>
                  {showAfter && <div className={css.insertionLine} />}
                </Fragment>
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
                  onClick={() => setCreateSpaceOpen({ open: true })}
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
