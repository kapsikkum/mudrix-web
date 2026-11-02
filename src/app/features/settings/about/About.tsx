import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LogoHover } from '@/app/components/AppLoading';
import {
  GithubLogoIcon,
  DownloadSimpleIcon,
  ArrowClockwiseIcon,
  CheckCircleIcon,
  SparkleIcon,
} from '@phosphor-icons/react';
import { useSetAtom } from 'jotai';
import { whatsNewOpenAtom } from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { useToast } from '@/app/hooks/useToast';
import { latestWhatsNew } from '@/app/features/whatsNew';
import {
  checkForDesktopUpdates,
  forgetPendingUpdate,
  getDesktopSettings,
  installDesktopUpdate,
  isTauriDesktop,
  isMobileDevice,
  onDesktopUpdate,
  openExternalUrl,
  setDesktopSettings,
  type DesktopSettings,
  type DesktopUpdateCheck,
  type DesktopUpdateInfo,
} from '@/util/desktop';
import * as css from '../Settings.css';
import * as heroCss from './About.css';

const SOURCE_URL = 'https://github.com/kapsikkum/mudrix-web';
const WIZARDCHAT_URL = 'https://gitlab.com/wizardchat/wizardchat-web';
const DOWNLOAD_URL = 'https://github.com/kapsikkum/mudrix-desktop/releases/latest';
/** How long the button says "You're up to date" after a check. */
const UP_TO_DATE_MS = 5000;

