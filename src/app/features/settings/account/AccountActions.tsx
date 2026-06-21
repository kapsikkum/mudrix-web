import { useTranslation } from 'react-i18next';
import { logout } from '@/client/initMatrix';
import { Button } from '@/app/components/Button';
import * as css from '../Settings.css';

export function AccountActions() {
  const { t } = useTranslation();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <div className={css.divider} />

      <div className={css.section}>
        <Button variant="danger" onClick={handleLogout}>
          {t('settings.account.logout')}
        </Button>
      </div>
    </>
  );
}
