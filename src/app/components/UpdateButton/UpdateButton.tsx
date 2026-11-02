import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import { ArrowClockwiseIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { updateAvailableAtom } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
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
  const toast = useToast();
  const [desktopUpdate, setDesktopUpdate] = useState<DesktopUpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    return onDesktopUpdate(setDesktopUpdate);
  }, []);

  if (!desktopUpdate && !updateAvailable) return null;

  const handleUpdate = async () => {
    if (desktopUpdate?.kind === 'available') {
      openExternalUrl(desktopUpdate.url);
      setDesktopUpdate(null);
    } else if (desktopUpdate?.kind === 'ready') {
      // Installing restarts the app, so the button stays busy until then; only a failure comes back.
      setInstalling(true);
      if (!(await installDesktopUpdate())) {
        setInstalling(false);
        toast.error(t('update.installFailed'));
      }
    } else {
      window.location.reload();
    }
  };

  let label = desktopUpdate
    ? t('update.desktopAvailable', { version: desktopUpdate.version })
    : t('update.action');
  if (installing) label = t('update.installing');

  return (
    <Tooltip placement="bottom" content={label}>
      <button
        type="button"
        className={css.button}
        onClick={handleUpdate}
        aria-label={label}
        disabled={installing}
      >
        {installing ? (
          <ArrowClockwiseIcon size={18} weight="bold" className={css.spinning} />
        ) : (
          <DownloadSimpleIcon size={18} weight="bold" />
        )}
      </button>
    </Tooltip>
  );
}