export function About() {
  const { t } = useTranslation();
  // APP_VERSION is injected by Vite define (typed in src/vite-env.d.ts)
  const version = import.meta.env.APP_VERSION ?? 'unknown';
  const setWhatsNewOpen = useSetAtom(whatsNewOpenAtom);
  const hasWhatsNew = !!latestWhatsNew('en');

  const toast = useToast();
  const [updateCheck, setUpdateCheck] = useState<
    DesktopUpdateCheck | 'checking' | 'installFailed' | null
  >(null);
  const [installing, setInstalling] = useState(false);
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  useEffect(() => {
    if (!isTauriDesktop()) return;
    getDesktopSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  // Set by a check made here or by the background check that runs on its own.
  const [update, setUpdate] = useState<DesktopUpdateInfo | null>(null);
  useEffect(() => onDesktopUpdate(setUpdate), []);

  const handleCheck = async () => {
    setUpdateCheck('checking');
    setUpdateCheck(await checkForDesktopUpdates());
  };

  // "You're up to date" replaces the button's label for a few seconds, then fades back to "Check for updates".
  const [fadingOut, setFadingOut] = useState(false);
  useEffect(() => {
    if (updateCheck !== 'upToDate') return undefined;
    setFadingOut(false);
    const fade = window.setTimeout(() => setFadingOut(true), UP_TO_DATE_MS - 400);
    const done = window.setTimeout(() => {
      setUpdateCheck(null);
      setFadingOut(false);
    }, UP_TO_DATE_MS);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, [updateCheck]);

  // `ready` is downloaded and installs on restart; `available` is a build to download by hand.
  const handleUpdate = async () => {
    if (update?.kind === 'available') {
      openExternalUrl(update.url);
      return;
    }
    // Installing restarts the app, so the button stays busy until then; only a failure comes back.
    setInstalling(true);
    setUpdateCheck(null);
    if (!(await installDesktopUpdate())) {
      setInstalling(false);
      setUpdateCheck('installFailed');
      toast.error(t('update.installFailed'));
    }
  };

  // Another channel may have a different newest version, so what was found so far no longer counts.
  const handlePrereleases = (includePrereleases: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, includePrereleases });
    setDesktopSettings({ includePrereleases })
      .then((saved) => {
        setSettings(saved);
        forgetPendingUpdate();
        return handleCheck();
      })
      .catch(() => getDesktopSettings().then(setSettings));
  };

  const checking = updateCheck === 'checking';

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.about.title')}</h2>

      <div className={heroCss.hero}>
        <LogoHover size={64} />
        <div className={heroCss.heroInfo}>
          <div className={heroCss.nameRow}>
            <span className={heroCss.appName}>Mudrix</span>
            <span className={heroCss.versionTag}>v{version}</span>
          </div>
          <div className={heroCss.heroActions}>
            {isTauriDesktop() ? (
              update ? (
                <button
                  type="button"
                  className={heroCss.downloadBtn}
                  onClick={handleUpdate}
                  disabled={installing}
                >
                  {installing ? (
                    <ArrowClockwiseIcon size={16} className={heroCss.spinning} />
                  ) : (
                    <DownloadSimpleIcon size={16} />
                  )}
                  {installing
                    ? t('update.installing')
                    : t('update.updateTo', { version: update.version })}
                </button>
              ) : (
                <button
                  type="button"
                  className={heroCss.downloadBtn}
                  onClick={handleCheck}
                  disabled={checking}
                >
                  <span
                    key={updateCheck === 'upToDate' ? 'upToDate' : 'check'}
                    className={[heroCss.label, fadingOut && heroCss.labelFading]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {updateCheck === 'upToDate' ? (
                      <>
                        <CheckCircleIcon size={16} />
                        {t('update.upToDate')}
                      </>
                    ) : (
                      <>
                        <ArrowClockwiseIcon
                          size={16}
                          className={checking ? heroCss.spinning : undefined}
                        />
                        {checking ? t('update.checking') : t('update.checkNow')}
                      </>
                    )}
                  </span>
                </button>
              )
            ) : (
              !isMobileDevice() && (
                <a
                  href={DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={heroCss.downloadBtn}
                >
                  <DownloadSimpleIcon size={16} />
                  {t('settings.about.downloadDesktop')}
                </a>
              )
            )}
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={heroCss.sourceBtn}
            >
              <GithubLogoIcon size={16} />
              {t('settings.about.viewSourceOnGitHub')}
            </a>
            {hasWhatsNew && (
              <button
                type="button"
                className={heroCss.sourceBtn}
                onClick={() => setWhatsNewOpen(true)}
              >
                <SparkleIcon size={16} />
                {t('whatsNew.title')}
              </button>
            )}
          </div>
          {((!update && updateCheck && updateCheck !== 'upToDate' && !checking) ||
            updateCheck === 'installFailed') && (
            <span className={css.settingLabel} role="status">
              {updateCheck === 'error' && t('update.checkFailed')}
              {updateCheck === 'installFailed' && t('update.installFailed')}
              {(updateCheck === 'ready' || updateCheck === 'available') && t('update.available')}
            </span>
          )}
        </div>
      </div>

      {isTauriDesktop() && settings && (
        <div className={css.section}>
          <h3 className={css.sectionTitle}>{t('settings.about.updates')}</h3>
          <ToggleRow
            label={t('settings.about.includePrereleases')}
            description={t('settings.about.includePrereleasesNote')}
            checked={settings.includePrereleases}
            disabled={checking || installing}
            onChange={handlePrereleases}
          />
        </div>
      )}

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.about.credits')}</h3>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>
            Mudrix is a fork of{' '}
            <a
              href={WIZARDCHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={css.externalLink}
            >
              WizardChat
            </a>{' '}
            (AGPL-3.0).
          </span>
        </div>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>
            <Trans
              i18nKey="settings.about.matrixSdk"
              components={{
                sdkLink: (
                  // eslint-disable-next-line jsx-a11y/anchor-has-content
                  <a
                    href="https://github.com/matrix-org/matrix-js-sdk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={css.externalLink}
                  />
                ),
              }}
            />
          </span>
        </div>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>
            <Trans
              i18nKey="settings.about.phosphorIcons"
              components={{
                phosphorLink: (
                  // eslint-disable-next-line jsx-a11y/anchor-has-content
                  <a
                    href="https://phosphoricons.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={css.externalLink}
                  />
                ),
              }}
            />
          </span>
        </div>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>
            <Trans
              i18nKey="settings.about.elementCall"
              components={{
                elementCallLink: (
                  // eslint-disable-next-line jsx-a11y/anchor-has-content
                  <a
                    href="https://github.com/element-hq/element-call"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={css.externalLink}
                  />
                ),
              }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
