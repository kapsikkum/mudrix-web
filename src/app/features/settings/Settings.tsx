import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import {
  UserIcon,
  MicrophoneIcon,
  PaletteIcon,
  SlidersIcon,
  KeyboardIcon,
  KeyIcon,
  LaptopIcon,
  ShieldIcon,
  InfoIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { settingsOpenAtom } from '@/app/store/atoms';
import { Avatar, MatrixId, DisplayName } from './profile';
import { AudioVideo } from './audio';
import { Appearance } from './appearance';
import { Preferences } from './preferences';
import { Keybinds } from './keybinds';
import { KeyBackup } from './keybackup';
import { Sessions } from './sessions';
import { Account } from './account';
import { About } from './about';
import * as css from './Settings.css';

type SettingsPage =
  | 'profile'
  | 'audio'
  | 'appearance'
  | 'preferences'
  | 'keybinds'
  | 'keybackup'
  | 'sessions'
  | 'account'
  | 'about';

interface NavEntry {
  page: SettingsPage;
  label: string;
  Icon: PhosphorIcon;
  dividerBefore?: boolean;
}

function ProfilePage() {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.profile.title')}</h2>
      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('common.avatar')}</h3>
        <Avatar />
      </div>
      <div className={css.divider} />
      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.profile.identity')}</h3>
        <MatrixId />
        <DisplayName />
      </div>
    </div>
  );
}

function PageContent({ page }: { page: SettingsPage }) {
  switch (page) {
    case 'profile':
      return <ProfilePage />;
    case 'audio':
      return <AudioVideo />;
    case 'appearance':
      return <Appearance />;
    case 'preferences':
      return <Preferences />;
    case 'keybinds':
      return <Keybinds />;
    case 'keybackup':
      return <KeyBackup />;
    case 'sessions':
      return <Sessions />;
    case 'account':
      return <Account />;
    case 'about':
      return <About />;
  }
}

export function Settings() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [activePage, setActivePage] = useState<SettingsPage>('profile');

  const NAV: NavEntry[] = [
    { page: 'profile', label: t('settings.profile.title'), Icon: UserIcon },
    { page: 'audio', label: t('settings.audioVideo.title'), Icon: MicrophoneIcon },
    { page: 'appearance', label: t('settings.appearance.title'), Icon: PaletteIcon },
    { page: 'preferences', label: t('settings.preferences.title'), Icon: SlidersIcon },
    { page: 'keybinds', label: t('settings.keybinds.title'), Icon: KeyboardIcon },
    { page: 'keybackup', label: t('settings.keyBackup.title'), Icon: KeyIcon, dividerBefore: true },
    { page: 'sessions', label: t('settings.sessions.title'), Icon: LaptopIcon },
    { page: 'account', label: t('settings.account.title'), Icon: ShieldIcon },
    { page: 'about', label: t('settings.about.title'), Icon: InfoIcon, dividerBefore: true },
  ];

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Reset to profile each time the modal opens
  useEffect(() => {
    if (open) setActivePage('profile');
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return (
    <div className={css.overlay} onClick={close}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        <nav className={css.nav}>
          <span className={css.navLabel}>{t('settings.userSettings')}</span>
          {NAV.map((item) => {
            const isActive = activePage === item.page;
            return (
              <div key={item.page}>
                {item.dividerBefore && <div className={css.navDivider} />}
                <button
                  className={isActive ? css.navItemActive : css.navItem}
                  onClick={() => setActivePage(item.page)}
                >
                  <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                  <span className="settings-nav-label">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>

        <div className={css.content}>
          <button className={css.closeBtn} onClick={close} aria-label={t('common.close')}>
            <XIcon size={18} />
          </button>
          <PageContent page={activePage} />
        </div>
      </div>
    </div>
  );
}
