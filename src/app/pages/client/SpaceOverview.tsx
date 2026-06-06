import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { PlusIcon, UserPlusIcon, GearIcon, SignOutIcon, UsersIcon } from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import {
  currentRoomIdAtom,
  createRoomOpenAtom,
  roomSettingsRoomIdAtom,
  spaceSettingsRoomIdAtom,
} from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useRooms } from '@/app/features/room';
import { useRoomActions } from './hooks/useRoomActions';
import * as css from './SpaceOverview.css';

interface SpaceOverviewProps {
  spaceId: string;
}

export function SpaceOverview({ spaceId }: SpaceOverviewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const rooms = useRooms(spaceId);
  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const setCreateRoomOpen = useSetAtom(createRoomOpenAtom);
  const setSpaceSettings = useSetAtom(spaceSettingsRoomIdAtom);
  const setRoomSettings = useSetAtom(roomSettingsRoomIdAtom);
  const roomActions = useRoomActions();

  const space = client?.getRoom(spaceId);
  const spaceName = space?.name ?? spaceId;
  const spaceAvatarMxc = space?.getMxcAvatarUrl?.() ?? null;

  const topicEvent = space?.currentState.getStateEvents('m.room.topic', '');
  const spaceTopic = (topicEvent?.getContent()?.topic as string | undefined) ?? null;

  const selectRoom = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      navigate(`/r/${encodeURIComponent(roomId)}`);
    },
    [setCurrentRoomId, navigate]
  );

  const handleAddRoom = useCallback(() => {
    setCreateRoomOpen({ open: true, spaceId, spaceName });
  }, [setCreateRoomOpen, spaceId, spaceName]);

  const handleInvite = useCallback(() => {
    roomActions.inviteToRoom({ roomId: spaceId, name: spaceName, isSpace: true });
  }, [roomActions, spaceId, spaceName]);

  const handleSettings = useCallback(() => {
    setSpaceSettings(spaceId);
  }, [setSpaceSettings, spaceId]);

  if (!space) {
    return (
      <div className={css.container}>
        <div className={css.scrollArea}>
          <div className={css.emptyState}>{t('common.loading')}</div>
        </div>
      </div>
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
          </div>
        </div>

        <div className={css.sectionTitle}>
          <span>{t('room.title', { defaultValue: 'Rooms' })}</span>
          <Button variant="secondary" size="sm" onClick={handleAddRoom}>
            <PlusIcon size={14} />
            {t('room.create.titleShort', { defaultValue: 'Add Room' })}
          </Button>
        </div>

        {rooms.length === 0 ? (
          <div className={css.emptyState}>{t('room.noRooms')}</div>
        ) : (
          <div className={css.roomList}>
            {rooms.map((entry) => {
              const memberCount = entry.room.getJoinedMembers().length;
              const topicEv = entry.room.currentState.getStateEvents('m.room.topic', '');
              const roomTopic = (topicEv?.getContent()?.topic as string | undefined) ?? null;
              return (
                <div
                  key={entry.roomId}
                  className={css.roomRow}
                  onClick={() => selectRoom(entry.roomId)}
                >
                  <Avatar
                    name={entry.name}
                    mxcUrl={entry.avatarMxc}
                    client={client ?? undefined}
                    size="md"
                  />
                  <div className={css.roomInfo}>
                    <div className={css.roomName}>{entry.name}</div>
                    <div className={css.roomMeta}>
                      <span className={css.memberCount}>
                        <UsersIcon size={12} />
                        {memberCount}
                      </span>
                      {roomTopic && (
                        <>
                          <span className={css.metaDivider} />
                          <span className={css.roomTopicText}>{roomTopic}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={css.roomRowDivider} />
                  <div className={css.roomRowActions} onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      size="sm"
                      title={t('common.invite')}
                      onClick={() =>
                        roomActions.inviteToRoom({
                          roomId: entry.roomId,
                          name: entry.name,
                          isSpace: false,
                        })
                      }
                    >
                      <UserPlusIcon size={14} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      title={t('common.settings')}
                      onClick={() => setRoomSettings(entry.roomId)}
                    >
                      <GearIcon size={14} />
                    </IconButton>
                    <IconButton
                      size="sm"
                      danger
                      title={t('room.leaveRoom')}
                      onClick={() => roomActions.leaveRoom(entry.roomId, entry.name)}
                    >
                      <SignOutIcon size={14} />
                    </IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
