import { useTranslation } from 'react-i18next';
import { MembersList } from '@/app/features/room';
import * as css from './MembersSidebar.css';

interface MembersSidebarProps {
  spaceId?: string | null;
  className?: string;
}

export function MembersSidebar({ spaceId, className }: MembersSidebarProps = {}) {
  const { t } = useTranslation();

  if (!spaceId) return null;

  return (
    <aside
      className={`${css.membersSidebar}${className ? ` ${className}` : ''}`}
      aria-label={t('common.members')}
    >
      <h2 className={css.membersSidebarTitle}>{t('common.members')}</h2>
      <div className={css.membersList}>
        <MembersList roomId={spaceId} />
      </div>
    </aside>
  );
}
