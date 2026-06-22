import { useState, useEffect, useCallback, Fragment } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/app/components/Tooltip';
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
import { PermissionsPanel } from '@/app/features/room/roomsettings/Permissions';
import * as css from '@/app/components/Settings/Settings.css';

type Tab = 'general' | 'security' | 'permissions';

const NAV: { tab: Tab; labelKey: string; Icon: PhosphorIcon }[] = [
  { tab: 'general', labelKey: 'room.settings.general.title', Icon: SlidersIcon },
  { tab: 'security', labelKey: 'room.settings.security.title', Icon: LockIcon },
  { tab: 'permissions', labelKey: 'common.members', Icon: UsersIcon },
];

export function SpaceSettings() {
  const { t } = useTranslation();
  const [spaceId, setSpaceId] = useAtom(spaceSettingsRoomIdAtom);
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

  if (space.getMyMembership() !== 'join') return null;

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
            <GeneralPanel spaceId={spaceId} spaceName={spaceName} onClose={close} />
          )}
          {activeTab === 'security' && <SecurityPrivacyPanel spaceId={spaceId} />}
          {activeTab === 'permissions' && <PermissionsPanel roomId={spaceId} />}
        </div>
      </div>
    </div>
  );
}
