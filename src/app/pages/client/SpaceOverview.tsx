import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  UserPlusIcon,
  GearIcon,
  SignOutIcon,
  UsersIcon,
  CheckIcon,
  XIcon,
} from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import {
  currentRoomIdAtom,
  createRoomOpenAtom,
  roomSettingsRoomIdAtom,
  spaceSettingsRoomIdAtom,
} from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useSpaceRooms } from '@/app/features/room';
import { useRoomActions } from './hooks/useRoomActions';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import * as css from './SpaceOverview.css';

interface SpaceOverviewProps {
  spaceId: string;
}

export function SpaceOverview({ spaceId }: SpaceOverviewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const [joiningRooms, setJoiningRooms] = useState<Set<string>>(new Set());
  const toast = useToast();
  const rooms = useSpaceRooms(spaceId, t('common.unknown'));
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

  const [acceptingRooms, setAcceptingRooms] = useState<Set<string>>(new Set());

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
              const isBusy = joiningRooms.has(entry.roomId) || acceptingRooms.has(entry.roomId);
              const isClickable = entry.isJoined && !entry.isInvite;
              return (
                <div
                  key={entry.roomId}
                  className={css.roomRow}
                  onClick={() => isClickable && selectRoom(entry.roomId)}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                >
                  <Avatar
                    name={entry.name}
                    mxcUrl={entry.avatarMxc}
                    client={client ?? undefined}
                    size="md"
                  />
                  <div className={css.roomInfo}>
                    <div className={css.roomName}>{entry.name}</div>
                    {entry.isJoined && !entry.isInvite && (
                      <div className={css.roomMeta}>
                        {entry.memberCount > 0 && (
                          <span className={css.memberCount}>
                            <UsersIcon size={12} />
                            {entry.memberCount}
                          </span>
                        )}
                        {entry.memberCount > 0 && entry.topic && (
                          <span className={css.metaDivider} />
                        )}
                        {entry.topic && <span className={css.roomTopicText}>{entry.topic}</span>}
                      </div>
                    )}
                  </div>
                  <div className={css.roomRowDivider} />
                  <div className={css.roomRowActions} onClick={(e) => e.stopPropagation()}>
                    {entry.isInvite ? (
                      <>
                        <Button
                          variant="success"
                          size="sm"
                          loading={isBusy}
                          onClick={() => handleAcceptInvite(entry.roomId)}
                        >
                          <CheckIcon size={14} />
                          {t('invite.accept')}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={isBusy}
                          onClick={() => handleDeclineInvite(entry.roomId, entry.name)}
                        >
                          <XIcon size={14} />
                          {t('invite.decline')}
                        </Button>
                      </>
                    ) : entry.isJoined ? (
                      <>
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
                      </>
                    ) : entry.isKnocking ? (
                      <Button variant="secondary" size="sm" disabled>
                        {t('explore.knocking')}
                      </Button>
                    ) : entry.joinRule === 'knock' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={isBusy}
                        onClick={() => handleKnockRoom(entry.roomId, entry.viaServers)}
                      >
                        <UserPlusIcon size={14} />
                        {t('explore.knock')}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={isBusy}
                        onClick={() => handleJoinRoom(entry.roomId, entry.name, entry.viaServers)}
                      >
                        <UserPlusIcon size={14} />
                        {t('explore.join')}
                      </Button>
                    )}
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
