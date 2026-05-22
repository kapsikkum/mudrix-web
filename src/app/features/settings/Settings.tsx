import { useCallback, useEffect, useRef, useState } from 'react';
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
  InfoIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { settingsOpenAtom, settingsPageAtom } from '@/app/store/atoms';
import type { SettingsPage } from '@/app/store/atoms';
import { Avatar, MatrixId, DisplayName, AccountActions } from './account';
import { AudioVideo } from './audio';
import { Appearance } from './appearance';
import { Preferences } from './preferences';
import { Keybinds } from './keybinds';
import { KeyBackup } from './keybackup';
import { Sessions } from './sessions';
import { About } from './about';
import * as css from './Settings.css';

interface NavEntry {
  page: SettingsPage;
  label: string;
  Icon: PhosphorIcon;
  dividerBefore?: boolean;
}

function AccountPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.account.title')}</h2>
      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('common.avatar')}</h3>
        <Avatar />
      </div>
      <div className={css.divider} />
      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.account.identity')}</h3>
        <MatrixId />
        <DisplayName />
      </div>
      <AccountActions />
    </div>
  );
}

function PageContent({ page }: { page: SettingsPage }) {
  switch (page) {
    case 'account':
      return <AccountPage />;
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
    case 'about':
      return <About />;
  }
}

export function Settings() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(settingsOpenAtom);
  const [targetPage, setTargetPage] = useAtom(settingsPageAtom);
  const [activePage, setActivePage] = useState<SettingsPage>('account');
  const targetPageRef = useRef(targetPage);
  targetPageRef.current = targetPage;

  const NAV: NavEntry[] = [
    { page: 'account', label: t('settings.account.title'), Icon: UserIcon },
    { page: 'audio', label: t('settings.audioVideo.title'), Icon: MicrophoneIcon },
    { page: 'appearance', label: t('settings.appearance.title'), Icon: PaletteIcon },
    { page: 'preferences', label: t('settings.preferences.title'), Icon: SlidersIcon },
    { page: 'keybinds', label: t('settings.keybinds.title'), Icon: KeyboardIcon },
    { page: 'keybackup', label: t('settings.keyBackup.title'), Icon: KeyIcon, dividerBefore: true },
    { page: 'sessions', label: t('settings.sessions.title'), Icon: LaptopIcon },
    { page: 'about', label: t('settings.about.title'), Icon: InfoIcon, dividerBefore: true },
  ];

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Reset to profile each time the modal opens (unless a target page was set)
  useEffect(() => {
    if (open) {
      const page = targetPageRef.current;
      if (page) {
        setActivePage(page);
        setTargetPage(null);
      } else {
        setActivePage('account');
      }
    }
  }, [open, setTargetPage]);

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
                  title={item.label}
                >
                  <item.Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                  <span className={css.navLabelText}>{item.label}</span>
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
