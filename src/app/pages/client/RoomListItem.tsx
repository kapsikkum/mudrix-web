import { memo, useCallback, useMemo } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { selectAtom } from 'jotai/utils';
import { useTranslation } from 'react-i18next';
import {
  GearIcon,
  StackIcon,
  ArrowUpIcon,
  SpeakerHighIcon,
  HashStraightIcon,
  ArrowDownIcon,
  UserPlusIcon,
  SignOutIcon,
  ChecksIcon,
  ChatTextIcon,
  BellIcon,
  BellSimpleIcon,
  BellRingingIcon,
  BellSlashIcon,
  LinkSimpleIcon,
  StarIcon,
  ArrowLineDownIcon,
  EnvelopeSimpleIcon,
} from '@phosphor-icons/react';
import {
  roomSettingsRoomIdAtom,
  favouriteRoomsAtom,
  lowPriorityRoomsAtom,
  presenceMapAtom,
  showPresenceAtom,
} from '@/app/store/atoms';
import { useInViewOnce, useListCosmetics } from '@/app/features/profile/ListCosmetics';
import { effectiveDotPresence } from '@/util/profileCosmetics';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { markRoomRead } from './markAsRead';
import {
  canSetVoiceChannel,
  isVoiceChannelFlagged,
  setVoiceChannel,
} from '@/app/features/room/voiceChannel';
import {
  sendReadReceiptsAtom,
  roomAvatarsVisibleAtom,
  activeRoomListStyleAtom,
} from '@/app/store/atoms/settings';
import { useToast } from '@/app/hooks/useToast';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import { useRoomActions } from './hooks/useRoomActions';
import { useRoomNotifLevel } from '@/app/hooks/useRoomNotifLevel';
import type { NotifLevel } from '@/app/hooks/useNotifications';
import { ChatListItem } from './ChatListItem';
import { getErrorMessage } from '@/util/error';
import { makeRoomPermalink } from '@/util/matrix';
import { FAVOURITE_ROOM_TAG, LOW_PRIORITY_ROOM_TAG } from '@/app/hooks/useBindFavouriteRooms';
import { setRoomMarkedUnread } from '@/util/markedUnread';
import type { RoomEntry } from '@/app/features/room/useRooms';
import type { DmEntry } from '@/app/hooks/useDms';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';

