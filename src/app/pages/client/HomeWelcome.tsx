import type { CSSProperties, ReactNode } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Trans, useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  CameraIcon,
  CaretRightIcon,
  ChatCircleIcon,
  CompassIcon,
  ShieldWarningIcon,
  StackIcon,
} from '@phosphor-icons/react';
import {
  createSpaceOpenAtom,
  encryptionSetupWarningAtom,
  exploreOpenAtom,
  newDmOpenAtom,
  settingsOpenAtom,
  settingsPageAtom,
  type SettingsPage,
} from '@/app/store/atoms';
import { LogoHover } from '@/app/components/AppLoading';
import { useProfile } from '@/app/hooks/useProfile';
import { MODIFIER_KEY } from '@/app/util/platform';
import * as css from './HomeWelcome.css';

/** Puts a block in line for the staggered entrance. */
const step = (i: number) => ({ '--i': i }) as CSSProperties;

interface Action {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  warning?: boolean;
}

/** The Home tab once signed in: a greeting, the main ways in, and any setup left to do. */
export function HomeWelcome({ client }: { client: MatrixClient }) {
  const { t } = useTranslation();
  const setNewDmOpen = useSetAtom(newDmOpenAtom);
  const setCreateSpaceOpen = useSetAtom(createSpaceOpenAtom);
  const setExploreOpen = useSetAtom(exploreOpenAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const setSettingsPage = useSetAtom(settingsPageAtom);
  const encryptionNeedsSetup = useAtomValue(encryptionSetupWarningAtom);
  const { profile } = useProfile(client);

  // The SDK usually knows our name already; the profile query only confirms it a moment later.
  const userId = client.getUserId();
  const knownName = userId ? client.getUser(userId)?.displayName : undefined;
  const name = profile?.displayName ?? (knownName && knownName !== userId ? knownName : undefined);
  const greeting = name ? t('timeline.home.greeting', { name }) : t('timeline.welcomeTitle');

  const openSettings = (page: SettingsPage) => {
    setSettingsPage(page);
    setSettingsOpen(true);
  };

  const start: Action[] = [
    {
      id: 'dm',
      icon: <ChatCircleIcon size={22} />,
      title: t('timeline.startDm'),
      description: t('timeline.home.dmDesc'),
      onClick: () => setNewDmOpen(true),
    },
    {
      id: 'space',
      icon: <StackIcon size={22} />,
      title: t('room.space.chooseCreateJoin'),
      description: t('timeline.home.spaceDesc'),
      onClick: () => setCreateSpaceOpen({ open: true }),
    },
    {
      id: 'explore',
      icon: <CompassIcon size={22} />,
      title: t('timeline.home.exploreTitle'),
      description: t('timeline.home.exploreDesc'),
      onClick: () => setExploreOpen(true),
    },
  ];

  const setup: Action[] = [];
  if (profile && !profile.avatarUrl) {
    setup.push({
      id: 'profile',
      icon: <CameraIcon size={20} />,
      title: t('timeline.home.profileTitle'),
      description: t('timeline.home.profileDesc'),
      onClick: () => openSettings('account'),
    });
  }
  if (encryptionNeedsSetup) {
    setup.push({
      id: 'encryption',
      icon: <ShieldWarningIcon size={20} />,
      title: t('settings.keyBackup.setupIncomplete'),
      description: t('timeline.home.encryptionDesc'),
      onClick: () => openSettings('sessions'),
      warning: true,
    });
  }

  return (
    <div className={css.home}>
      <div className={css.inner}>
        <header className={css.hero}>
          <div className={`${css.logo} ${css.enter}`} style={step(0)} aria-hidden>
            <LogoHover size={72} />
          </div>
          <h1 className={`${css.title} ${css.enter}`} style={step(1)}>
            {greeting}
          </h1>
          <p className={`${css.tagline} ${css.enter}`} style={step(2)}>
            {t('welcome.tagline')}
          </p>
        </header>

        <section className={css.section} aria-labelledby="home-start-heading">
          <h2
            id="home-start-heading"
            className={`${css.sectionLabel} ${css.enter}`}
            style={step(3)}
          >
            {t('timeline.home.startHeading')}
          </h2>
          <ul className={css.grid}>
            {start.map((action, i) => (
              <li key={action.id} className={`${css.gridItem} ${css.enter}`} style={step(4 + i)}>
                <button type="button" className={css.card} onClick={action.onClick}>
                  <span className={css.cardIcon} aria-hidden>
                    {action.icon}
                  </span>
                  <span className={css.cardText}>
                    <span className={css.cardTitle}>{action.title}</span>
                    <span className={css.cardDesc}>{action.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {setup.length > 0 && (
          <section className={css.section} aria-labelledby="home-setup-heading">
            <h2
              id="home-setup-heading"
              className={`${css.sectionLabel} ${css.enter}`}
              style={step(7)}
            >
              {t('timeline.home.setupHeading')}
            </h2>
            <ul className={`${css.setupList} ${css.enter}`} style={step(8)}>
              {setup.map((action) => (
                <li key={action.id}>
                  <button type="button" className={css.setupRow} onClick={action.onClick}>
                    <span
                      className={`${css.setupIcon}${action.warning ? ` ${css.setupIconWarning}` : ''}`}
                      aria-hidden
                    >
                      {action.icon}
                    </span>
                    <span className={css.setupText}>
                      <span className={css.cardTitle}>{action.title}</span>
                      <span className={css.cardDesc}>{action.description}</span>
                    </span>
                    <CaretRightIcon size={16} className={css.chevron} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className={`${css.hint} ${css.enter}`} style={step(9)}>
          <Trans
            i18nKey="timeline.home.searchHint"
            values={{ keys: `${MODIFIER_KEY} K` }}
            components={{ kbd: <kbd className={css.kbd} /> }}
          />
        </p>
      </div>
    </div>
  );
}
