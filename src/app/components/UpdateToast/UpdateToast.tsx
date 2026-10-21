import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import { updateAvailableAtom, updateDeferredUntilAtom } from '@/app/store/atoms';
import {
  installDesktopUpdate,
  onDesktopUpdate,
  openExternalUrl,
  type DesktopUpdateInfo,
} from '@/util/desktop';
import * as css from './UpdateToast.css';

const DEFER_MS = 24 * 60 * 60 * 1000; // 24 hours

export function UpdateToast() {
  const { t } = useTranslation();
  const [updateAvailable, setUpdateAvailable] = useAtom(updateAvailableAtom);
  const [deferredUntil, setDeferredUntil] = useAtom(updateDeferredUntilAtom);
  const [electronUpdateReady, setElectronUpdateReady] = useState(false);
  const [desktopUpdate, setDesktopUpdate] = useState<DesktopUpdateInfo | null>(null);

  useEffect(() => {
    window.electronAPI?.onUpdateDownloaded?.(() => setElectronUpdateReady(true));
    return onDesktopUpdate(setDesktopUpdate);
  }, []);

  const desktopVisible = desktopUpdate !== null && Date.now() >= deferredUntil;
  const show =
    electronUpdateReady || desktopVisible || (updateAvailable && Date.now() >= deferredUntil);
  if (!show) return null;

  const handleUpdate = () => {
    if (desktopUpdate?.kind === 'available') {
      openExternalUrl(desktopUpdate.url);
      setDesktopUpdate(null);
    } else if (desktopUpdate?.kind === 'ready') {
      installDesktopUpdate();
    } else if (electronUpdateReady) {
      window.electronAPI?.installUpdate?.();
      installDesktopUpdate();
    } else {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setElectronUpdateReady(false);
    setDesktopUpdate(null);
    setDeferredUntil(Date.now() + DEFER_MS);
    setUpdateAvailable(false);
  };

  return (
    <div className={css.toast} role="status" aria-live="polite">
      <ArrowClockwiseIcon size={18} className={css.icon} />
      <span>
        {desktopUpdate
          ? t('update.desktopAvailable', { version: desktopUpdate.version })
          : t('update.available')}
      </span>
      <div className={css.actions}>
        <button type="button" className={css.btnPrimary} onClick={handleUpdate}>
          {desktopUpdate?.kind === 'available' ? t('update.download') : t('update.updateNow')}
        </button>
        <button type="button" className={css.btnSecondary} onClick={handleDismiss}>
          {t('update.dismiss')}
        </button>
      </div>
    </div>
  );
}
