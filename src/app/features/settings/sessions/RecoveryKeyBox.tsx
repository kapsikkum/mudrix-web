import { useTranslation } from 'react-i18next';
import { KeyIcon, LockOpenIcon } from '@phosphor-icons/react';
import { Button } from '@/app/components/Button';
import * as css from './Sessions.css';

interface RecoveryKeyBoxProps {
  mode: 'none' | 'available';
  onSetup?: () => void;
  onRestore?: () => void;
  loading?: boolean;
}

export function RecoveryKeyBox({ mode, onSetup, onRestore, loading = false }: RecoveryKeyBoxProps) {
  const { t } = useTranslation();

  if (mode === 'none') {
    return (
      <div className={css.recoveryKeyBox}>
        <Button variant="primary" size="sm" onClick={onSetup} disabled={loading}>
          <KeyIcon size={14} />
          {t('settings.keyBackup.setupRecoveryKey')}
        </Button>
      </div>
    );
  }

  return (
    <div className={css.recoveryKeyBox}>
      <p className={css.recoveryKeyHint}>{t('settings.keyBackup.autoPromptBanner')}</p>
      <Button variant="primary" size="sm" onClick={onRestore} disabled={loading}>
        <LockOpenIcon size={14} />
        {t('settings.keyBackup.enterRecoveryKeyBtn')}
      </Button>
    </div>
  );
}
