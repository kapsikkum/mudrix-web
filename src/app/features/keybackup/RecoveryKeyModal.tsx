import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { WarningCircleIcon, WarningIcon, CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { recoveryKeyModalAtom } from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { vars } from '@/theme/vars.css';
import * as css from './RecoveryKeyModal.css';

export function RecoveryKeyModal() {
  const [state, setState] = useAtom(recoveryKeyModalAtom);
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { t } = useTranslation();

  const close = () => {
    setState({ open: false, recoveryKey: '', isRegenerating: false });
    setCopied(false);
    setConfirmed(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API blocked — user can select and copy manually
    }
  };

  const isRegenerating = state.isRegenerating === true;

  return (
    <Modal
      open={state.open}
      onClose={() => {}} // No accidental dismiss — user MUST save the key first
      title={
        isRegenerating
          ? t('settings.keyBackup.newRecoveryKeyGenerated')
          : t('settings.keyBackup.yourRecoveryKey')
      }
      size="md"
      zIndex={8500}
      footer={
        <Button variant="primary" size="md" disabled={!confirmed} onClick={close}>
          {t('settings.keyBackup.savedConfirmButton')}
        </Button>
      }
    >
      {/* Top banner: danger for regenerate, warning for fresh setup */}
      {isRegenerating ? (
        <div className={css.alertDanger}>
          <WarningCircleIcon size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
          <span>
            <strong>{t('settings.keyBackup.oldKeyInvalid')}</strong>{' '}
            {t('settings.keyBackup.oldKeyWarningBody')}
          </span>
        </div>
      ) : (
        <div className={css.alertWarning}>
          <WarningIcon size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
          <span>{t('settings.keyBackup.storeKeyWarning')}</span>
        </div>
      )}

      <p className={css.hint}>
        {isRegenerating ? t('settings.keyBackup.newKeyHint') : t('settings.keyBackup.keyHint')}
      </p>

      {/* Key display + copy button */}
      <div className={css.keyBox}>
        <span className={css.keyText}>{state.recoveryKey}</span>
        <button className={css.copyBtn} onClick={handleCopy}>
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
      </div>

      {/* Confirmation checkbox */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
        />
        <span style={{ fontSize: '0.9rem', color: vars.color.textPrimary }}>
          {t('settings.keyBackup.savedRecoveryKey')}
        </span>
      </label>

      <p style={{ fontSize: '0.78rem', color: vars.color.textMuted, margin: 0, lineHeight: '1.4' }}>
        {t('settings.keyBackup.compatibleWithClients')}
      </p>
    </Modal>
  );
}
