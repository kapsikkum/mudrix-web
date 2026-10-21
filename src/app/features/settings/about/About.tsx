import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LogoHover } from '@/app/components/AppLoading';
import { GithubLogoIcon, DownloadSimpleIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import { checkForDesktopUpdates, isTauri, type DesktopUpdateCheck } from '@/util/desktop';
import * as css from '../Settings.css';
import * as heroCss from './About.css';

const SOURCE_URL = 'https://github.com/kapsikkum/mudrix-web';
const DOWNLOAD_URL = 'https://github.com/kapsikkum/mudrix-desktop/releases/latest';

export function About() {
  const { t } = useTranslation();
  // APP_VERSION is injected by Vite define (typed in src/vite-env.d.ts)
  const [version, setVersion] = useState(import.meta.env.APP_VERSION ?? 'unknown');

  const [updateCheck, setUpdateCheck] = useState<DesktopUpdateCheck | 'checking' | null>(null);

  const handleCheck = async () => {
    setUpdateCheck('checking');
    setUpdateCheck(await checkForDesktopUpdates());
  };

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then((v) => v && setVersion(v));
  }, []);

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
            <a
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={heroCss.downloadBtn}
            >
              <DownloadSimpleIcon size={16} />
              {t('settings.about.downloadDesktop')}
            </a>
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={heroCss.sourceBtn}
            >
              <GithubLogoIcon size={16} />
              {t('settings.about.viewSourceOnGitHub')}
            </a>
            {isTauri() && (
              <button
                type="button"
                className={heroCss.sourceBtn}
                onClick={handleCheck}
                disabled={updateCheck === 'checking'}
              >
                <ArrowClockwiseIcon size={16} />
                {t('update.checkNow')}
              </button>
            )}
          </div>
          {updateCheck && updateCheck !== 'checking' && (
            <span className={css.settingLabel} role="status">
              {updateCheck === 'upToDate' && t('update.upToDate')}
              {updateCheck === 'error' && t('update.checkFailed')}
              {(updateCheck === 'ready' || updateCheck === 'available') && t('update.available')}
            </span>
          )}
        </div>
      </div>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.about.credits')}</h3>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>Mudrix is a fork of WizardChat (AGPL-3.0).</span>
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
