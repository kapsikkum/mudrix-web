import { useTranslation } from 'react-i18next';
import { SpinnerGapIcon, LaptopIcon, CheckIcon, WarningIcon } from '@phosphor-icons/react';
import * as css from './Sessions.css';

export interface DeviceEntry {
  deviceId: string;
  displayName: string;
  isCurrentDevice: boolean;
  isVerified: boolean | null;
}

interface DeviceCardProps {
  device: DeviceEntry;
  actionLoading: string | null;
  onVerify: (deviceId: string) => void;
  onRemove: (deviceId: string, displayName: string) => void;
}

export function DeviceCard({ device: d, actionLoading, onVerify, onRemove }: DeviceCardProps) {
  const { t } = useTranslation();

  return (
    <div className={d.isCurrentDevice ? css.deviceCardCurrent : css.deviceCard}>
      <div className={css.deviceIcon}>
        <LaptopIcon size={18} />
      </div>

      <div className={css.deviceInfo}>
        <div className={css.deviceName}>
          <span>{d.displayName}</span>
          {d.isCurrentDevice && (
            <span className={css.tagCurrent}>{t('settings.sessions.thisDevice')}</span>
          )}
        </div>
        <span className={css.deviceId}>{d.deviceId}</span>
      </div>

      {!d.isCurrentDevice &&
        (d.isVerified === true ? (
          <span className={css.tagVerified}>
            <CheckIcon size={12} />
            {t('settings.sessions.verified')}
          </span>
        ) : (
          <span className={css.tagUnverified}>
            <WarningIcon size={12} />
            {t('settings.sessions.unverified')}
          </span>
        ))}

      {!d.isCurrentDevice && (
        <div className={css.actions}>
          {d.isVerified === false && (
            <button
              type="button"
              className={css.verifyBtn}
              disabled={actionLoading !== null}
              onClick={() => onVerify(d.deviceId)}
            >
              {actionLoading === d.deviceId ? (
                <SpinnerGapIcon size={14} className="icon-spin" />
              ) : (
                t('settings.sessions.verify')
              )}
            </button>
          )}
          <button
            type="button"
            className={css.removeBtn}
            disabled={actionLoading !== null}
            onClick={() => onRemove(d.deviceId, d.displayName)}
          >
            {actionLoading === d.deviceId ? (
              <SpinnerGapIcon size={14} className="icon-spin" />
            ) : (
              t('settings.sessions.remove')
            )}
          </button>
        </div>
      )}
    </div>
  );
}
