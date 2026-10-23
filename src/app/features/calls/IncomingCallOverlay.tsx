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
    <div
      className={css.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-note"
    >
      <div className={css.ringIdentity}>
        <div className={css.ringAvatar}>
          <Avatar
            name={callerName}
            mxcUrl={avatarMxc}
            client={client}
            size="fill"
            placeholder="logo"
          />
        </div>
        <div id="incoming-call-title" className={css.ringName}>
          {callerName}
        </div>
        <div id="incoming-call-note" className={css.ringNote}>
          {t('voice.isCallingYou')}
        </div>
      </div>
      <div className={css.actions}>
        <div className={css.action}>
          <button
            type="button"
            className={css.btnDecline}
            onClick={onDecline}
            aria-label={t('voice.decline')}
          >
            <PhoneIcon size={24} weight="fill" className={css.iconRotated} />
          </button>
          <span aria-hidden="true">{t('voice.declineShort')}</span>
        </div>
        <div className={css.action}>
          <button
            type="button"
            className={css.btnAccept}
            onClick={onAccept}
            aria-label={t('voice.accept')}
          >
            <PhoneIcon size={24} weight="fill" />
          </button>
          <span aria-hidden="true">{t('voice.pickUp')}</span>
        </div>
      </div>
    </div>
  );
}
