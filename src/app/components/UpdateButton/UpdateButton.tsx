import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { updateAvailableAtom } from '@/app/store/atoms';
import {
  installDesktopUpdate,
  onDesktopUpdate,
  openExternalUrl,
  type DesktopUpdateInfo,
} from '@/util/desktop';
import * as css from './UpdateButton.css';

export function UpdateButton() {
  const { t } = useTranslation();
  const updateAvailable = useAtomValue(updateAvailableAtom);
  const [electronUpdateReady, setElectronUpdateReady] = useState(false);
  const [desktopUpdate, setDesktopUpdate] = useState<DesktopUpdateInfo | null>(null);

  useEffect(() => {
    window.electronAPI?.onUpdateDownloaded?.(() => setElectronUpdateReady(true));
    return onDesktopUpdate(setDesktopUpdate);
  }, []);

  if (!electronUpdateReady && !desktopUpdate && !updateAvailable) return null;

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

  const label = desktopUpdate
    ? t('update.desktopAvailable', { version: desktopUpdate.version })
    : t('update.action');

  return (
    <Tooltip placement="bottom" content={label}>
      <button type="button" className={css.button} onClick={handleUpdate} aria-label={label}>
        <DownloadSimpleIcon size={18} weight="bold" />
      </button>
    </Tooltip>
  );
}
