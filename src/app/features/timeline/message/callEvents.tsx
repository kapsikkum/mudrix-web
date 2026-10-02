import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneDisconnectIcon, PhoneIcon } from '@phosphor-icons/react';
import type { MatrixClient } from 'matrix-js-sdk';
import { ReceiptAvatar } from './receiptAvatar';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import type { CallSessionSummary } from './callSessions';
import { formatDuration } from '@/util/format';
import * as css from '../Timeline.css';

interface CallSessionProps {
  session: CallSessionSummary;
  client: MatrixClient;
}

const MAX_VISIBLE_AVATARS = 3;
const TICK_MS = 1000;

export function CallSessionDisplay({ session, client }: CallSessionProps) {
  const { t } = useTranslation();

  const isOngoing = session.endTs === null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isOngoing) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [isOngoing]);

  const { participants } = session;
  const visible = participants.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = participants.length - visible.length;

  const duration = session.isPartial
    ? null
    : formatDuration((session.endTs ?? now) - session.startTs);

  return (
    <div className={[css.callPill, isOngoing ? css.callPillOngoing : css.callPillEnded].join(' ')}>
      <span className={css.callPillIcon}>
        {isOngoing ? <PhoneIcon size={13} weight="fill" /> : <PhoneDisconnectIcon size={13} />}
      </span>

      <span className={css.callPillLabel}>
        {isOngoing ? t('timeline.callOngoing') : t('timeline.callEnded')}
      </span>

      {visible.length > 0 && (
        <span className={css.callAvatarStack}>
          {visible.map((participant) => (
            <ReceiptAvatar
              key={participant.userId}
              client={client}
              user={
                {
                  userId: participant.userId,
                  displayName: participant.name,
                  avatarUrl: participant.mxcAvatar,
                  ts: participant.joinedTs,
                } satisfies ReceiptUser
              }
            />
          ))}
          {overflow > 0 && <span className={css.readReceiptOverflow}>+{overflow}</span>}
        </span>
      )}

      {duration !== null && <span className={css.callPillDuration}>{duration}</span>}
    </div>
  );
}
