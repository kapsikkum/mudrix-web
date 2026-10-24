import { useEffect, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { PANEL_OVERLAY_QUERY } from '@/const/breakpoints';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { Tooltip } from '@/app/components/Tooltip';
import { Dialog } from '@/app/components/Dialog/Dialog';
import { useBackToClose } from '@/app/hooks/useBackToClose';
import {
  UserIcon,
  CaretLeftIcon,
  CaretRightIcon,
  PaletteIcon,
  PersonSimpleCircleIcon,
  ShieldIcon,
  BellIcon,
  MicrophoneIcon,
  SmileyStickerIcon,
  KeyboardIcon,
  GlobeSimpleIcon,
  WrenchIcon,
  DevicesIcon,
  InfoIcon,
  XIcon,
  SpinnerGapIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { settingsOpenAtom, settingsPageAtom } from '@/app/store/atoms';
import type { SettingsPage } from '@/app/store/atoms';
import {
  Avatar,
  MatrixId,
  DisplayName,
  ExtendedProfile,
  AccountActions,
  ChangePassword,
  EmailSettings,
  DeactivateAccount,
} from './account';
import { useAccountManagement } from '@/app/hooks/useAccountManagement';
import { Appearance } from './appearance';
import { Accessibility } from './accessibility';
import { Privacy } from './privacy';
import { Language } from './language';
import { Notifications } from './notifications';
import { VoiceAudio } from './voice';
import { EmojisStickers } from './emojis';
import { Keybinds } from './keybinds';
import { DeveloperOptions } from './developer';
import { Sessions } from './sessions';
import { About } from './about';
import { isTauriMobile } from '@/util/desktop';
import * as css from './Settings.css';

interface NavEntry {
  page: SettingsPage;
  label: string;
  Icon: PhosphorIcon;
  dividerBefore?: boolean;
}

function AccountPage() {
  const { t } = useTranslation();
  const { canChangePassword, canChangeThreePids, accountManagementUrl, loading } =
    useAccountManagement();

  if (accountManagementUrl) {
    return (
      <div>
        <h2 className={css.panelTitle}>{t('settings.account.title')}</h2>
        <div className={css.section}>
          <div className={css.avatarRow}>
            <div className={css.profileFields}>
              <DisplayName />
              <MatrixId />
            </div>
            <Avatar />
          </div>
        </div>
        <div className={css.divider} />
        <div className={css.section}>
          <ExtendedProfile />
        </div>
        <div className={css.divider} />
        <div className={css.section}>
          <p className={css.settingNote}>{t('settings.account.externalManagement')}</p>
          <a
            href={accountManagementUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={css.externalLink}
          >
            {t('settings.account.manageAccount')}
          </a>
        </div>
        <AccountActions />
      </div>
    );
  }

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.account.title')}</h2>
      <div className={css.section}>
        <div className={css.avatarRow}>
          <div className={css.profileFields}>
            <DisplayName />
            <MatrixId />
          </div>
          <Avatar />
        </div>
      </div>
      <div className={css.section}>
        <ExtendedProfile />
      </div>
      {loading ? (
        <div className={css.actions}>
          <SpinnerGapIcon size={20} className="icon-spin" />
        </div>
      ) : (
        <>
          {canChangePassword && (
            <>
              <div className={css.divider} />
              <div className={css.section}>
                <h3 className={css.sectionTitle}>{t('settings.account.changePasswordTitle')}</h3>
                <ChangePassword />
              </div>
            </>
          )}
          {canChangeThreePids && (
            <>
              <div className={css.divider} />
              <div className={css.section}>
                <h3 className={css.sectionTitle}>{t('settings.account.emailTitle')}</h3>
                <EmailSettings />
              </div>
            </>
          )}
          <div className={css.divider} />
          <div className={css.section}>
            <h3 className={css.sectionTitle}>{t('settings.account.deactivateAccount')}</h3>
            <DeactivateAccount />
          </div>
        </>
      )}
      <AccountActions />
    </div>
  );
}

function PageContent({ page }: { page: SettingsPage }) {
  switch (page) {
    case 'account':
      return <AccountPage />;
    case 'appearance':
      return <Appearance />;
    case 'accessibility':
      return <Accessibility />;
    case 'privacy':
      return <Privacy />;
    case 'language':
      return <Language />;
    case 'notifications':
      return <Notifications />;
    case 'voice':
      return <VoiceAudio />;
    case 'emojis-stickers':
      return <EmojisStickers />;
    case 'keybinds':
      return <Keybinds />;
    case 'developer':
      return <DeveloperOptions />;
    case 'sessions':
      return <Sessions />;
    case 'about':
      return <About />;
  }
}

export function Settings() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [targetPage, setTargetPage] = useAtom(settingsPageAtom);
  const [activePage, setActivePage] = useState<SettingsPage>('account');
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
  const targetPageRef = useRef(targetPage);
  targetPageRef.current = targetPage;

  const allNav: NavEntry[] = [
    { page: 'account', label: t('settings.account.title'), Icon: UserIcon },
    { page: 'privacy', label: t('settings.privacy.title'), Icon: ShieldIcon },
    {
      page: 'emojis-stickers',
      label: t('settings.emojisStickers.title'),
      Icon: SmileyStickerIcon,
    },
    { page: 'notifications', label: t('settings.notifications.title'), Icon: BellIcon },
    { page: 'voice', label: t('settings.voice.title'), Icon: MicrophoneIcon },
    {
      page: 'appearance',
      label: t('settings.appearance.title'),
      Icon: PaletteIcon,
      dividerBefore: true,
    },
    {
      page: 'accessibility',
      label: t('settings.accessibility.title'),
      Icon: PersonSimpleCircleIcon,
    },
    { page: 'keybinds', label: t('settings.keybinds.title'), Icon: KeyboardIcon },
    { page: 'language', label: t('settings.language.title'), Icon: GlobeSimpleIcon },
    {
      page: 'sessions',
      label: t('settings.sessions.title'),
      Icon: DevicesIcon,
      dividerBefore: true,
    },
    { page: 'developer', label: t('settings.developer.title'), Icon: WrenchIcon },
    { page: 'about', label: t('settings.about.title'), Icon: InfoIcon },
  ];
  // Keyboard shortcuts mean nothing on a phone.
  const NAV = allNav.filter((entry) => !(entry.page === 'keybinds' && isTauriMobile()));

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Reset to profile each time the modal opens (unless a target page was set)
  useLayoutEffect(() => {
    if (open && !targetPageRef.current) {
      setActivePage('account');
      setPageOpen(false);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !targetPage) return;
    setActivePage(targetPage);
    setPageOpen(true);
    setTargetPage(null);
  }, [open, targetPage, setTargetPage]);

  // Back from a section returns to the list (the dialog's own back entry closes Settings).
  useBackToClose(open && isNarrow && pageOpen, () => setPageOpen(false));

  if (isNarrow) {
    const activeEntry = NAV.find((n) => n.page === activePage);
    return (
      <Dialog
        open={open}
        onClose={close}
        size="xl"
        zIndex={7000}
        surface="primary"
        fullscreenOnMobile
        bodyClassName={css.dialogBody}
        ariaLabel={t('settings.userSettings')}
      >
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
              {pageOpen ? activeEntry?.label : t('settings.userSettings')}
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
            <div className={css.mobileContent}>
              <PageContent page={activePage} />
            </div>
          ) : (
            <div className={css.mobileList}>
              {NAV.map((item) => (
                <div key={item.page}>
                  {item.dividerBefore && <div className={css.mobileDivider} />}
                  <button
                    type="button"
                    className={css.mobileRow}
                    onClick={() => {
                      setActivePage(item.page);
                      setPageOpen(true);
                    }}
                  >
                    <item.Icon size={22} />
                    <span className={css.mobileRowLabel}>{item.label}</span>
                    <CaretRightIcon size={16} className={css.mobileRowChevron} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="xl"
      zIndex={7000}
      maxWidth="900px"
      height="640px"
      surface="primary"
      fullscreenOnMobile
      bodyClassName={css.dialogBody}
      ariaLabel={t('settings.userSettings')}
    >
      <nav className={css.nav}>
        <span className={css.navLabel}>{t('settings.userSettings')}</span>
        {NAV.map((item) => {
          const isActive = activePage === item.page;
          return (
            <div key={item.page}>
              {item.dividerBefore && <div className={css.navDivider} />}
              {isNarrow ? (
                <Tooltip content={item.label} placement="right">
                  <button
                    type="button"
                    className={isActive ? css.navItemActive : css.navItem}
                    onClick={() => setActivePage(item.page)}
                  >
                    <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                    <span className={css.navLabelText}>{item.label}</span>
                  </button>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  className={isActive ? css.navItemActive : css.navItem}
                  onClick={() => setActivePage(item.page)}
                >
                  <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                  <span className={css.navLabelText}>{item.label}</span>
                </button>
              )}
            </div>
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
        <PageContent page={activePage} />
      </div>
    </Dialog>
  );
}
