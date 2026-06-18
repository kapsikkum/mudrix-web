import { useTranslation } from 'react-i18next';
import { ListIcon } from '@phosphor-icons/react';
import { useAtom } from 'jotai';
import { mobileDrawerOpenAtom } from '@/app/store/atoms';
import * as css from './MobileHeader.css';

export function MobileHeader() {
  const { t } = useTranslation();
  const [, setDrawerOpen] = useAtom(mobileDrawerOpenAtom);

  return (
    <div className={css.mobileHeader}>
      <button
        type="button"
        className={css.mobileMenuBtn}
        onClick={() => setDrawerOpen(true)}
        aria-label={t('common.menu')}
      >
        <ListIcon size={20} />
      </button>
      <span className={css.mobileHeaderTitle}>WizardChat</span>
      <span className={css.spacer} />
    </div>
  );
}
