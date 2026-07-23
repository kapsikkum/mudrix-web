import { useState, useEffect, useCallback, Fragment } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/app/components/Tooltip';
import {
  SlidersIcon,
  PuzzlePieceIcon,
  BellIcon,
  LockIcon,
  UsersIcon,
  SmileyStickerIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { roomSettingsRoomIdAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { GeneralPanel } from './General';
import { SecurityPrivacyPanel } from './SecurityPrivacy';
import { PermissionsPanel } from './Permissions';
import { NotificationsPanel } from './Notifications';
import { Widgets } from './Widgets';
import { EmojiStickerPanel } from './EmojiStickerPanel';
import * as css from '@/app/components/Settings/Settings.css';

type Tab = 'general' | 'security' | 'permissions' | 'widgets' | 'emojis' | 'notifications';

const NAV: { tab: Tab; labelKey: string; Icon: PhosphorIcon }[] = [
  { tab: 'general', labelKey: 'room.settings.general.title', Icon: SlidersIcon },
  { tab: 'security', labelKey: 'room.settings.security.title', Icon: LockIcon },
  { tab: 'permissions', labelKey: 'common.members', Icon: UsersIcon },
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
  { tab: 'notifications', labelKey: 'room.settings.notifications.title', Icon: BellIcon },
];

export function RoomSettings() {
  const { t } = useTranslation();
  const [roomId, setRoomId] = useAtom(roomSettingsRoomIdAtom);
  const client = getMatrixClientOrNull();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    setIsNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const room = roomId && client ? client.getRoom(roomId) : null;
  const roomName = room?.name ?? 'Room';

  useEffect(() => {
    if (roomId) setActiveTab('general');
  }, [roomId]);

  const close = useCallback(() => setRoomId(null), [setRoomId]);

  useEffect(() => {
    if (!roomId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [roomId, close]);

  if (!roomId || !room || !client) return null;

  if (room.getMyMembership() !== 'join') return null;

  return (
    <div className={css.overlay} role="presentation" onClick={close}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        <nav className={css.nav}>
          <span className={css.navLabel}>{t('common.settings')}</span>
          {NAV.map((item) => {
            const isActive = activeTab === item.tab;
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
          {activeTab === 'general' && (
            <GeneralPanel roomId={roomId} roomName={roomName} onClose={close} />
          )}
          {activeTab === 'security' && <SecurityPrivacyPanel roomId={roomId} />}
          {activeTab === 'permissions' && <PermissionsPanel roomId={roomId} />}
          {activeTab === 'widgets' && <Widgets roomId={roomId} client={client} />}
          {activeTab === 'emojis' && <EmojiStickerPanel roomId={roomId} client={client} />}
          {activeTab === 'notifications' && <NotificationsPanel roomId={roomId} />}
        </div>
      </div>
    </div>
  );
}
