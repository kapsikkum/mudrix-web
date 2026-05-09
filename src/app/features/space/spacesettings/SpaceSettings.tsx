import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  SlidersIcon,
  UsersIcon,
  LockIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { spaceSettingsRoomIdAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { GeneralPanel } from './General';
import { SecurityPrivacyPanel } from './SecurityPrivacy';
import { PermissionsPanel } from './Permissions';
import * as css from './SpaceSettings.css';

type Tab = 'general' | 'security' | 'permissions';

const NAV: { tab: Tab; labelKey: string; Icon: PhosphorIcon }[] = [
  { tab: 'general', labelKey: 'room.settings.general.title', Icon: SlidersIcon },
  { tab: 'security', labelKey: 'room.settings.security.title', Icon: LockIcon },
  { tab: 'permissions', labelKey: 'room.settings.members.title', Icon: UsersIcon },
];

export function SpaceSettings() {
  const { t } = useTranslation();
  const [spaceId, setSpaceId] = useAtom(spaceSettingsRoomIdAtom);
  const client = getMatrixClientOrNull();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const space = spaceId && client ? client.getRoom(spaceId) : null;
  const spaceName = space?.name ?? 'Space';

  useEffect(() => {
    if (spaceId) setActiveTab('general');
  }, [spaceId]);

  const close = useCallback(() => setSpaceId(null), [setSpaceId]);

  useEffect(() => {
    if (!spaceId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [spaceId, close]);

  if (!spaceId || !space) return null;

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
              >
                <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>

        <div className={css.content}>
          <button className={css.closeBtn} onClick={close} aria-label={t('common.close')}>
            <XIcon size={18} />
          </button>
          {activeTab === 'general' && (
            <GeneralPanel spaceId={spaceId} spaceName={spaceName} onClose={close} />
          )}
          {activeTab === 'security' && <SecurityPrivacyPanel spaceId={spaceId} />}
          {activeTab === 'permissions' && <PermissionsPanel spaceId={spaceId} />}
        </div>
      </div>
    </div>
  );
}
