import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { MembersList } from '@/app/features/room';
import { Tooltip } from '@/app/components/Tooltip';
import * as css from './MembersSidebar.css';

interface MembersSidebarProps {
  spaceId?: string | null;
  className?: string;
  onClose?: () => void;
}

export function MembersSidebar({ spaceId, className, onClose }: MembersSidebarProps = {}) {
  const { t } = useTranslation();

  if (!spaceId) return null;

  return (
    <aside
      className={`${css.membersSidebar}${className ? ` ${className}` : ''}`}
      aria-label={t('common.members')}
    >
      <div className={css.membersSidebarHeader}>
        <h2 className={css.membersSidebarTitle}>{t('common.members')}</h2>
        {onClose && (
          <Tooltip content={t('common.close')}>
            <button
              type="button"
              className={css.membersSidebarClose}
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <XIcon size={16} />
            </button>
          </Tooltip>
        )}
      </div>
      <div className={css.membersList}>
        <MembersList roomId={spaceId} />
      </div>
    </aside>
  );
}
