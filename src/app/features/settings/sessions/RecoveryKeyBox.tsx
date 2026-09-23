import { useTranslation } from 'react-i18next';
import { LockOpenIcon } from '@phosphor-icons/react';
import { Button } from '@/app/components/Button';
import * as css from './Sessions.css';

interface RecoveryKeyBoxProps {
  onRestore: () => void;
  loading?: boolean;
}

export function RecoveryKeyBox({ onRestore, loading = false }: RecoveryKeyBoxProps) {
  const { t } = useTranslation();

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
