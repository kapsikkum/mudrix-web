import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ListIcon, UsersIcon, ChatDotsIcon } from '@phosphor-icons/react';
import { useAtom, useSetAtom } from 'jotai';
import {
  mobileDrawerOpenAtom,
  membersPanelOpenAtom,
  threadsPanelViewAtom,
} from '@/app/store/atoms';
import * as css from './MobileHeader.css';

export function MobileHeader() {
  const { t } = useTranslation();
  const [, setDrawerOpen] = useAtom(mobileDrawerOpenAtom);
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);
  const setThreadsPanelView = useSetAtom(threadsPanelViewAtom);
  const location = useLocation();
  const inRoomView = !!location.pathname.match(/^\/(?:r|dm)\//);

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
      {inRoomView && (
        <div className={css.mobileActions}>
          <button
            type="button"
            className={css.mobileActionBtn}
            onClick={() => setThreadsPanelView((prev) => (prev ? null : { type: 'list' }))}
            aria-label={t('timeline.threads')}
          >
            <ChatDotsIcon size={16} />
          </button>
          <button
            type="button"
            className={css.mobileActionBtn}
            onClick={() => toggleMembersPanel((v) => !v)}
            aria-label={t('common.members')}
          >
            <UsersIcon size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
