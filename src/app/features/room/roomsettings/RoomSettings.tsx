import { useState, useEffect, useLayoutEffect, useCallback, Fragment } from 'react';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@/app/components/Tooltip';
import {
  SlidersIcon,
  PuzzlePieceIcon,
  UsersIcon,
  ShieldIcon,
  SmileyStickerIcon,
  ClockCounterClockwiseIcon,
  XIcon,
  CaretLeftIcon,
  CaretRightIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { EventTimeline } from 'matrix-js-sdk';
import { roomSettingsRoomIdAtom, roomSettingsTabAtom, developerModeAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { Dialog } from '@/app/components/Dialog/Dialog';
import { GeneralPanel } from './General';
import { PermissionsPanel } from './Permissions';
import { RoomPermissionsMatrix } from './RoomPermissionsMatrix';
import { Widgets } from './Widgets';
import { EmojiStickerPanel } from './EmojiStickerPanel';
import { AuditLogPanel } from './AuditLog';
import { useBackToClose } from '@/app/hooks/useBackToClose';
import * as css from '@/app/features/settings/Settings.css';

type Tab = 'general' | 'members' | 'permissions' | 'widgets' | 'emojis' | 'audit';

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
  {
    tab: 'audit',
    labelKey: 'room.settings.auditLog.title',
    Icon: ClockCounterClockwiseIcon,
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
  // Phone layout only: false shows the list of sections, true shows the active one.
  const [pageOpen, setPageOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PANEL_OVERLAY_QUERY);
    setIsNarrow(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const room = roomId && client ? client.getRoom(roomId) : null;

  // The audit log is for people who can moderate: the history is visible to every member, but
  // reading it is a moderator's job.
  const myId = client?.getUserId() ?? '';
  const canAudit =
    !!room &&
    !!room
      .getLiveTimeline()
      .getState(EventTimeline.FORWARDS)
      ?.hasSufficientPowerLevelFor('kick', room.getMember(myId)?.powerLevel ?? 0);
  const navItems = NAV.filter(
    (item) => (developerMode || item.tab !== 'widgets') && (canAudit || item.tab !== 'audit')
  );
  const shownTab =
    (!developerMode && activeTab === 'widgets') || (!canAudit && activeTab === 'audit')
      ? 'general'
      : activeTab;

  useLayoutEffect(() => {
    if (roomId) {
      setActiveTab(roomSettingsTab ?? 'general');
      setPageOpen(roomSettingsTab != null);
      setRoomSettingsTab(null);
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  useBackToClose(Boolean(roomId) && isNarrow && pageOpen, () => setPageOpen(false));

  const close = useCallback(() => setRoomId(null), [setRoomId]);

  const valid = Boolean(roomId) && Boolean(room && client) && room?.getMyMembership() === 'join';

  const panels = (
    <>
      {shownTab === 'general' && <GeneralPanel roomId={roomId!} onClose={close} />}
      {shownTab === 'members' && <PermissionsPanel roomId={roomId!} />}
      {shownTab === 'permissions' && room && <RoomPermissionsMatrix room={room} />}
      {shownTab === 'widgets' && <Widgets roomId={roomId!} client={client!} />}
      {shownTab === 'emojis' && <EmojiStickerPanel roomId={roomId!} client={client!} />}
      {shownTab === 'audit' && room && <AuditLogPanel room={room} client={client!} />}
    </>
  );

  if (isNarrow) {
    const activeItem = navItems.find((item) => item.tab === shownTab);
    return (
      <Dialog
        open={Boolean(roomId)}
        onClose={close}
        size="xl"
        zIndex={7000}
        surface="primary"
        fullscreenOnMobile
        bodyClassName={css.dialogBody}
        ariaLabel={t('common.settings')}
      >
        {valid ? (
          <div className={css.mobileRoot}>
            <div className={css.mobileTopBar}>
              {pageOpen ? (
                <button
                  type="button"
                  className={css.mobileIconBtn}
                  onClick={() => window.history.back()}
                  aria-label={t('common.back', { defaultValue: 'Back' })}
                >
                  <CaretLeftIcon size={22} />
                </button>
              ) : null}
              <span className={css.mobileTopTitle}>
                {pageOpen && activeItem ? t(activeItem.labelKey) : t('common.settings')}
              </span>
              {!pageOpen && (
                <button
                  type="button"
                  className={css.mobileIconBtn}
                  onClick={close}
                  aria-label={t('common.close')}
                >
                  <XIcon size={22} />
                </button>
              )}
            </div>
            {pageOpen ? (
              <div className={css.mobileContent}>{panels}</div>
            ) : (
              <div className={css.mobileList}>
                {navItems.map((item) => (
                  <button
                    key={item.tab}
                    type="button"
                    className={css.mobileRow}
                    onClick={() => {
                      setActiveTab(item.tab);
                      setPageOpen(true);
                    }}
                  >
                    <item.Icon size={22} />
                    <span className={css.mobileRowLabel}>{t(item.labelKey)}</span>
                    <CaretRightIcon size={16} className={css.mobileRowChevron} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </Dialog>
    );
  }

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
            <div className={css.scroller}>
              {shownTab === 'general' && <GeneralPanel roomId={roomId!} onClose={close} />}
              {shownTab === 'members' && <PermissionsPanel roomId={roomId!} />}
              {shownTab === 'permissions' && room && <RoomPermissionsMatrix room={room} />}
              {shownTab === 'widgets' && <Widgets roomId={roomId!} client={client!} />}
              {shownTab === 'emojis' && <EmojiStickerPanel roomId={roomId!} client={client!} />}
              {shownTab === 'audit' && room && <AuditLogPanel room={room} client={client!} />}
            </div>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