function notifMenuItems(
  level: NotifLevel,
  setLevel: (level: NotifLevel) => void,
  t: (key: string) => string
) {
  const options: { value: NotifLevel; label: string; icon: React.ReactNode }[] = [
    { value: 'default', label: t('notifLevel.default'), icon: <BellIcon size={14} /> },
    { value: 'all', label: t('notifLevel.all'), icon: <BellRingingIcon size={14} /> },
    { value: 'mentions', label: t('notifLevel.mentions'), icon: <BellSimpleIcon size={14} /> },
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
  voiceMembers?: CallMembership[];
  onSelect: (roomId: string) => void;
  onOpenChat: (roomId: string) => void;
  onOpenChatOnly?: (roomId: string) => void;
  /** Modern style: set when the user may reorder this room inside its space. */
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (roomId: string, direction: -1 | 1) => void;
  /** Modern style: the other categories this room can be moved into. */
  categoryTargets?: { id: string; name: string }[];
  onMoveToCategory?: (roomId: string, targetSpaceId: string) => void;
}

export const RoomListItem = memo(function RoomListItem({
  entry,
  isActive,
  hasActiveCall,
  isInCall,
  voiceMembers,
  onSelect,
  onOpenChat,
  onOpenChatOnly,
  canMoveUp,
  canMoveDown,
  onMove,
  categoryTargets,
  onMoveToCategory,
}: RoomListItemProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { openContextMenu } = useContextMenu();
  const roomActions = useRoomActions();
  const [, setRoomSettings] = useAtom(roomSettingsRoomIdAtom);
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);
  const showRoomAvatars = useAtomValue(roomAvatarsVisibleAtom);
  const { level, setLevel } = useRoomNotifLevel(entry.roomId);
  const favourite = useAtomValue(favouriteRoomsAtom).has(entry.roomId);
  const lowPriority = useAtomValue(lowPriorityRoomsAtom).has(entry.roomId);
  const client = getMatrixClientOrNull();
  const modernMenu = useAtomValue(activeRoomListStyleAtom) === 'modern';
  const canDedicate = modernMenu && !!client && canSetVoiceChannel(client, entry.roomId);
  const isVoiceChannel = isVoiceChannelFlagged(client?.getRoom(entry.roomId));

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
    markRoomRead(client, room, sendReadReceipts);
  }, [client, entry.roomId, sendReadReceipts]);

  const handleMarkAsUnread = useCallback(() => {
    if (!client) return;
    setRoomMarkedUnread(client, entry.roomId, true).catch((err) =>
      toast.error(t('room.markUnreadFailed', { error: getErrorMessage(err) }))
    );
  }, [client, entry.roomId, toast, t]);

  const handleCopyLink = useCallback(() => {
    if (!client) return;
    const room = client.getRoom(entry.roomId);
    if (!room) return;
    navigator.clipboard.writeText(makeRoomPermalink(room)).catch(() => {});
  }, [client, entry.roomId]);

  const handleToggleFavourite = useCallback(async () => {
    if (!client) return;
    try {
      if (favourite) {
        await client.deleteRoomTag(entry.roomId, FAVOURITE_ROOM_TAG);
      } else {
        await client.setRoomTag(entry.roomId, FAVOURITE_ROOM_TAG, {});
        // Favourite and low priority are mutually exclusive.
        if (client.getRoom(entry.roomId)?.tags?.[LOW_PRIORITY_ROOM_TAG]) {
          await client.deleteRoomTag(entry.roomId, LOW_PRIORITY_ROOM_TAG);
        }
      }
    } catch (err) {
      toast.error(t('room.toggleFavouriteFailed', { error: getErrorMessage(err) }));
    }
  }, [client, entry.roomId, favourite, toast, t]);

  const handleToggleLowPriority = useCallback(async () => {
    if (!client) return;
    try {
      if (lowPriority) {
        await client.deleteRoomTag(entry.roomId, LOW_PRIORITY_ROOM_TAG);
      } else {
        await client.setRoomTag(entry.roomId, LOW_PRIORITY_ROOM_TAG, {});
        if (client.getRoom(entry.roomId)?.tags?.[FAVOURITE_ROOM_TAG]) {
          await client.deleteRoomTag(entry.roomId, FAVOURITE_ROOM_TAG);
        }
      }
    } catch (err) {
      toast.error(t('room.toggleLowPriorityFailed', { error: getErrorMessage(err) }));
    }
  }, [client, entry.roomId, lowPriority, toast, t]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, [
        ...(modernMenu && canDedicate
          ? [
              {
                label: isVoiceChannel ? t('room.makeTextChannel') : t('room.makeVoiceChannel'),
                icon: isVoiceChannel ? (
                  <HashStraightIcon size={14} />
                ) : (
                  <SpeakerHighIcon size={14} />
                ),
                onClick: () => {
                  if (!client) return;
                  setVoiceChannel(client, entry.roomId, !isVoiceChannel).catch((err) =>
                    toast.error(t('room.voiceChannelFailed', { error: getErrorMessage(err) }))
                  );
                },
              },
            ]
          : []),
        ...(onMoveToCategory && categoryTargets
          ? categoryTargets.map((target) => ({
              label: t('room.moveToCategory', { name: target.name }),
              icon: <StackIcon size={14} />,
              onClick: () => onMoveToCategory(entry.roomId, target.id),
            }))
          : []),
        ...(onMove
          ? [
              {
                label: t('room.moveUp'),
                icon: <ArrowUpIcon size={14} />,
                disabled: !canMoveUp,
                onClick: () => onMove(entry.roomId, -1),
              },
              {
                label: t('room.moveDown'),
                icon: <ArrowDownIcon size={14} />,
                disabled: !canMoveDown,
                onClick: () => onMove(entry.roomId, 1),
              },
            ]
          : []),
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
          label: t('common.markRead'),
          icon: <ChecksIcon size={14} />,
          disabled: entry.unreadCount === 0 && !entry.hasNotif,
          onClick: handleMarkAsRead,
        },
        {
          label: t('room.markUnread'),
          icon: <EnvelopeSimpleIcon size={14} />,
          disabled: entry.unreadCount > 0 || entry.hasNotif,
          onClick: handleMarkAsUnread,
        },
        {
          label: favourite ? t('room.removeFavourite') : t('room.addFavourite'),
          icon: <StarIcon size={14} weight={favourite ? 'fill' : 'regular'} />,
          onClick: handleToggleFavourite,
        },
        {
          label: lowPriority ? t('room.removeLowPriority') : t('room.addLowPriority'),
          icon: <ArrowLineDownIcon size={14} weight={lowPriority ? 'fill' : 'regular'} />,
          onClick: handleToggleLowPriority,
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
          label: t('common.copyLink'),
          icon: <LinkSimpleIcon size={14} />,
          onClick: handleCopyLink,
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
      entry.roomId,
      entry.name,
      handleMarkAsRead,
      handleCopyLink,
      handleToggleFavourite,
      handleToggleLowPriority,
      handleMarkAsUnread,
      entry.unreadCount,
      entry.hasNotif,
      lowPriority,
      onOpenChat,
      onOpenChatOnly,
      entry.hasVoiceRoom,
      favourite,
      t,
      level,
      setLevel,
      onMove,
      canMoveUp,
      canMoveDown,
      categoryTargets,
      onMoveToCategory,
      modernMenu,
      canDedicate,
      isVoiceChannel,
      client,
      toast,
    ]
  );

  return (
    <ChatListItem
      name={entry.name}
      roomId={entry.roomId}
      avatarMxc={entry.avatarMxc}
      isActive={isActive}
      unread={entry.unreadCount}
      hasNotif={entry.hasNotif}
      hasVoiceRoom={entry.hasVoiceRoom}
      hasActiveCall={hasActiveCall}
      isInCall={isInCall}
      voiceMembers={voiceMembers}
      isMuted={level === 'mute'}
      showTypeBadge={true}
      hideAvatar={!showRoomAvatars}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMenuClick={handleContextMenu}
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
  const { level, setLevel } = useRoomNotifLevel(entry.roomId);
  const client = getMatrixClientOrNull();
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);
  const toast = useToast();

  // DM rows only: the partner's decoration, custom status and presence. The profile request
  // waits until the row has been on screen once; the query is shared and cached per user.
  const showPresence = useAtomValue(showPresenceAtom);
  const partnerPresenceAtom = useMemo(
    () => selectAtom(presenceMapAtom, (m) => m[entry.partnerId]),
    [entry.partnerId]
  );
  const partnerPresence = useAtomValue(partnerPresenceAtom);
  const [observeRow, rowSeen] = useInViewOnce<HTMLDivElement>();
  const { decoration, nameplate, status } = useListCosmetics(client, entry.partnerId, rowSeen);
  const dotPresence = showPresence
    ? effectiveDotPresence(partnerPresence, status?.mode)
    : undefined;

  const handleClick = useCallback(() => {
    onSelect(entry.roomId, true);
  }, [onSelect, entry.roomId]);

  const handleMarkAsRead = useCallback(() => {
    if (!client) return;
    const room = client.getRoom(entry.roomId);
    if (!room) return;
    markRoomRead(client, room, sendReadReceipts);
  }, [client, entry.roomId, sendReadReceipts]);

  const handleMarkAsUnread = useCallback(() => {
    if (!client) return;
    setRoomMarkedUnread(client, entry.roomId, true).catch((err) =>
      toast.error(t('room.markUnreadFailed', { error: getErrorMessage(err) }))
    );
  }, [client, entry.roomId, toast, t]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      openContextMenu(e, [
        {
          label: t('common.markRead'),
          icon: <ChecksIcon size={14} />,
          disabled: entry.unreadCount === 0 && !entry.hasNotif,
          onClick: handleMarkAsRead,
        },
        {
          label: t('room.markUnread'),
          icon: <EnvelopeSimpleIcon size={14} />,
          disabled: entry.unreadCount > 0 || entry.hasNotif,
          onClick: handleMarkAsUnread,
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
      entry.roomId,
      entry.partnerName,
      entry.unreadCount,
      entry.hasNotif,
      handleMarkAsRead,
      handleMarkAsUnread,
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
      unread={entry.unreadCount}
      hasNotif={entry.hasNotif}
      hasActiveCall={hasActiveCall}
      isInCall={isInCall}
      isMuted={level === 'mute'}
      decoration={decoration}
      nameplate={nameplate}
      fixedHeight
      presence={dotPresence}
      statusEmoji={status?.emoji}
      statusText={status?.text}
      rowRef={observeRow}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMenuClick={handleContextMenu}
    />
  );
});
