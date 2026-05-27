import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { PhoneIcon, PhoneDisconnectIcon, PhoneXIcon } from '@phosphor-icons/react';
import { formatTime } from '@/util/format';
import * as css from '../Timeline.css';

interface CallEventProps {
  event: MatrixEvent;
  senderName: string;
  client: MatrixClient;
}

export function CallEventDisplay({ event, senderName, client }: CallEventProps) {
  const { t, i18n } = useTranslation();

  const type = event.getType();
  const content = event.getContent() as Record<string, unknown>;
  const callId = content.call_id as string | undefined;
  const ts = event.getTs();
  const isOwner = event.getSender() === client.getUserId();

  if (type === 'm.call.invite') {
    // Detect video vs voice from the SDP offer
    const offerSdp = (content.offer as Record<string, unknown> | undefined)?.sdp as
      | string
      | undefined;
    const isVideo = offerSdp?.includes('m=video') ?? false;
    const label = isOwner
      ? t(isVideo ? 'timeline.callOutgoingVideo' : 'timeline.callOutgoing', { name: senderName })
      : t(isVideo ? 'timeline.callIncomingVideo' : 'timeline.callIncoming', { name: senderName });

    return (
      <div className={css.callEventRow}>
        <div className={css.callEventIcon}>
          <PhoneIcon size={15} weight="fill" />
        </div>
        <div className={css.callEventBody}>
          <span className={css.callEventLabel}>{label}</span>
          <span className={css.callEventMeta}>{formatTime(ts, i18n.language)}</span>
        </div>
      </div>
    );
  }

  if (type === 'm.call.hangup') {
    // Determine if this was a missed call (no answer) or a completed call
    const reason = content.reason as string | undefined;
    const isMissed = reason === 'invite_timeout' || reason === 'ice_failed';

    // Calculate duration by finding the matching invite event in the room timeline
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
          if (durationSec >= 3600) {
            const h = Math.floor(durationSec / 3600);
            const m = Math.floor((durationSec % 3600) / 60);
            const s = durationSec % 60;
            durationLabel = `${h}h ${m}m ${s}s`;
          } else if (durationSec >= 60) {
            const m = Math.floor(durationSec / 60);
            const s = durationSec % 60;
            durationLabel = `${m}m ${s}s`;
          } else {
            durationLabel = `${durationSec}s`;
          }
        }
      }
    }

    const label = isMissed
      ? t('timeline.callMissed', { name: senderName })
      : t('timeline.callEnded');

    return (
      <div className={isMissed ? css.callEventRowMissed : css.callEventRow}>
        <div className={isMissed ? css.callEventIconMissed : css.callEventIcon}>
          {isMissed ? (
            <PhoneXIcon size={15} weight="fill" />
          ) : (
            <PhoneDisconnectIcon size={15} weight="fill" />
          )}
        </div>
        <div className={css.callEventBody}>
          <span className={css.callEventLabel}>{label}</span>
          <span className={css.callEventMeta}>
            {formatTime(ts, i18n.language)}
            {durationLabel && <> · {durationLabel}</>}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
