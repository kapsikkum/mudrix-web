import { useState, useEffect, useLayoutEffect, useCallback, Fragment } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/app/components/Tooltip';
import {
  SlidersIcon,
  PuzzlePieceIcon,
  UsersIcon,
  ShieldIcon,
  SmileyStickerIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { roomSettingsRoomIdAtom, roomSettingsTabAtom, developerModeAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Dialog } from '@/app/components/Dialog/Dialog';
import { GeneralPanel } from './General';
import { PermissionsPanel } from './Permissions';
import { RoomPermissionsMatrix } from './RoomPermissionsMatrix';
import { Widgets } from './Widgets';
import { EmojiStickerPanel } from './EmojiStickerPanel';
import * as css from '@/app/components/Settings/Settings.css';

type Tab = 'general' | 'members' | 'permissions' | 'widgets' | 'emojis';

const NAV: { tab: Tab; labelKey: string; Icon: PhosphorIcon }[] = [
  { tab: 'general', labelKey: 'room.settings.general.title', Icon: SlidersIcon },
  { tab: 'members', labelKey: 'common.members', Icon: UsersIcon },
  {
    tab: 'permissions',
    labelKey: 'room.settings.permissions.title',
    Icon: ShieldIcon,
  },
  {
    tab: 'widgets',
    labelKey: 'room.settings.widgets.title',
    Icon: PuzzlePieceIcon,
  },
  {
    tab: 'emojis',
    labelKey: 'room.settings.emojis.title',
    Icon: SmileyStickerIcon,
  },
];

export function RoomSettings() {
  const { t } = useTranslation();
  const [roomId, setRoomId] = useAtom(roomSettingsRoomIdAtom);
  const [roomSettingsTab, setRoomSettingsTab] = useAtom(roomSettingsTabAtom);
  const developerMode = useAtomValue(developerModeAtom);
  const client = getMatrixClientOrNull();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    setIsNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const room = roomId && client ? client.getRoom(roomId) : null;

  const navItems = developerMode ? NAV : NAV.filter((item) => item.tab !== 'widgets');
  const shownTab = !developerMode && activeTab === 'widgets' ? 'general' : activeTab;

  useLayoutEffect(() => {
    if (roomId) {
      setActiveTab(roomSettingsTab ?? 'general');
      setRoomSettingsTab(null);
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => setRoomId(null), [setRoomId]);

  const valid = Boolean(roomId) && Boolean(room && client) && room?.getMyMembership() === 'join';

  return (
    <Dialog
      open={Boolean(roomId)}
      onClose={close}
      size="xl"
      zIndex={7000}
      maxWidth="900px"
      height="640px"
      surface="primary"
      fullscreenOnMobile
      bodyClassName={css.dialogBody}
      ariaLabel={t('common.settings')}
    >
      {valid ? (
        <>
          <nav className={css.nav}>
            <span className={css.navLabel}>{t('common.settings')}</span>
            {navItems.map((item) => {
              const isActive = shownTab === item.tab;
              return (
                <Fragment key={item.tab}>
                  {isNarrow ? (
                    <Tooltip content={t(item.labelKey)} placement="right">
                      <button
                        type="button"
                        className={isActive ? css.navItemActive : css.navItem}
                        onClick={() => setActiveTab(item.tab)}
                      >
                        <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                        <span className={css.navLabelText}>{t(item.labelKey)}</span>
                      </button>
                    </Tooltip>
                  ) : (
                    <button
                      type="button"
                      className={isActive ? css.navItemActive : css.navItem}
                      onClick={() => setActiveTab(item.tab)}
                    >
                      <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                      <span className={css.navLabelText}>{t(item.labelKey)}</span>
                    </button>
                  )}
                </Fragment>
              );
            })}
          </nav>

          <div className={css.content}>
            <button
              type="button"
              className={css.closeBtn}
              onClick={close}
              aria-label={t('common.close')}
            >
              <XIcon size={18} />
            </button>
            {shownTab === 'general' && <GeneralPanel roomId={roomId!} onClose={close} />}
            {shownTab === 'members' && <PermissionsPanel roomId={roomId!} />}
            {shownTab === 'permissions' && room && <RoomPermissionsMatrix room={room} />}
            {shownTab === 'widgets' && <Widgets roomId={roomId!} client={client!} />}
            {shownTab === 'emojis' && <EmojiStickerPanel roomId={roomId!} client={client!} />}
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
