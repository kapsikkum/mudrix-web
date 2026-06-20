import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Avatar } from '@/app/components/Avatar';
import * as css from './RoomPreviewBar.css';

interface Props {
  client: MatrixClient;
  roomId: string;
  roomName: string;
  roomAvatarMxc: string | null;
  inviterUserId: string | null;
  inviterDisplayName: string | null;
  onAccepted: () => void;
  onDeclined: () => void;
}

export function RoomPreviewBar({
  client,
  roomId,
  roomName,
  roomAvatarMxc,
  inviterUserId,
  inviterDisplayName,
  onAccepted,
  onDeclined,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  // Inviter avatar mxc — look up from the Matrix user object
  const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
  const inviterAvatarMxc = inviterUser?.avatarUrl ?? null;
  const inviterLabel = inviterDisplayName ?? inviterUserId ?? t('invite.unknownInviter');

  const handleAccept = useCallback(async () => {
    setLoading(true);
    try {
      await client.joinRoom(roomId);
      onAccepted();
    } catch (err) {
      toast.error(t('invite.acceptFailed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  }, [client, roomId, onAccepted, toast, t]);

  const handleDecline = useCallback(async () => {
    setLoading(true);
    try {
      await client.leave(roomId);
      toast.info(t('invite.declined', { name: roomName }));
      onDeclined();
    } catch (err) {
      toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  }, [client, roomId, roomName, onDeclined, toast, t]);

  return (
    <div className={css.bar}>
      {/* Room avatar */}
      <Avatar name={roomName} mxcUrl={roomAvatarMxc} client={client} size="md" />

      {/* Info: room name + "Invited by …" */}
      <div className={css.info}>
        <span className={css.roomName}>{roomName}</span>
        {inviterUserId && (
          <span className={css.invitedBy}>
            <Avatar name={inviterLabel} mxcUrl={inviterAvatarMxc} client={client} size="xs" />
            <span className={css.inviterName}>{t('invite.invitedBy', { name: inviterLabel })}</span>
          </span>
        )}
      </div>

      {/* Accept / Decline */}
      <div className={css.actions}>
        <button type="button" className={css.declineBtn} onClick={handleDecline} disabled={loading}>
          {t('invite.decline')}
        </button>
        <button type="button" className={css.acceptBtn} onClick={handleAccept} disabled={loading}>
          {t('invite.accept')}
        </button>
      </div>
    </div>
  );
}
