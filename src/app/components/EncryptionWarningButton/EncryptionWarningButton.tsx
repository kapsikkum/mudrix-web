import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { WarningIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { encryptionSetupWarningAtom, settingsOpenAtom, settingsPageAtom } from '@/app/store/atoms';
import * as css from './EncryptionWarningButton.css';

export function EncryptionWarningButton() {
  const { t } = useTranslation();
  const needsAttention = useAtomValue(encryptionSetupWarningAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);

  if (!needsAttention) return null;

  const handleClick = () => {
    setSettingsPage('sessions');
    setSettingsOpen(true);
  };

  return (
    <Tooltip placement="bottom" content={t('settings.keyBackup.setupIncomplete')}>
      <button
        type="button"
        className={css.button}
        onClick={handleClick}
        aria-label={t('settings.keyBackup.setupIncomplete')}
      >
        <WarningIcon size={18} weight="regular" />
      </button>
    </Tooltip>
  );
}
