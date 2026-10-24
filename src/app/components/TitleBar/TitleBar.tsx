import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import { currentRoomIdAtom, roomSearchAtom, globalSearchOpenAtom } from '@/app/store/atoms';
import { RoomSearchField } from '@/app/features/roomSearch';
import { MODIFIER_KEY } from '@/app/util/platform';
import * as css from './TitleBar.css';

interface TitleBarProps {
  start?: ReactNode;
  center?: ReactNode;
  end?: ReactNode;
  fixed?: boolean;
}

/** App-wide top bar; also the window drag area and control spacing on desktop. */
export function TitleBar({ start, center, end, fixed }: TitleBarProps) {
  // Windows/Linux window buttons come from public/desktop-controls.js (static, above every overlay
  // and available while the app is still loading); this only translates their labels.
  const { t } = useTranslation();
  useEffect(() => {
    (
      window as { __mudrixWindowControlLabels?: Record<string, string> }
    ).__mudrixWindowControlLabels = {
      minimize: t('titleBar.minimize'),
      maximize: t('titleBar.maximize'),
      restore: t('titleBar.restore'),
      close: t('titleBar.close'),
    };
    (window as { __mudrixRefreshWindowControls?: () => void }).__mudrixRefreshWindowControls?.();
  }, [t]);
  return (
    <header className={fixed ? css.titleBarFixed : css.titleBar} data-tauri-drag-region="deep">
      {start && (
        <div className={css.start} data-tauri-drag-region="false">
          {start}
        </div>
      )}
      {center && (
        <div className={css.center} data-global-search-anchor data-tauri-drag-region="false">
          {center}
        </div>
      )}
      {end && (
        <div className={css.end} data-tauri-drag-region="false">
          {end}
        </div>
      )}
    </header>
  );
}

export function TitleBarSearch() {
  const { t } = useTranslation();
  const openGlobalSearch = useSetAtom(globalSearchOpenAtom);
  const roomSearch = useAtomValue(roomSearchAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);
  if (roomSearch && roomSearch.roomId === currentRoomId) return <RoomSearchField />;
  return (
    <button type="button" className={css.search} onClick={() => openGlobalSearch(true)}>
      <MagnifyingGlassIcon size={14} />
      <span className={css.searchLabel}>{t('titleBar.search')}</span>
      <kbd className={css.searchKbd}>{MODIFIER_KEY} K</kbd>
    </button>
  );
}
