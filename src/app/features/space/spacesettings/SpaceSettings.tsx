import { useState, useEffect, useLayoutEffect, useCallback, Fragment } from 'react';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/app/components/Tooltip';
import {
  SlidersIcon,
  ListBulletsIcon,
  UsersIcon,
  ShieldIcon,
  TagIcon,
  SmileyStickerIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { spaceSettingsRoomIdAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Dialog } from '@/app/components/Dialog/Dialog';
import { GeneralPanel } from './General';
import { RolesPanel } from './RolesPanel';
import { useSpaceListStyle } from '../spaceListStyle';
import { ChannelsPanel } from './ChannelsPanel';
import { MatrixRoomsPanel } from './MatrixRoomsPanel';
import { PermissionsPanel } from '@/app/features/room/roomsettings/Permissions';
import { RoomPermissionsMatrix } from '@/app/features/room/roomsettings/RoomPermissionsMatrix';
import { EmojiStickerPanel } from '@/app/features/room/roomsettings/EmojiStickerPanel';
import * as css from '@/app/components/Settings/Settings.css';

type Tab = 'general' | 'channels' | 'members' | 'roles' | 'permissions' | 'emojis';

const NAV: { tab: Tab; labelKey: string; Icon: PhosphorIcon }[] = [
  { tab: 'general', labelKey: 'room.settings.general.title', Icon: SlidersIcon },
  { tab: 'channels', labelKey: 'room.settings.channels.title', Icon: ListBulletsIcon },
  { tab: 'members', labelKey: 'common.members', Icon: UsersIcon },
  { tab: 'roles', labelKey: 'room.settings.roles.title', Icon: TagIcon },
  {
    tab: 'permissions',
    labelKey: 'room.settings.permissions.title',
    Icon: ShieldIcon,
  },
  {
    tab: 'emojis',
    labelKey: 'room.settings.emojis.title',
    Icon: SmileyStickerIcon,
  },
];

export function SpaceSettings() {
  const { t } = useTranslation();
  const [spaceId, setSpaceId] = useAtom(spaceSettingsRoomIdAtom);
  const client = getMatrixClientOrNull();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PANEL_OVERLAY_QUERY);
    setIsNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const space = spaceId && client ? client.getRoom(spaceId) : null;
  // Roles belong to the Modern room list style.
  const modern = useSpaceListStyle(client, spaceId) === 'modern';
  const nav = NAV.filter((item) => item.tab !== 'roles' || modern);

  useLayoutEffect(() => {
    if (spaceId) setActiveTab('general');
  }, [spaceId]);

  const close = useCallback(() => setSpaceId(null), [setSpaceId]);

  const valid = Boolean(spaceId && space && space.getMyMembership() === 'join');

  return (
    <Dialog
      open={Boolean(spaceId)}
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
            {nav.map((item) => {
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
            <div className={css.scroller}>
              {activeTab === 'general' && <GeneralPanel spaceId={spaceId!} />}
              {activeTab === 'channels' &&
                (modern ? (
                  <ChannelsPanel spaceId={spaceId!} />
                ) : (
                  <MatrixRoomsPanel spaceId={spaceId!} />
                ))}
              {activeTab === 'members' && <PermissionsPanel roomId={spaceId!} />}
              {activeTab === 'roles' && modern && <RolesPanel spaceId={spaceId!} />}
              {activeTab === 'permissions' && space && <RoomPermissionsMatrix room={space} />}
              {activeTab === 'emojis' && space && client && (
                <EmojiStickerPanel roomId={spaceId!} client={client} />
              )}
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
