import { useTranslation } from 'react-i18next';
import { EventType } from 'matrix-js-sdk';
import type { MatrixEvent } from 'matrix-js-sdk';
import { PhoneIcon, PhoneDisconnectIcon } from '@phosphor-icons/react';
import { formatTime } from '@/util/format';
import * as css from '../Timeline.css';

interface CallEventProps {
  event: MatrixEvent;
  senderName: string;
}

export function CallEventDisplay({ event, senderName }: CallEventProps) {
  const { t, i18n } = useTranslation();

  const type = event.getType();
  const content = event.getContent() as Record<string, unknown>;
  const ts = event.getTs();

  if (type === EventType.GroupCallMemberPrefix) {
    const callJoined = Boolean(content.application);

    const label = callJoined
      ? t('timeline.callJoined', { name: senderName })
      : t('timeline.callLeft', { name: senderName });

    return (
      <div className={css.systemMsgRow}>
        <span className={css.systemMsgIcon}>
          {callJoined ? <PhoneIcon size={13} /> : <PhoneDisconnectIcon size={13} />}
        </span>
        <span className={css.systemMsgText}>
          {label} | {formatTime(ts, i18n.language)}
        </span>
      </div>
    );
  }

  return null;
}
