import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Avatar } from '@/app/components/Avatar';
import * as css from './RoomInvitePreview.css';

async function registerDmIfNeeded(client: MatrixClient, roomId: string): Promise<void> {
  const room = client.getRoom(roomId);
  if (!room) return;
  const inviter = room.getDMInviter?.();
  if (!inviter) return;
  const dmData =
    client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>() ?? {};
  const existing = dmData[inviter] ?? [];
  if (existing.includes(roomId)) return;
  await client.setAccountData(EventType.Direct, {
    ...dmData,
    [inviter]: [...existing, roomId],
  });
}

interface Props {
  client: MatrixClient;
  roomId: string;
  roomName: string;
  roomAvatarMxc: string | null;
  topic: string;
  memberCount: number;
  inviterUserId: string | null;
  inviterDisplayName: string | null;
  onAccepted: () => void;
  onDeclined: () => void;
}

export function RoomInvitePreview({
  client,
  roomId,
  roomName,
  roomAvatarMxc,
  topic,
  memberCount,
  inviterUserId,
  inviterDisplayName,
  onAccepted,
  onDeclined,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
  const inviterAvatarMxc = inviterUser?.avatarUrl ?? null;
  const inviterLabel = inviterDisplayName ?? inviterUserId ?? t('invite.unknownInviter');

  const handleAccept = useCallback(async () => {
    setLoading(true);
    try {
      await client.joinRoom(roomId);
      registerDmIfNeeded(client, roomId).catch(() => {});
      onAccepted();
    } catch (err) {
      setLoading(false);
      toast.error(t('invite.acceptFailed', { error: getErrorMessage(err) }));
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
    <div className={css.wrapper}>
      <div className={css.card}>
        <Avatar name={roomName} mxcUrl={roomAvatarMxc} client={client} size="xl" />

        <h2 className={css.roomName}>{roomName}</h2>

        {memberCount > 0 && (
          <p className={css.memberCount}>{t('invite.memberCount', { count: memberCount })}</p>
        )}

        {topic && <p className={css.topic}>{topic}</p>}

        {inviterUserId && (
          <div className={css.inviter}>
            <Avatar name={inviterLabel} mxcUrl={inviterAvatarMxc} client={client} size="xs" />
            <span>{t('invite.invitedBy', { name: inviterLabel })}</span>
          </div>
        )}

        <div className={css.actions}>
          <button
            type="button"
            className={css.declineBtn}
            onClick={handleDecline}
            disabled={loading}
          >
            {t('invite.decline')}
          </button>
          <button type="button" className={css.acceptBtn} onClick={handleAccept} disabled={loading}>
            {t('invite.accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
