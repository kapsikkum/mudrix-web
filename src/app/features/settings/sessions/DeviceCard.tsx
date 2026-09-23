import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SpinnerGapIcon,
  DevicesIcon,
  TrashIcon,
  DotsThreeVerticalIcon,
} from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { useContextMenu } from '@/app/hooks/useContextMenu';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
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
  belowRow?: ReactNode;
  menuItems?: ContextMenuItem[];
}

export function DeviceCard({
  device: d,
  actionLoading,
  onVerify,
  onRemove,
  belowRow,
  menuItems,
}: DeviceCardProps) {
  const { t } = useTranslation();
  const { openContextMenu } = useContextMenu();

  const handleMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (menuItems && menuItems.length > 0) openContextMenu(e, menuItems);
  };

  return (
    <div className={d.isCurrentDevice ? css.deviceCardCurrent : css.deviceCard}>
      <div className={css.deviceRow}>
        <div className={css.deviceIconWrap}>
          <div className={css.deviceIcon}>
            <DevicesIcon size={18} />
          </div>
          {d.isVerified === false ? (
            <span
              className={css.deviceDotUnverified}
              role="img"
              aria-label={t('settings.sessions.unverified')}
            />
          ) : d.isVerified === true ? (
            <span
              className={css.deviceDotVerified}
              role="img"
              aria-label={t('settings.sessions.verified')}
            />
          ) : null}
        </div>

        <div className={css.deviceInfo}>
          <div className={css.deviceName}>
            <span>{d.displayName}</span>
          </div>
          <span className={css.deviceId}>{d.deviceId}</span>
        </div>

        {menuItems && menuItems.length > 0 && (
          <Tooltip content={t('common.menu')}>
            <button
              type="button"
              className={css.deviceMenuBtn}
              aria-label={t('common.menu')}
              disabled={actionLoading !== null}
              onClick={handleMenu}
            >
              <DotsThreeVerticalIcon size={16} weight="bold" />
            </button>
          </Tooltip>
        )}

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
            <Tooltip content={t('settings.sessions.remove')}>
              <button
                type="button"
                className={css.removeBtn}
                aria-label={t('settings.sessions.remove')}
                disabled={actionLoading !== null}
                onClick={() => onRemove(d.deviceId, d.displayName)}
              >
                {actionLoading === d.deviceId ? (
                  <SpinnerGapIcon size={14} className="icon-spin" />
                ) : (
                  <TrashIcon size={14} />
                )}
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {belowRow}
    </div>
  );
}
