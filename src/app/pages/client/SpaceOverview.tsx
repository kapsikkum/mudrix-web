import { useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  PlusIcon,
  UserPlusIcon,
  GearIcon,
  SignOutIcon,
  UsersIcon,
  XIcon,
  DotsThreeVerticalIcon,
  ArrowsDownUpIcon,
} from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import { Button, IconButton } from '@/app/components/Button';
import { Tooltip } from '@/app/components/Tooltip';
import {
  currentRoomIdAtom,
  createRoomOpenAtom,
  roomSettingsRoomIdAtom,
  spaceSettingsRoomIdAtom,
  membersPanelOpenAtom,
} from '@/app/store/atoms';
import { roomSortAtom } from '@/app/store/atoms/settings';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { EventType } from 'matrix-js-sdk';
import { useSpaceRooms } from '@/app/features/room';
import { useRoomActions } from './hooks/useRoomActions';
import { useToast } from '@/app/hooks/useToast';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import type { SpaceRoomEntry } from '@/app/features/room/useSpaceRooms';
import { getErrorMessage } from '@/util/error';
import * as css from './SpaceOverview.css';

interface SpaceOverviewProps {
  spaceId: string;
}

function SortButton({
  value,
  options,
  title,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  title: string;
  onChange: (value: string) => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);
  return (
    <Tooltip content={title}>
      <div className={css.sortBtnWrap}>
        <span className={css.sortBtnIcon}>
          <ArrowsDownUpIcon size={14} />
        </span>
        <select
          ref={selectRef}
          className={css.sortSelect}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </Tooltip>
  );
}

export function SpaceOverview({ spaceId }: SpaceOverviewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const [joiningRooms, setJoiningRooms] = useState(() => new Set<string>());
  const toast = useToast();
  const rooms = useSpaceRooms(spaceId, t('common.unknown'));
  const [roomSort, setRoomSort] = useAtom(roomSortAtom);
  const [, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const setCreateRoomOpen = useSetAtom(createRoomOpenAtom);
  const setSpaceSettings = useSetAtom(spaceSettingsRoomIdAtom);
  const setRoomSettings = useSetAtom(roomSettingsRoomIdAtom);
  const roomActions = useRoomActions();
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);

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

  const { openContextMenu } = useContextMenu();

  const myUserId = client?.getUserId() ?? '';
  const canRemoveFromSpace =
    space?.currentState.maySendStateEvent('m.space.child', myUserId) ?? false;

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
        toast.success(t('room.space.removed'));
      } catch (err) {
        toast.error(t('room.space.removeFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, spaceId, toast, t]
  );

  const buildRoomMenu = useCallback(
    (entry: SpaceRoomEntry): ContextMenuItem[] => {
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
    [t, roomActions, setRoomSettings, canRemoveFromSpace, handleRemoveFromSpace]
  );

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

  const [acceptingRooms, setAcceptingRooms] = useState(() => new Set<string>());

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

        <div className={css.sectionTitle}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {t('room.title')}
            <SortButton
              value={roomSort}
              options={[
                { value: 'name', label: t('room.sortName') },
                { value: 'recentActivity', label: t('room.sortRecent') },
              ]}
              title={t('room.members.sortTitle')}
              onChange={(v) => setRoomSort(v as 'name' | 'recentActivity')}
            />
          </span>
          <Button variant="secondary" size="sm" onClick={handleAddRoom}>
            <PlusIcon size={14} />
            {t('room.addRoom')}
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
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            selectRoom(entry.roomId);
                          }
                        }
                      : undefined
                  }
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
                          variant="secondary"
                          size="sm"
                          loading={isBusy}
                          onClick={() => handleDeclineInvite(entry.roomId, entry.name)}
                        >
                          {t('invite.decline')}
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          loading={isBusy}
                          onClick={() => handleAcceptInvite(entry.roomId)}
                        >
                          {t('invite.accept')}
                        </Button>
                      </>
                    ) : entry.isJoined ? (
                      <IconButton
                        size="sm"
                        tooltip={t('common.more')}
                        aria-label={t('common.more')}
                        onClick={(e) => {
                          openContextMenu(e, buildRoomMenu(entry));
                        }}
                      >
                        <DotsThreeVerticalIcon size={20} weight="bold" />
                      </IconButton>
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
