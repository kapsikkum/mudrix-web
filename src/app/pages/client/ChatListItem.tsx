import { MicrophoneIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/app/components/Avatar';
import { RoomVoiceParticipants } from '@/app/features/voice/VoiceParticipants';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import * as css from './ChatListItem.css';

interface ChatListItemProps {
  name: string;
  roomId: string;
  avatarMxc?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  isInvite?: boolean;
  unread?: number;
  hasNotif?: boolean;
  hasVoiceChannel?: boolean;
  isInVoiceCall?: boolean;
  onJoinVoice?: (e: React.MouseEvent) => void;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function ChatListItem({
  name,
  roomId,
  avatarMxc,
  avatarUrl,
  isActive,
  isInvite,
  unread,
  hasNotif,
  hasVoiceChannel,
  isInVoiceCall,
  onJoinVoice,
  onClick,
  onContextMenu,
}: ChatListItemProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const itemClass = isActive ? css.roomItemActive : isInvite ? css.roomItemInvite : css.roomItem;

  return (
    <div>
      <div className={itemClass} onClick={onClick} onContextMenu={onContextMenu}>
        {/* Avatar with optional invite badge */}
        <span className={css.chatAvatar}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <Avatar name={name} mxcUrl={avatarMxc ?? null} client={client ?? undefined} size="sm" />
          )}
        </span>

        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {name}
        </span>

        {isInvite && <span className={css.inviteBadge} title={t('common.invite')} />}

        {/* Mic button — only on rooms with a voice widget, never on invites */}
        {hasVoiceChannel && !isInvite && (
          <button
            className={css.micBtn}
            title={t('room.joinVoice')}
            onClick={isInVoiceCall ? undefined : onJoinVoice}
            style={{ cursor: isInVoiceCall ? 'default' : 'pointer' }}
          >
            <MicrophoneIcon size={12} weight={isInVoiceCall ? 'fill' : 'regular'} />
          </button>
        )}

        {unread ? (
          <span className={hasNotif ? css.roomBadgeNotif : css.roomBadge}>
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </div>
      {/* Voice participants list — Discord-style, under the room row */}
      <RoomVoiceParticipants roomId={roomId} />
    </div>
  );
}
