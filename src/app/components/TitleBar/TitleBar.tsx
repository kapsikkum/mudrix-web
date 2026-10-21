import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  MagnifyingGlassIcon,
  MinusIcon,
  SquareIcon,
  CornersInIcon,
  XIcon,
} from '@phosphor-icons/react';
import type { Window as TauriWindow } from '@tauri-apps/api/window';
import { currentRoomIdAtom, roomSearchAtom, globalSearchOpenAtom } from '@/app/store/atoms';
import { RoomSearchField } from '@/app/features/roomSearch';
import { MODIFIER_KEY, isMac } from '@/app/util/platform';
import { isTauri } from '@/util/desktop';
import * as css from './TitleBar.css';

interface TitleBarProps {
  center?: ReactNode;
  end?: ReactNode;
  fixed?: boolean;
}

/** App-wide top bar; also the window drag area and control spacing on desktop. */
export function TitleBar({ center, end, fixed }: TitleBarProps) {
  // Windows/Linux draw their own window controls here since the OS title bar is
  // removed (`decorations: false`). macOS keeps the native traffic lights
  // (see TitleBar.css.ts `html.tauri-darwin` padding), so nothing is rendered there.
  const showWindowControls = isTauri() && !isMac();
  return (
    <header className={fixed ? css.titleBarFixed : css.titleBar} data-tauri-drag-region="deep">
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
      {showWindowControls && <WindowControls />}
    </header>
  );
}

/** Custom minimize/maximize/close buttons for the frameless Windows/Linux window. */
function WindowControls() {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);
  const windowRef = useRef<TauriWindow | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      if (cancelled) return;
      const win = getCurrentWindow();
      windowRef.current = win;
      setMaximized(await win.isMaximized());
      unlisten = await win.onResized(async () => {
        if (!cancelled) setMaximized(await win.isMaximized());
      });
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div className={css.windowControls} data-tauri-drag-region="false">
      <button
        type="button"
        className={css.windowControl}
        title={t('titleBar.minimize')}
        aria-label={t('titleBar.minimize')}
        onClick={() => windowRef.current?.minimize()}
      >
        <MinusIcon size={14} />
      </button>
      <button
        type="button"
        className={css.windowControl}
        title={t(maximized ? 'titleBar.restore' : 'titleBar.maximize')}
        aria-label={t(maximized ? 'titleBar.restore' : 'titleBar.maximize')}
        onClick={() => windowRef.current?.toggleMaximize()}
      >
        {maximized ? <CornersInIcon size={14} /> : <SquareIcon size={13} />}
      </button>
      <button
        type="button"
        className={css.windowControlClose}
        title={t('titleBar.close')}
        aria-label={t('titleBar.close')}
        onClick={() => windowRef.current?.close()}
      >
        <XIcon size={14} />
      </button>
    </div>
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
