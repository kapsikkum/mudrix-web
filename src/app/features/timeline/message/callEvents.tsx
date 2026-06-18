import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  PhoneDisconnectIcon,
  PhoneXIcon,
  ArrowFatLeftIcon,
  ArrowFatRightIcon,
} from '@phosphor-icons/react';
import { formatTime } from '@/util/format';
import * as css from '../Timeline.css';

interface CallEventProps {
  event: MatrixEvent;
  senderName: string;
  client: MatrixClient;
}

function computeDurationLabel(
  durationSec: number,
  t: (key: string, opts?: Record<string, unknown>) => string
): string {
  if (durationSec >= 3600) {
    const h = Math.floor(durationSec / 3600);
    const m = Math.floor((durationSec % 3600) / 60);
    const s = durationSec % 60;
    return t('timeline.durationHours', { h, m, s });
  }
  if (durationSec >= 60) {
    const m = Math.floor(durationSec / 60);
    const s = durationSec % 60;
    return t('timeline.durationMinutes', { m, s });
  }
  return t('timeline.durationSeconds', { durationSec });
}

export function CallEventDisplay({ event, senderName, client }: CallEventProps) {
  const { t, i18n } = useTranslation();

  const type = event.getType();
  const content = event.getContent() as Record<string, unknown>;
  const callId = content.call_id as string | undefined;
  const ts = event.getTs();
  const isOwner = event.getSender() === client.getUserId();

  if (type === 'm.call.invite') {
    const offerSdp = (content.offer as Record<string, unknown> | undefined)?.sdp as
      | string
      | undefined;
    const isVideo = offerSdp?.includes('m=video') ?? false;
    const label = isOwner
      ? t(isVideo ? 'timeline.callOutgoingVideo' : 'timeline.callOutgoing', { name: senderName })
      : t(isVideo ? 'timeline.callIncomingVideo' : 'timeline.callIncoming', { name: senderName });

    return (
      <div className={css.systemMsgRow}>
        <span className={css.systemMsgIcon}>
          {isOwner ? <ArrowFatRightIcon size={13} /> : <ArrowFatLeftIcon size={13} />}
        </span>
        <span className={css.systemMsgText}>
          {label} | {formatTime(ts, i18n.language)}
        </span>
      </div>
    );
  }

  if (type === 'm.call.hangup') {
    const reason = content.reason as string | undefined;
    const isMissed = reason === 'invite_timeout' || reason === 'ice_failed';

    let durationLabel = '';
    if (!isMissed && callId) {
      const room = client.getRoom(event.getRoomId() ?? '');
      if (room) {
        const inviteEvent = room
          .getLiveTimeline()
          .getEvents()
          .find(
            (e) =>
              e.getType() === 'm.call.invite' &&
              (e.getContent() as Record<string, unknown>).call_id === callId
          );
        if (inviteEvent) {
          const durationSec = Math.round((ts - inviteEvent.getTs()) / 1000);
          durationLabel = computeDurationLabel(durationSec, t);
        }
      }
    }

    const label = isMissed
      ? t('timeline.callMissed', { name: senderName })
      : t('timeline.callEnded');

    return (
      <div className={css.systemMsgRow}>
        <span className={isMissed ? css.callEventIconMissed : css.systemMsgIcon}>
          {isMissed ? <PhoneXIcon size={13} /> : <PhoneDisconnectIcon size={13} />}
        </span>
        <span className={css.systemMsgText}>
          {label}
          {' | '}
          {formatTime(ts, i18n.language)}
          {durationLabel && <> | {durationLabel}</>}
        </span>
      </div>
    );
  }

  return null;
}
