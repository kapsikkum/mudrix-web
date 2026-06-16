import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  SlidersIcon,
  PuzzlePieceIcon,
  BellIcon,
  LockIcon,
  UsersIcon,
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
import * as css from '@/app/components/Settings/Settings.css';

type Tab = 'general' | 'security' | 'permissions' | 'widgets' | 'notifications';

const NAV: { tab: Tab; labelKey: string; Icon: PhosphorIcon }[] = [
  { tab: 'general', labelKey: 'room.settings.general.title', Icon: SlidersIcon },
  { tab: 'security', labelKey: 'room.settings.security.title', Icon: LockIcon },
  { tab: 'permissions', labelKey: 'common.members', Icon: UsersIcon },
  {
    tab: 'widgets',
    labelKey: 'room.settings.widgets.title',
    Icon: PuzzlePieceIcon,
  },
  { tab: 'notifications', labelKey: 'room.settings.notifications.title', Icon: BellIcon },
];

export function RoomSettings() {
  const { t } = useTranslation();
  const [roomId, setRoomId] = useAtom(roomSettingsRoomIdAtom);
  const client = getMatrixClientOrNull();
  const [activeTab, setActiveTab] = useState<Tab>('general');

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

  return (
    <div className={css.overlay} onClick={close}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        <nav className={css.nav}>
          <span className={css.navLabel}>{t('common.settings')}</span>
          {NAV.map((item) => {
            const isActive = activeTab === item.tab;
            return (
              <button
                key={item.tab}
                className={isActive ? css.navItemActive : css.navItem}
                onClick={() => setActiveTab(item.tab)}
                title={t(item.labelKey)}
              >
                <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                <span className={css.navLabelText}>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className={css.content}>
          <button className={css.closeBtn} onClick={close} aria-label={t('common.close')}>
            <XIcon size={18} />
          </button>
          {activeTab === 'general' && (
            <GeneralPanel roomId={roomId} roomName={roomName} onClose={close} />
          )}
          {activeTab === 'security' && <SecurityPrivacyPanel roomId={roomId} />}
          {activeTab === 'permissions' && <PermissionsPanel roomId={roomId} />}
          {activeTab === 'widgets' && <Widgets roomId={roomId} client={client} />}
          {activeTab === 'notifications' && <NotificationsPanel roomId={roomId} />}
        </div>
      </div>
    </div>
  );
}
