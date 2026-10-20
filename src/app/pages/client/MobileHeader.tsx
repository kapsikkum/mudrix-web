import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ListIcon, UsersIcon, ChatDotsIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  mobileDrawerOpenAtom,
  membersPanelOpenAtom,
  threadsPanelViewAtom,
  currentRoomIdAtom,
} from '@/app/store/atoms';
import { useHasUnreadThreads } from '@/app/hooks/useHasUnreadThreads';
import * as css from './MobileHeader.css';

export function MobileHeader() {
  const { t } = useTranslation();
  const [, setDrawerOpen] = useAtom(mobileDrawerOpenAtom);
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);
  const setThreadsPanelView = useSetAtom(threadsPanelViewAtom);
  const membersPanelOpen = useAtomValue(membersPanelOpenAtom);
  const threadsPanelView = useAtomValue(threadsPanelViewAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);
  const location = useLocation();
  const inRoomView = !!location.pathname.match(/^\/(?:r|dm)\//);
  const hasUnreadThreads = useHasUnreadThreads(inRoomView ? currentRoomId : null);

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
      <span className={css.mobileHeaderTitle}>Mudrix</span>
      {inRoomView && (
        <div className={css.mobileActions}>
          <button
            type="button"
            className={threadsPanelView ? css.mobileActionBtnActive : css.mobileActionBtn}
            onClick={() => setThreadsPanelView((prev) => (prev ? null : { type: 'list' }))}
            aria-label={t('timeline.threads')}
          >
            <span className={css.mobileThreadIconWrap}>
              <ChatDotsIcon size={16} weight={threadsPanelView ? 'fill' : 'regular'} />
              {hasUnreadThreads && <span className={css.mobileThreadDot} />}
            </span>
          </button>
          <button
            type="button"
            className={membersPanelOpen ? css.mobileActionBtnActive : css.mobileActionBtn}
            onClick={() => toggleMembersPanel((v) => !v)}
            aria-label={t('common.members')}
          >
            <UsersIcon size={16} weight={membersPanelOpen ? 'fill' : 'regular'} />
          </button>
        </div>
      )}
    </div>
  );
}
