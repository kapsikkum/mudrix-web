import { useCallback } from 'react';
import {
  GearIcon,
  UserPlusIcon,
  SignOutIcon,
  HouseIcon,
  ChatCircleIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/app/components/Avatar';
import {
  spaceSettingsRoomIdAtom,
  createSpaceOpenAtom,
  globalSearchOpenAtom,
} from '@/app/store/atoms';
import type { SidebarView } from '@/app/store/atoms';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useSpaces } from '@/app/features/room';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useRoomActions } from './hooks/useRoomActions';
import * as css from './SpacesList.css';

interface SpacesListProps {
  sidebarView: SidebarView;
  currentSpaceId: string | null;
  onSelectView: (view: SidebarView, spaceId?: string | null) => void;
}

export function SpacesList({ sidebarView, currentSpaceId, onSelectView }: SpacesListProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const spaces = useSpaces();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [, setSpaceSettings] = useAtom(spaceSettingsRoomIdAtom);
  const [, setCreateSpaceOpen] = useAtom(createSpaceOpenAtom);
  const openGlobalSearch = useSetAtom(globalSearchOpenAtom);

  const buildSpaceMenu = useCallback(
    (space: ReturnType<typeof useSpaces>[number]) => [
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
    ],
    [roomActions, setSpaceSettings, t]
  );

  return (
    <div className={css.spacesList}>
      {/* Home button */}
      <button
        className={sidebarView === 'home' ? css.spaceBtnHome : css.spaceBtn}
        title={t('room.home')}
        onClick={() => onSelectView('home', null)}
      >
        <HouseIcon size={20} weight={sidebarView === 'home' ? 'fill' : 'regular'} />
      </button>

      {/* DMs button */}
      <button
        className={sidebarView === 'dms' ? css.spaceBtnDm : css.spaceBtn}
        title={t('room.dm.directMessages')}
        onClick={() => onSelectView('dms', null)}
      >
        <ChatCircleIcon size={20} weight={sidebarView === 'dms' ? 'fill' : 'regular'} />
      </button>

      {/* Separator */}
      {spaces.length > 0 && <div className={css.spacesSeparator} />}

      <div className={css.spacesScrollArea}>
        {spaces.map((space) => {
          const isActive = sidebarView === 'space' && currentSpaceId === space.roomId;
          const isInvite = space.getMyMembership() === 'invite';
          const btnClass = isInvite
            ? css.spaceBtnInvite
            : isActive
              ? css.spaceBtnActive
              : css.spaceBtn;
          return (
            <button
              key={space.roomId}
              className={btnClass}
              title={space.name}
              onClick={() => onSelectView('space', space.roomId)}
              onContextMenu={(e) => openContextMenu(e, buildSpaceMenu(space))}
            >
              <Avatar
                name={space.name}
                mxcUrl={space.getMxcAvatarUrl?.() ?? null}
                client={client ?? undefined}
                size="fill"
              />
              {isInvite && <span className={css.inviteDot} />}
            </button>
          );
        })}

        <div className={css.spacesStickyBottom}>
          {spaces.length > 0 && <div className={css.spacesSeparator} />}
          {/* Create / Join Space button */}
          <button
            className={css.spaceBtn}
            title={t('room.space.create.title')}
            onClick={() => setCreateSpaceOpen(true)}
          >
            <PlusIcon size={20} />
          </button>
          <button
            className={css.spaceBtn}
            title={t('globalSearch.title')}
            onClick={() => openGlobalSearch(true)}
          >
            <MagnifyingGlassIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
