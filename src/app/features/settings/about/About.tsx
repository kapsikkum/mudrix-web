import { useTranslation } from 'react-i18next';
import * as css from '../Settings.css';

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
  const version = import.meta.env.APP_VERSION ?? 'unknown';

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.about.title')}</h2>

      <div className={css.section}>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>{t('settings.about.version')}</span>
          <span className={css.versionText}>{version}</span>
        </div>
      </div>

      <div className={css.section}>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>{t('settings.about.sourceCode')}</span>
          <a
            href={GITLAB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={css.externalLink}
          >
            <GitLabIcon size={30} />
            {t('settings.about.viewSourceOnGitLab')}
          </a>
        </div>
      </div>
      <div className={css.section}>
        <h3 className={css.sectionTitle}>Credits</h3>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>
            The{' '}
            <a
              href="https://github.com/matrix-org/matrix-js-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className={css.externalLink}
            >
              matrix-js-sdk
            </a>{' '}
            is © The Matrix.org Foundation C.I.C. used under the terms of the Apache License,
            Version 2.0.
          </span>
        </div>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>
            <a
              href="https://phosphoricons.com"
              target="_blank"
              rel="noopener noreferrer"
              className={css.externalLink}
            >
              Phosphor Icons
            </a>{' '}
            is © Phosphor Icons used under the terms of the MIT License.
          </span>
        </div>
        <div className={css.settingRow}>
          <span className={css.settingLabel}>
            Our Sticker Picker is a fork of{' '}
            <a
              href="https://github.com/maunium/stickerpicker"
              target="_blank"
              rel="noopener noreferrer"
              className={css.externalLink}
            >
              maunium/stickerpicker
            </a>{' '}
            used under the termns of the GNU Affero General Public License v3.0.
          </span>
        </div>
      </div>
    </div>
  );
}
