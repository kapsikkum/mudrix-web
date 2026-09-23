import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { WarningIcon, ShieldCheckIcon, KeyIcon } from '@phosphor-icons/react';
import { pendingCryptoPromptAtom } from '@/app/store/atoms';
import { settingsOpenAtom, settingsPageAtom } from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import * as css from './ExistingEncryptionModal.css';

interface Props {
  onVerify: () => void;
}

export function ExistingEncryptionModal({ onVerify }: Props) {
  const { t } = useTranslation();
  const [pendingPrompt, setPendingPrompt] = useAtom(pendingCryptoPromptAtom);
  const [, setSettingsOpen] = useAtom(settingsOpenAtom);
  const [, setSettingsPage] = useAtom(settingsPageAtom);

  const close = () => setPendingPrompt(null);

  const handleVerify = () => {
    close();
    onVerify();
  };

  const handleRecoveryOptions = () => {
    close();
    setSettingsPage('sessions');
    setSettingsOpen(true);
  };

  return (
    <Modal
      open={pendingPrompt === 'existing'}
      onClose={close}
      title={t('crypto.existingEncryptionTitle')}
      size="md"
      zIndex={8500}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={close}>
            {t('verification.notNow')}
          </Button>
          <Button variant="primary" size="md" onClick={handleRecoveryOptions}>
            <KeyIcon size={16} />
            {t('crypto.recoveryOptions')}
          </Button>
          <Button variant="success" size="md" onClick={handleVerify}>
            <ShieldCheckIcon size={16} />
            {t('verification.verifyThisDevice')}
          </Button>
        </>
      }
    >
      <div className={css.notice}>
        <WarningIcon size={16} className={css.noticeIcon} />
        <p className={css.noticeText}>{t('crypto.existingEncryptionBody')}</p>
      </div>
    </Modal>
  );
}
