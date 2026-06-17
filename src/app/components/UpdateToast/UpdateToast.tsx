import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { ArrowClockwiseIcon } from '@phosphor-icons/react';
import { updateAvailableAtom, updateDeferredUntilAtom } from '@/app/store/atoms';
import * as css from './UpdateToast.css';

const DEFER_MS = 24 * 60 * 60 * 1000; // 24 hours

export function UpdateToast() {
  const { t } = useTranslation();
  const [updateAvailable, setUpdateAvailable] = useAtom(updateAvailableAtom);
  const [deferredUntil, setDeferredUntil] = useAtom(updateDeferredUntilAtom);

  // Hide if no update or user has deferred
  if (!updateAvailable || Date.now() < deferredUntil) return null;

  const handleUpdate = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
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
