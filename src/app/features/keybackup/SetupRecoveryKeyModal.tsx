import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { KeyIcon } from '@phosphor-icons/react';
import {
  settingsOpenAtom,
  settingsPageAtom,
  setupRecoveryKeyModalOpenAtom,
  autoSetupTriggerAtom,
} from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import * as css from './SetupRecoveryKeyModal.css';

export function SetupRecoveryKeyModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(setupRecoveryKeyModalOpenAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);
  const setAutoTrigger = useSetAtom(autoSetupTriggerAtom);

  const close = () => setOpen(false);

  const goToSettings = () => {
    setAutoTrigger(true);
    setSettingsPage('keybackup');
    setSettingsOpen(true);
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t('settings.keyBackup.setupPromptTitle')}
      size="sm"
      zIndex={8500}
      footer={
        <div className={css.footerButtons}>
          <Button variant="ghost" size="md" onClick={close}>
            {t('settings.keyBackup.setupPromptSkip')}
          </Button>
          <Button variant="primary" size="md" onClick={goToSettings}>
            {t('settings.keyBackup.setupPromptTitle')}
          </Button>
        </div>
      }
    >
      <div className={css.body}>
        <KeyIcon size={32} className={css.icon} />
        <p className={css.text}>{t('settings.keyBackup.setupPromptBody')}</p>
      </div>
    </Modal>
  );
}
