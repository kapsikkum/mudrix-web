import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SpeakerHighIcon,
  HashStraightIcon,
  BellSlashIcon,
  DotsThreeVerticalIcon,
  PhoneIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/app/components/Avatar';
import { Tooltip } from '@/app/components/Tooltip';
import { RoomVoiceParticipants } from '@/app/features/voice/VoiceParticipants';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { isMenuOpenKey, syntheticMouseEvent } from '@/app/hooks/useContextMenu';
import type { CallMembership } from 'matrix-js-sdk/lib/matrixrtc';
import * as css from './ChatListItem.css';

interface ChatListItemProps {
  name: string;
  roomId: string;
  avatarMxc?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  unread?: number;
  hasNotif?: boolean;
  hasVoiceRoom?: boolean;
  hasActiveCall?: boolean;
  isInCall?: boolean;
  isMuted?: boolean;
  showTypeBadge?: boolean;
  voiceMembers?: CallMembership[];
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
  unread,
  hasNotif,
  hasVoiceRoom,
  hasActiveCall,
  isInCall,
  isMuted,
  showTypeBadge,
  voiceMembers,
  onClick,
  onDoubleClick,
  onContextMenu,
  onMenuClick,
}: ChatListItemProps) {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const itemClass = css.roomItem;
  const prevUnreadRef = useRef<number | undefined>(undefined);
  const [bumping, setBumping] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const openMenuAt = useCallback(
    (x: number, y: number) => {
      onMenuClick?.(syntheticMouseEvent(x, y, rowRef.current));
    },
    [onMenuClick]
  );

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
        ref={rowRef}
        className={itemClass}
        data-active={isActive}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        role="button"
        tabIndex={0}
        aria-current={isActive ? 'page' : undefined}
        onKeyDown={(e) => {
          if (isMenuOpenKey(e)) {
            e.preventDefault();
            openMenuAt(0, 0);
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {/* Avatar with optional type badge */}
        <span className={css.avatarWrap}>
          <span className={css.chatAvatar}>
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
          {hasActiveCall && (
            <span className={css.callBadge} title={t('voice.joinCall')}>
              <PhoneIcon size={14} weight="fill" />
            </span>
          )}

          {isMuted && (
            <span className={css.mutedBadge} title={t('notifLevel.mute')}>
              <BellSlashIcon size={13} />
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
          <Tooltip content={t('common.menu')}>
            <button
              type="button"
              className={css.itemMenuButton}
              aria-label={t('common.menu')}
              onClick={onMenuClick}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </button>
          </Tooltip>
        )}
      </div>
      {/* Voice participants list: only mounted for rooms that actually have a voice room */}
      {hasVoiceRoom && !!voiceMembers && voiceMembers.length > 0 && (
        <RoomVoiceParticipants members={voiceMembers} roomId={roomId} />
      )}
    </div>
  );
}
