import { useTranslation } from 'react-i18next';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { CopyButton } from '@/app/components/Button';
import * as css from '../Settings.css';

export function MatrixId() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();

  const userId = client?.getUserId();
  if (!userId) return null;

  return (
    <div className={css.settingRowColumn}>
      <span className={css.settingLabel}>{t('settings.account.username')}</span>
      <div className={css.tokenRow}>
        <code className={css.tokenField}>{userId}</code>
        <CopyButton text={userId} />
      </div>
    </div>
  );
}
