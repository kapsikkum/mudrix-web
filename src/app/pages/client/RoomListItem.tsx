import { memo, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  GearIcon,
  UserPlusIcon,
  SignOutIcon,
  XCircleIcon,
  EyeIcon,
  ChatTextIcon,
  BellIcon,
  BellRingingIcon,
  BellSlashIcon,
} from '@phosphor-icons/react';
import { roomSettingsRoomIdAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { findLastReceiptableEvent, receiptTypeFor } from './markAsRead';
import { preferencesAtom } from '@/app/store/atoms/settings';
import { useToast } from '@/app/hooks/useToast';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useRoomActions } from './hooks/useRoomActions';
import { useRoomNotifLevel } from '@/app/hooks/useRoomNotifLevel';
import type { NotifLevel } from '@/app/hooks/useNotifications';
import { ChatListItem } from './ChatListItem';
import { getErrorMessage } from '@/util/error';
import type { RoomEntry } from '@/app/features/room/useRooms';
import type { DmEntry } from '@/app/hooks/useDms';

function notifMenuItems(
  level: NotifLevel,
  setLevel: (level: NotifLevel) => void,
  t: (key: string) => string
) {
  const options: { value: NotifLevel; label: string; icon: React.ReactNode }[] = [
    { value: 'all', label: t('notifLevel.all'), icon: <BellRingingIcon size={14} /> },
    { value: 'mentions', label: t('notifLevel.mentions'), icon: <BellIcon size={14} /> },
    { value: 'mute', label: t('notifLevel.mute'), icon: <BellSlashIcon size={14} /> },
  ];
  return options.map((opt) => ({
    label: opt.label,
    icon: opt.icon,
    checked: level === opt.value,
    onClick: () => setLevel(opt.value),
  }));
}

function notifMenuItem(
  level: NotifLevel,
  setLevel: (level: NotifLevel) => void,
  t: (key: string) => string
) {
  return {
    label: t('room.notifications.title'),
    icon: <BellIcon size={14} />,
    submenu: notifMenuItems(level, setLevel, t),
    onClick: () => {},
  };
}

interface RoomListItemProps {
  entry: RoomEntry;
  isActive: boolean;
  hasActiveCall?: boolean;
  isInCall?: boolean;
  onSelect: (roomId: string) => void;
  onOpenChat: (roomId: string) => void;
  onOpenChatOnly?: (roomId: string) => void;
}

export const RoomListItem = memo(function RoomListItem({
  entry,
  isActive,
  hasActiveCall,
  isInCall,
  onSelect,
  onOpenChat,
  onOpenChatOnly,
}: RoomListItemProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [, setRoomSettings] = useAtom(roomSettingsRoomIdAtom);
  const prefs = useAtomValue(preferencesAtom);
  const { level, setLevel } = useRoomNotifLevel(entry.roomId);
  const client = getMatrixClientOrNull();

  const handleClick = useCallback(() => {
    onSelect(entry.roomId);
  }, [onSelect, entry.roomId]);

  const handleDoubleClick = useCallback(() => {
    onOpenChat(entry.roomId);
  }, [onOpenChat, entry.roomId]);

  const handleMarkAsRead = useCallback(() => {
    if (!client) return;
    const room = client.getRoom(entry.roomId);
    if (!room) return;
    const lastEvent = findLastReceiptableEvent(room);
    if (!lastEvent) return;
    const eventId = lastEvent.getId();
    if (!eventId) return;
    client.sendReadReceipt(lastEvent, receiptTypeFor(prefs)).catch(() => {});
    client.setRoomReadMarkers(entry.roomId, eventId).catch(() => {});
  }, [client, entry.roomId, prefs.sendReadReceipts]);

  const handleDeclineInvite = useCallback(async () => {
    if (!roomActions.client) return;
    try {
      await roomActions.client.leave(entry.roomId);
      toast.info(t('invite.declined', { name: entry.name }));
    } catch (err) {
      toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
    }
  }, [roomActions.client, entry.roomId, entry.name, toast, t]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (entry.isInvite) {
        openContextMenu(e, [
          {
            label: t('invite.declineInvite'),
            icon: <XCircleIcon size={14} />,
            danger: true,
            onClick: handleDeclineInvite,
          },
        ]);
        return;
      }

      openContextMenu(e, [
        ...(entry.hasVoiceRoom
          ? [
              {
                label: t('room.openChat'),
                icon: <ChatTextIcon size={14} />,
                onClick: () => onOpenChatOnly?.(entry.roomId),
              },
            ]
          : []),
        {
          label: t('room.markAsRead'),
          icon: <EyeIcon size={14} />,
          disabled: entry.unreadCount === 0 && !entry.hasNotif,
          onClick: handleMarkAsRead,
        },
        {
          divider: true,
          label: '',
          onClick: () => {},
        },
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
        notifMenuItem(level, setLevel, t),
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
    [
      openContextMenu,
      roomActions,
      setRoomSettings,
      entry.isInvite,
      entry.roomId,
      entry.name,
      handleDeclineInvite,
      handleMarkAsRead,
      onOpenChat,
      onOpenChatOnly,
      entry.hasVoiceRoom,
      t,
      level,
      setLevel,
    ]
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
      hasVoiceRoom={entry.hasVoiceRoom}
      hasActiveCall={hasActiveCall}
      isInCall={isInCall}
      isMuted={level === 'mute'}
      showTypeBadge={!entry.isInvite}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    />
  );
});

interface DmListItemProps {
  entry: DmEntry;
  isActive: boolean;
  hasActiveCall?: boolean;
  isInCall?: boolean;
  onSelect: (roomId: string, isDm: boolean) => void;
}

export const DmListItem = memo(function DmListItem({
  entry,
  isActive,
  hasActiveCall,
  isInCall,
  onSelect,
}: DmListItemProps) {
  const { t } = useTranslation();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const toast = useToast();
  const { level, setLevel } = useRoomNotifLevel(entry.roomId);
  const client = getMatrixClientOrNull();

  const handleClick = useCallback(() => {
    onSelect(entry.roomId, true);
  }, [onSelect, entry.roomId]);

  const handleDeclineInvite = useCallback(async () => {
    if (!client) return;
    try {
      await client.leave(entry.roomId);
      toast.info(t('invite.declined', { name: entry.partnerName }));
    } catch (err) {
      toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
    }
  }, [client, entry.roomId, entry.partnerName, toast, t]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (entry.isInvite) {
        openContextMenu(e, [
          {
            label: t('invite.declineInvite'),
            icon: <XCircleIcon size={14} />,
            danger: true,
            onClick: handleDeclineInvite,
          },
        ]);
        return;
      }
      openContextMenu(e, [
        notifMenuItem(level, setLevel, t),
        {
          divider: true,
          label: '',
          onClick: () => {},
        },
        {
          label: t('room.dm.leaveDm'),
          icon: <SignOutIcon size={14} />,
          danger: true,
          onClick: () => roomActions.leaveRoom(entry.roomId, entry.partnerName),
        },
      ]);
    },
    [
      openContextMenu,
      roomActions,
      entry.isInvite,
      entry.roomId,
      entry.partnerName,
      handleDeclineInvite,
      t,
      level,
      setLevel,
    ]
  );

  return (
    <ChatListItem
      name={entry.partnerName}
      roomId={entry.roomId}
      avatarMxc={entry.partnerAvatarMxc}
      isActive={isActive}
      isInvite={entry.isInvite}
      unread={entry.unreadCount}
      hasNotif={entry.hasNotif}
      hasActiveCall={hasActiveCall}
      isInCall={isInCall}
      isMuted={level === 'mute'}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    />
  );
});
