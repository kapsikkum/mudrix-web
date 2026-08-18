import { useEffect, useRef, useState } from 'react';
import {
  SpeakerHighIcon,
  EnvelopeSimpleIcon,
  HashStraightIcon,
  BellSlashIcon,
  DotsThreeVerticalIcon,
} from '@phosphor-icons/react';
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
  hasVoiceRoom?: boolean;
  hasActiveCall?: boolean;
  isInCall?: boolean;
  isMuted?: boolean;
  showTypeBadge?: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMenuClick?: (e: React.MouseEvent) => void;
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
  hasVoiceRoom,
  hasActiveCall,
  isInCall,
  isMuted,
  showTypeBadge,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMenuClick,
}: ChatListItemProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const itemClass = isActive ? css.roomItemActive : css.roomItem;
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
        onDoubleClick={onDoubleClick}
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
        <span className={css.avatarWrap}>
          <span className={css.chatAvatar} style={isInvite ? { opacity: 0.35 } : undefined}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className={css.chatAvatarImg} />
            ) : (
              <Avatar
                name={name}
                mxcUrl={avatarMxc ?? null}
                client={client ?? undefined}
                size="sm"
              />
            )}
          </span>
          {showTypeBadge && (
            <span
              className={hasVoiceRoom && isInCall ? css.roomTypeBadgeVoice : css.roomTypeBadge}
              title={hasVoiceRoom ? t('room.joinVoice') : undefined}
            >
              {hasVoiceRoom ? (
                <SpeakerHighIcon size={11} weight="fill" />
              ) : (
                <HashStraightIcon size={11} weight="bold" />
              )}
            </span>
          )}
        </span>

        <span className={css.chatTextContent}>{name}</span>

        <span className={css.itemBadges}>
          {hasActiveCall && !isInvite && (
            <span className={css.callBadge} title={t('voice.callActive')}>
              <SpeakerHighIcon size={14} weight="fill" />
            </span>
          )}

          {isMuted && (
            <span className={css.mutedBadge} title={t('notifLevel.mute')}>
              <BellSlashIcon size={13} />
            </span>
          )}

          {isInvite && (
            <span className={css.inviteBadge}>
              <EnvelopeSimpleIcon size={12} weight="fill" />
            </span>
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
        </span>

        {onMenuClick && (
          <button
            type="button"
            className={css.itemMenuButton}
            aria-label={t('common.menu')}
            title={t('common.menu')}
            onClick={onMenuClick}
          >
            <DotsThreeVerticalIcon size={14} weight="bold" />
          </button>
        )}
      </div>
      {/* Voice participants list: only mounted for rooms that actually have a voice room */}
      {hasVoiceRoom && <RoomVoiceParticipants roomId={roomId} />}
    </div>
  );
}
