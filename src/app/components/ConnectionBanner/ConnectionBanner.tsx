import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react';
import { connectionBannerAtom, syncStateAtom } from '@/app/store/atoms';
import { useTranslation } from 'react-i18next';
import * as css from './ConnectionBanner.css';

export function ConnectionBanner() {
  const { t } = useTranslation();
  const syncState = useAtomValue(syncStateAtom);
  const [banner, setBanner] = useAtom(connectionBannerAtom);
  const wasDisconnectedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (syncState === 'ERROR' || syncState === 'STOPPED') {
      wasDisconnectedRef.current = true;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setBanner({ visible: true, reconnected: false });
    } else if (syncState === 'PREPARED' || syncState === 'SYNCING' || syncState === 'CATCHUP') {
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        setBanner({ visible: true, reconnected: true });
        hideTimerRef.current = setTimeout(() => {
          setBanner({ visible: false, reconnected: false });
        }, 3000);
      }
    }
  }, [syncState, setBanner]);

  useEffect(() => {
    const handleOffline = () => {
      wasDisconnectedRef.current = true;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setBanner({ visible: true, reconnected: false });
    };
    const handleOnline = () => {
      if (wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        setBanner({ visible: true, reconnected: true });
        hideTimerRef.current = setTimeout(() => {
          setBanner({ visible: false, reconnected: false });
        }, 3000);
      }
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [setBanner]);

  if (!banner.visible) return null;

  const handleDismiss = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setBanner({ visible: false, reconnected: false });
  };

  return (
    <div
      className={banner.reconnected ? css.bannerReconnected : css.banner}
      role="status"
      aria-live="polite"
    >
      {banner.reconnected ? <CheckCircleIcon size={16} /> : <WarningCircleIcon size={16} />}
      <span>{banner.reconnected ? t('banner.reconnected') : t('banner.connectionLost')}</span>
      <button
        type="button"
        onClick={handleDismiss}
        className={css.dismissButton}
        aria-label={t('common.dismiss')}
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}
