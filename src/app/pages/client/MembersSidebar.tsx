import { useTranslation } from 'react-i18next';
import { MembersList } from '@/app/features/room';
import * as css from './MembersSidebar.css';

interface MembersSidebarProps {
  spaceId?: string | null;
  className?: string;
}

export function MembersSidebar({ spaceId, className }: MembersSidebarProps = {}) {
  const { t } = useTranslation();

  return (
    <aside className={`${css.membersSidebar}${className ? ` ${className}` : ''}`}>
      <div className={css.membersSidebarTitle}>{t('common.members')}</div>
      <div className={css.membersList}>
        <MembersList roomId={spaceId} />
      </div>
    </aside>
  );
}
