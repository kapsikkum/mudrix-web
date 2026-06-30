import { useEffect, useRef, useState } from 'react';
import { MicrophoneIcon, CircleNotchIcon } from '@phosphor-icons/react';
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
  isVoiceReady?: boolean;
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
  isVoiceReady,
  onJoinVoice,
  onClick,
  onContextMenu,
}: ChatListItemProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const itemClass = isActive ? css.roomItemActive : isInvite ? css.roomItemInvite : css.roomItem;
  const prevUnreadRef = useRef<number | undefined>(undefined);
  const [bumping, setBumping] = useState(false);

  useEffect(() => {
    if (prevUnreadRef.current !== undefined && (unread ?? 0) > prevUnreadRef.current) {
      setBumping(true);
      const timer = setTimeout(() => setBumping(false), 150);
      prevUnreadRef.current = unread;
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  return (
    <div>
      <div
        className={itemClass}
        onClick={onClick}
        onContextMenu={onContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Avatar with optional invite badge */}
        <span className={css.chatAvatar}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className={css.chatAvatarImg} />
          ) : (
            <Avatar name={name} mxcUrl={avatarMxc ?? null} client={client ?? undefined} size="sm" />
          )}
        </span>

        <span className={css.chatTextContent}>{name}</span>

        {isInvite && <span className={css.inviteBadge} title={t('common.invite')} />}

        {/* Mic button — only on rooms with a voice widget, never on invites */}
        {hasVoiceChannel && !isInvite && (
          <button
            type="button"
            className={
              isInVoiceCall && isVoiceReady
                ? css.micBtnActive
                : isInVoiceCall
                  ? css.micBtnConnecting
                  : css.micBtn
            }
            aria-label={
              isInVoiceCall && !isVoiceReady
                ? t('voice.statusConnecting')
                : isInVoiceCall
                  ? t('voice.connected')
                  : t('room.joinVoice')
            }
            onClick={isInVoiceCall ? undefined : onJoinVoice}
            style={{ cursor: isInVoiceCall ? 'default' : 'pointer' }}
          >
            {isInVoiceCall && !isVoiceReady ? (
              <CircleNotchIcon size={12} className={css.micSpinner} />
            ) : (
              <MicrophoneIcon size={12} weight={isInVoiceCall ? 'fill' : 'regular'} />
            )}
          </button>
        )}

        {unread ? (
          <span
            className={[hasNotif ? css.roomBadgeNotif : css.roomBadge, bumping && css.badgeBump]
              .filter(Boolean)
              .join(' ')}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </div>
      {/* Voice participants list: only mounted for rooms that actually have a voice channel */}
      {hasVoiceChannel && <RoomVoiceParticipants roomId={roomId} />}
    </div>
  );
}
