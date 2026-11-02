import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { saveBlob } from '@/util/download';
import { useToast } from '@/app/hooks/useToast';
import {
  WarningCircleIcon,
  WarningIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
} from '@phosphor-icons/react';
import { recoveryKeyModalAtom } from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { Sensitive } from '@/app/components/Sensitive';
import * as css from './RecoveryKeyModal.css';
import { zIndex } from '@/theme/zIndex';

export function RecoveryKeyModal() {
  const [state, setState] = useAtom(recoveryKeyModalAtom);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const { t } = useTranslation();
  const toast = useToast();

  const close = () => {
    setState({ open: false, recoveryKey: '', isRegenerating: false });
    setCopied(false);
    setSaved(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.recoveryKey);
      setCopied(true);
      setSaved(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked — user can select and copy manually
    }
  };

  const handleDownload = async () => {
    try {
      const blob = new Blob([state.recoveryKey], { type: 'text/plain' });
      const path = await saveBlob(blob, 'mudrix-recovery-key.txt');
      if (path !== null) toast.success(t('common.downloadSaved', { path }));
      setSaved(true);
    } catch {
      toast.error(t('common.downloadFailed'));
    }
  };

  const isRegenerating = state.isRegenerating === true;

  return (
    <Modal
      open={state.open}
      onClose={undefined} // No accidental dismiss — user MUST save the key first
      title={
        isRegenerating
          ? t('settings.keyBackup.newRecoveryKeyGenerated')
          : t('settings.keyBackup.yourRecoveryKey')
      }
      size="md"
      zIndex={zIndex.alert}
      footer={
        <Button variant="primary" size="md" disabled={!saved} onClick={close}>
          {t('settings.keyBackup.savedConfirmButton')}
        </Button>
      }
    >
      {/* Top banner: danger for regenerate, warning for fresh setup */}
      {isRegenerating ? (
        <div className={css.alertDanger}>
          <WarningCircleIcon size={16} className={css.alertIcon} />
          <span>
            <strong>{t('settings.keyBackup.oldKeyInvalid')}</strong>{' '}
            {t('settings.keyBackup.oldKeyWarningBody')}
          </span>
        </div>
      ) : (
        <div className={css.alertWarning}>
          <WarningIcon size={16} className={css.alertIcon} />
          <span>{t('settings.keyBackup.storeKeyWarning')}</span>
        </div>
      )}

      {/* Key display + copy + download */}
      <div className={css.keyBox}>
        <span className={css.keyText}>
          <Sensitive>{state.recoveryKey}</Sensitive>
        </span>
        <div className={css.keyActions}>
          <button type="button" className={css.copyBtn} onClick={handleCopy}>
            {copied ? (
              <>
                <CheckIcon size={14} /> {t('settings.keyBackup.copied')}
              </>
            ) : (
              <>
                <CopyIcon size={14} /> {t('settings.keyBackup.copyKey')}
              </>
            )}
          </button>
          <button type="button" className={css.downloadBtn} onClick={handleDownload}>
            <DownloadSimpleIcon size={14} /> {t('settings.keyBackup.downloadKey')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
