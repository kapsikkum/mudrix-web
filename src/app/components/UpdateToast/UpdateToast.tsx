import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import { updateAvailableAtom, updateDeferredUntilAtom } from '@/app/store/atoms';
import * as css from './UpdateToast.css';

const DEFER_MS = 24 * 60 * 60 * 1000; // 24 hours

export function UpdateToast() {
  const { t } = useTranslation();
  const [updateAvailable, setUpdateAvailable] = useAtom(updateAvailableAtom);
  const [deferredUntil, setDeferredUntil] = useAtom(updateDeferredUntilAtom);
  const [electronUpdateReady, setElectronUpdateReady] = useState(false);

  useEffect(() => {
    window.electronAPI?.onUpdateDownloaded?.(() => setElectronUpdateReady(true));
  }, []);

  const show = electronUpdateReady || (updateAvailable && Date.now() >= deferredUntil);
  if (!show) return null;

  const handleUpdate = () => {
    if (electronUpdateReady) {
      window.electronAPI?.installUpdate?.();
    } else {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setElectronUpdateReady(false);
    setDeferredUntil(Date.now() + DEFER_MS);
    setUpdateAvailable(false);
  };

  return (
    <div className={css.toast} role="status" aria-live="polite">
      <ArrowClockwiseIcon size={18} className={css.icon} />
      <span>{t('update.available')}</span>
      <div className={css.actions}>
        <button type="button" className={css.btnPrimary} onClick={handleUpdate}>
          {t('update.updateNow')}
        </button>
        <button type="button" className={css.btnSecondary} onClick={handleDismiss}>
          {t('update.dismiss')}
        </button>
      </div>
    </div>
  );
}
