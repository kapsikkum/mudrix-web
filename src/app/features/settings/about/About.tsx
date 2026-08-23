import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LogoHover } from '@/app/components/AppLoading';
import * as css from '../Settings.css';
import * as heroCss from './About.css';

const GITLAB_URL = 'https://gitlab.com/wizardchat/wizardchat-web';

// GitLab fox logo mark as an inline SVG — no extra dependency needed
function GitLabIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 380 380"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M282.83 170.73l-.27-.69-26.14-68.22a6.81 6.81 0 00-2.69-3.24 7 7 0 00-8 .43 7 7 0 00-2.32 3.52l-17.65 54H154.29l-17.65-54a6.86 6.86 0 00-2.32-3.52 7 7 0 00-8-.43 6.85 6.85 0 00-2.69 3.24L97.44 170l-.26.69a48.54 48.54 0 0016.1 56.1l.09.07.24.17 39.82 29.82 19.7 14.91 12 9.06a8.07 8.07 0 009.19 0l12-9.06 19.7-14.91 40.06-30 .1-.08a48.56 48.56 0 0016.1-56.04z"
        fill="currentColor"
      />
    </svg>
  );
}

export function About() {
  const { t } = useTranslation();
  // APP_VERSION is injected by Vite define (typed in src/vite-env.d.ts)
  const [version, setVersion] = useState(import.meta.env.APP_VERSION ?? 'unknown');

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
            <span className={heroCss.appName}>WizardChat</span>
            <span className={heroCss.versionTag}>v{version}</span>
          </div>
          <a
            href={GITLAB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={heroCss.sourceBtn}
          >
            <GitLabIcon size={16} />
            {t('settings.about.viewSourceOnGitLab')}
          </a>
        </div>
      </div>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.about.credits')}</h3>
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
