import { useTranslation } from 'react-i18next';
import { PhoneIcon } from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import type { MatrixClient } from 'matrix-js-sdk';
import * as css from './IncomingCallOverlay.css';

interface Props {
  callerName: string;
  callerId: string;
  client: MatrixClient;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallOverlay({ callerName, callerId, client, onAccept, onDecline }: Props) {
  const { t } = useTranslation();
  const user = client.getUser(callerId);
  const avatarMxc = user?.avatarUrl ?? null;

  return (
    <div className={css.overlay}>
      <div className={css.header}>
        <PhoneIcon size={16} />
        <span>{t('voice.incomingCall')}</span>
      </div>
      <div className={css.callerRow}>
        <Avatar name={callerName} mxcUrl={avatarMxc} client={client} size="md" />
        <div>
          <div className={css.callerName}>{callerName}</div>
          <div className={css.callerNote}>{t('voice.calling')}</div>
        </div>
      </div>
      <div className={css.actions}>
        <button className={css.btnDecline} onClick={onDecline}>
          <PhoneIcon size={20} className={css.iconRotated} />
        </button>
        <button className={css.btnAccept} onClick={onAccept}>
          <PhoneIcon size={20} />
        </button>
      </div>
    </div>
  );
}
