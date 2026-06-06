import { useTranslation } from 'react-i18next';
import { MembersList } from '@/app/features/room';
import * as css from './MembersSidebar.css';

interface MembersSidebarProps {
  spaceId?: string | null;
}

export function MembersSidebar({ spaceId }: MembersSidebarProps = {}) {
  const { t } = useTranslation();

  return (
    <aside className={css.membersSidebar}>
      <div className={css.membersSidebarTitle}>{t('common.members')}</div>
      <div className={css.membersList}>
        <MembersList roomId={spaceId} />
      </div>
    </aside>
  );
}
