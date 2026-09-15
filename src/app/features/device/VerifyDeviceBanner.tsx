import { useTranslation } from 'react-i18next';
import { ShieldWarningIcon } from '@phosphor-icons/react';
import * as css from './VerifyDeviceBanner.css';

interface VerifyDeviceBannerProps {
  onVerify: () => void;
  onDismiss: () => void;
}

export function VerifyDeviceBanner({ onVerify, onDismiss }: VerifyDeviceBannerProps) {
  const { t } = useTranslation();

  return (
    <div className={css.banner}>
      <div className={css.icon}>
        <ShieldWarningIcon size={18} />
      </div>
      <div className={css.body}>
        <strong className={css.title}>{t('verification.verifyThisDevice')}</strong>
        <span className={css.text}>{t('verification.verifyThisDeviceBody')}</span>
        <div className={css.actions}>
          <button type="button" className={css.btnNotNow} onClick={onDismiss}>
            {t('verification.notNow')}
          </button>
          <button type="button" className={css.btnVerify} onClick={onVerify}>
            {t('verification.verifyNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
