import { useCallback, useState } from 'react';
import { GearIcon, UserPlusIcon, SignOutIcon, PlusIcon, StackIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/app/components/Button';
import {
  currentRoomIdAtom,
  currentSpaceIdAtom,
  sidebarViewAtom,
  createRoomOpenAtom,
  newDmOpenAtom,
  roomSettingsRoomIdAtom,
  voiceStateAtom,
  callStateAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useDms } from '@/app/hooks/useDms';
import { useRooms } from '@/app/features/room';
import { VoiceBar } from '@/app/features/voice/VoiceBar';
import { Avatar } from '@/app/components/Avatar';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';
import { useRoomActions } from './hooks/useRoomActions';
import { ChatListItem } from './ChatListItem';
import { UserPanel } from './UserPanel';
import * as css from './RoomListPanel.css';

interface RoomListPanelProps {
  onVoiceLeave: () => void;
  onVoiceToggleMute: () => void;
  onVoiceToggleVideo: () => void;
  onVoiceJoin: (roomId: string, domain: string) => void;
}

export function RoomListPanel({
  onVoiceLeave,
  onVoiceToggleMute,
  onVoiceToggleVideo,
  onVoiceJoin,
}: RoomListPanelProps) {
  const { t } = useTranslation();
  const [currentRoomId, setCurrentRoomId] = useAtom(currentRoomIdAtom);
  const [currentSpaceId] = useAtom(currentSpaceIdAtom);
  const [sidebarView] = useAtom(sidebarViewAtom);
  const [, setCreateRoomOpen] = useAtom(createRoomOpenAtom);
  const [, setNewDmOpen] = useAtom(newDmOpenAtom);
  const [, setRoomSettings] = useAtom(roomSettingsRoomIdAtom);
  const navigate = useNavigate();
  const client = getMatrixClientOrNull();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();

  const rooms = useRooms(sidebarView !== 'dms' ? currentSpaceId : null);
  const dms = useDms(client);
  const voiceState = useAtomValue(voiceStateAtom);
  const callState = useAtomValue(callStateAtom);
  const toast = useToast();

  const selectRoom = useCallback(
    (roomId: string, isDm = false) => {
      setCurrentRoomId(roomId);
      navigate(`/${isDm ? 'dm' : 'r'}/${encodeURIComponent(roomId)}`);
    },
    [setCurrentRoomId, navigate]
  );

  const buildRoomMenu = useCallback(
    (entry: { roomId: string; name: string }) => {
      if (!client) return [];
      return [
        {
          label: t('common.invite'),
          icon: <UserPlusIcon size={14} />,
          onClick: () =>
            roomActions.inviteToRoom({ roomId: entry.roomId, name: entry.name, isSpace: false }),
        },
        {
          label: t('common.settings'),
          icon: <GearIcon size={14} />,
          onClick: () => setRoomSettings(entry.roomId),
        },
        {
          divider: true,
          label: '',
          onClick: () => {},
        },
        {
          label: t('room.leaveRoom'),
          icon: <SignOutIcon size={14} />,
          danger: true,
          onClick: () => roomActions.leaveRoom(entry.roomId, entry.name),
        },
      ];
    },
    [client, roomActions, setRoomSettings, t]
  );

  const buildDmMenu = useCallback(
    (entry: { roomId: string; partnerName: string }) => {
      return [
        {
          label: t('room.dm.leaveDm'),
          icon: <SignOutIcon size={14} />,
          danger: true,
          onClick: () => roomActions.leaveRoom(entry.roomId, entry.partnerName),
        },
      ];
    },
    [roomActions, t]
  );

  const isDmView = sidebarView === 'dms';

  // Space invite state
  const currentSpace = currentSpaceId && client ? client.getRoom(currentSpaceId) : null;
  const isSpaceInvite = currentSpace?.getMyMembership() === 'invite';
  const [inviteLoading, setInviteLoading] = useState(false);

  const spaceInviterEvent = currentSpace?.currentState?.getStateEvents(
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

  return (
    <div className={css.roomListPanel}>
      <div className={css.roomHeader}>
        <span className={css.roomHeaderTitle} title={headerLabel}>
          {showSpaceIcon && <StackIcon size={14} className={css.roomHeaderIcon} />}
          <span className={css.roomHeaderLabel}>{headerLabel}</span>
        </span>
        <div className={css.roomHeaderActions}>
          <IconButton
            size="sm"
            title={isDmView ? t('room.dm.newDmShort') : t('room.create.titleShort')}
            onClick={() => {
              if (isDmView) {
                setNewDmOpen(true);
              } else {
                const spaceName = currentSpaceId
                  ? (client?.getRoom(currentSpaceId)?.name ?? null)
                  : null;
                setCreateRoomOpen({ open: true, spaceId: currentSpaceId, spaceName });
              }
            }}
          >
            <PlusIcon size={16} />
          </IconButton>
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
            <button
              className={css.inviteDeclineBtn}
              onClick={handleSpaceDecline}
              disabled={inviteLoading}
            >
              {t('invite.decline')}
            </button>
            <button
              className={css.inviteAcceptBtn}
              onClick={handleSpaceAccept}
              disabled={inviteLoading}
            >
              {t('invite.accept')}
            </button>
          </div>
        </div>
      ) : null}

      <div className={css.roomList} style={isSpaceInvite ? { display: 'none' } : undefined}>
        {isDmView ? (
          <>
            {dms.map((entry) => (
              <ChatListItem
                key={entry.roomId}
                name={entry.partnerName}
                roomId={entry.roomId}
                avatarMxc={entry.partnerAvatarMxc}
                isActive={currentRoomId === entry.roomId}
                unread={entry.unreadCount}
                hasNotif={entry.hasNotif}
                onClick={() => selectRoom(entry.roomId, true)}
                onContextMenu={(e) => openContextMenu(e, buildDmMenu(entry))}
              />
            ))}
            {dms.length === 0 && <div className={css.emptyList}>{t('room.noDms')}</div>}
          </>
        ) : (
          <>
            {rooms.map((entry) => (
              <ChatListItem
                key={entry.roomId}
                name={entry.name}
                roomId={entry.roomId}
                avatarMxc={entry.avatarMxc}
                isActive={currentRoomId === entry.roomId}
                isInvite={entry.isInvite}
                unread={entry.unreadCount}
                hasNotif={entry.hasNotif}
                hasVoiceChannel={entry.hasVoiceChannel}
                isInVoiceCall={voiceState.roomId === entry.roomId}
                onJoinVoice={(e) => {
                  e.stopPropagation();
                  if (callState.active || callState.incoming) {
                    toast.warning(t('voice.alreadyInVoipCall'));
                    return;
                  }
                  if (!entry.jitsiDomain) return;
                  onVoiceJoin(entry.roomId, entry.jitsiDomain);
                }}
                onClick={() => selectRoom(entry.roomId)}
                onContextMenu={(e) => openContextMenu(e, buildRoomMenu(entry))}
              />
            ))}
            {rooms.length === 0 && <div className={css.emptyList}>{t('room.noRooms')}</div>}
          </>
        )}
      </div>

      {/* Voice bar — above UserPanel, self-hides when not in a call */}
      <VoiceBar
        onLeave={onVoiceLeave}
        onToggleMute={onVoiceToggleMute}
        onToggleVideo={onVoiceToggleVideo}
      />

      <UserPanel />
    </div>
  );
}
