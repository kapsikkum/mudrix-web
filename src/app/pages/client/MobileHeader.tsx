import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ListIcon, UsersIcon, ChatDotsIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  mobileDrawerOpenAtom,
  membersPanelOpenAtom,
  threadsPanelViewAtom,
  currentRoomIdAtom,
  globalSearchOpenAtom,
  roomSearchAtom,
} from '@/app/store/atoms';
import { useHasUnreadThreads } from '@/app/hooks/useHasUnreadThreads';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import { Inbox } from '@/app/features/inbox';
import { UpdateButton } from '@/app/components/UpdateButton/UpdateButton';
import { RoomSearchField } from '@/app/features/roomSearch';
import * as css from './MobileHeader.css';

export function MobileHeader() {
  const { t } = useTranslation();
  const [, setDrawerOpen] = useAtom(mobileDrawerOpenAtom);
  const toggleMembersPanel = useSetAtom(membersPanelOpenAtom);
  const setThreadsPanelView = useSetAtom(threadsPanelViewAtom);
  const membersPanelOpen = useAtomValue(membersPanelOpenAtom);
  const threadsPanelView = useAtomValue(threadsPanelViewAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);
  const openGlobalSearch = useSetAtom(globalSearchOpenAtom);
  const roomSearch = useAtomValue(roomSearchAtom);
  const location = useLocation();
  const inRoomView = !!location.pathname.match(/^\/(?:r|dm)\//);
  const hasUnreadThreads = useHasUnreadThreads(inRoomView ? currentRoomId : null);
  // Inbox and the search field share global state, so they only mount here on mobile
  const isMobile = useMediaQuery('(max-width: 768px)');
  const searchingRoom = isMobile && !!roomSearch && roomSearch.roomId === currentRoomId;

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
      {searchingRoom ? (
        <div className={css.mobileSearch}>
          <RoomSearchField />
        </div>
      ) : (
        <>
          <span className={css.mobileHeaderTitle}>WizardChat</span>
          <div className={css.mobileActions}>
            {inRoomView && (
              <>
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
              </>
            )}
            <button
              type="button"
              className={css.mobileActionBtn}
              onClick={() => openGlobalSearch(true)}
              aria-label={t('roomSwitcher.title')}
            >
              <MagnifyingGlassIcon size={16} />
            </button>
            <UpdateButton />
            {isMobile && <Inbox />}
          </div>
        </>
      )}
    </div>
  );
}
