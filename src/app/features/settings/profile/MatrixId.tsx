import { useTranslation } from 'react-i18next';
import { CopyIcon } from '@phosphor-icons/react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useToast } from '@/app/hooks/useToast';
import { IconButton } from '@/app/components/Button';
import * as css from '../Settings.css';

export function MatrixId() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  const userId = client?.getUserId();
  if (!userId) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(userId).then(() => toast.success(t('common.copied')));
  };

  return (
    <div className={css.settingRow}>
      <span className={css.settingLabel}>{t('settings.profile.matrixId')}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <code className={css.tokenField}>{userId}</code>
        <IconButton size="sm" onClick={handleCopy} title={t('common.copy')}>
          <CopyIcon size={14} />
        </IconButton>
      </div>
    </div>
  );
}
