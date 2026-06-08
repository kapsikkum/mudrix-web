import { memo, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { GearIcon, UserPlusIcon, SignOutIcon } from '@phosphor-icons/react';
import {
  confirmModalAtom,
  callStateAtom,
  voiceStateAtom,
  roomSettingsRoomIdAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useRoomActions } from './hooks/useRoomActions';
import { ChatListItem } from './ChatListItem';
import type { RoomEntry } from '@/app/features/room/useRooms';
import type { DmEntry } from '@/app/hooks/useDms';

interface RoomListItemProps {
  entry: RoomEntry;
  isActive: boolean;
  onSelect: (roomId: string) => void;
  onVoiceJoin: (roomId: string, domain: string) => void;
}

export const RoomListItem = memo(function RoomListItem({
  entry,
  isActive,
  onSelect,
  onVoiceJoin,
}: RoomListItemProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [, setConfirm] = useAtom(confirmModalAtom);
  const [, setRoomSettings] = useAtom(roomSettingsRoomIdAtom);
  const voiceState = useAtomValue(voiceStateAtom);
  const callState = useAtomValue(callStateAtom);

  const handleClick = useCallback(() => {
    onSelect(entry.roomId);
  }, [onSelect, entry.roomId]);

  const handleJoinVoice = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (callState.active || callState.incoming) {
        toast.warning(t('voice.alreadyInVoipCall'));
        return;
      }
      if (!entry.jitsiDomain) return;
      if (voiceState.roomId && voiceState.roomId !== entry.roomId) {
        setConfirm({
          open: true,
          title: t('common.confirm'),
          message: t('voice.confirmSwitchMeeting', {
            roomName: voiceState.roomName ?? voiceState.roomId,
          }),
          resolve: (confirmed) => {
            if (confirmed) onVoiceJoin(entry.roomId, entry.jitsiDomain!);
          },
        });
        return;
      }
      onVoiceJoin(entry.roomId, entry.jitsiDomain);
    },
    [
      callState.active,
      callState.incoming,
      entry.jitsiDomain,
      entry.roomId,
      onVoiceJoin,
      setConfirm,
      t,
      toast,
      voiceState.roomId,
      voiceState.roomName,
    ]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, [
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
      ]);
    },
    [openContextMenu, roomActions, setRoomSettings, entry.roomId, entry.name, t]
  );

  return (
    <ChatListItem
      name={entry.name}
      roomId={entry.roomId}
      avatarMxc={entry.avatarMxc}
      isActive={isActive}
      isInvite={entry.isInvite}
      unread={entry.unreadCount}
      hasNotif={entry.hasNotif}
      hasVoiceChannel={entry.hasVoiceChannel}
      isInVoiceCall={voiceState.roomId === entry.roomId}
      onJoinVoice={handleJoinVoice}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  );
});

interface DmListItemProps {
  entry: DmEntry;
  isActive: boolean;
  onSelect: (roomId: string, isDm: boolean) => void;
}

export const DmListItem = memo(function DmListItem({ entry, isActive, onSelect }: DmListItemProps) {
  const { t } = useTranslation();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();

  const handleClick = useCallback(() => {
    onSelect(entry.roomId, true);
  }, [onSelect, entry.roomId]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, [
        {
          label: t('room.dm.leaveDm'),
          icon: <SignOutIcon size={14} />,
          danger: true,
          onClick: () => roomActions.leaveRoom(entry.roomId, entry.partnerName),
        },
      ]);
    },
    [openContextMenu, roomActions, entry.roomId, entry.partnerName, t]
  );

  return (
    <ChatListItem
      name={entry.partnerName}
      roomId={entry.roomId}
      avatarMxc={entry.partnerAvatarMxc}
      isActive={isActive}
      unread={entry.unreadCount}
      hasNotif={entry.hasNotif}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  );
});
