import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  languageAtom,
  typingIndicatorsAtom,
  sendReadReceiptsAtom,
  showPresenceAtom,
  autoplayGifsAtom,
  prettifyLinksAtom,
  mediaVisibilityAtom,
  type MediaVisibility,
} from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { vars } from '@/theme/vars.css';
import * as css from '../Settings.css';

const MEDIA_VISIBILITY_OPTIONS: Record<MediaVisibility, string> = {
  always: 'settings.preferences.mediaVisibilityAlways',
  private: 'settings.preferences.mediaVisibilityPrivate',
  never: 'settings.preferences.mediaVisibilityNever',
};

export function Preferences() {
  const { t, i18n } = useTranslation();
  const [typingIndicators, setTypingIndicators] = useAtom(typingIndicatorsAtom);
  const [sendReadReceipts, setSendReadReceipts] = useAtom(sendReadReceiptsAtom);
  const [showPresence, setShowPresence] = useAtom(showPresenceAtom);
  const [autoplayGifs, setAutoplayGifs] = useAtom(autoplayGifsAtom);
  const [prettifyLinks, setPrettifyLinks] = useAtom(prettifyLinksAtom);
  const [mediaVisibility, setMediaVisibility] = useAtom(mediaVisibilityAtom);
  const setLanguage = useSetAtom(languageAtom);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.preferences.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.preferences.chat')}</h3>

        <ToggleRow
          label={t('settings.preferences.typingIndicators')}
          description={t('settings.preferences.typingIndicatorsNote')}
          checked={typingIndicators}
          onChange={setTypingIndicators}
        />
        <ToggleRow
          label={t('settings.preferences.sendReadReceipts')}
          description={t('settings.preferences.sendReadReceiptsNote')}
          checked={sendReadReceipts}
          onChange={setSendReadReceipts}
        />
        <ToggleRow
          label={t('settings.preferences.showPresence')}
          description={t('settings.preferences.showPresenceNote')}
          checked={showPresence}
          onChange={setShowPresence}
        />
        <ToggleRow
          label={t('settings.preferences.autoplayGifs')}
          description={t('settings.preferences.autoplayGifsNote')}
          checked={autoplayGifs}
          onChange={setAutoplayGifs}
        />
        <ToggleRow
          label={t('settings.preferences.prettifyLinks')}
          description={t('settings.preferences.prettifyLinksNote')}
          checked={prettifyLinks}
          onChange={setPrettifyLinks}
        />
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.preferences.mediaVisibility')}</span>
          </div>
          <select
            className={css.select}
            value={mediaVisibility}
            aria-label={t('settings.preferences.mediaVisibility')}
            onChange={(e) => setMediaVisibility(e.target.value as MediaVisibility)}
          >
            {Object.entries(MEDIA_VISIBILITY_OPTIONS).map(([option, labelKey]) => (
              <option key={option} value={option}>
                {t(labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={css.section}>
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.preferences.languageDisplay')}</span>
          </div>
          <select
            value={i18n.language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              background: vars.color.bgSecondary,
              color: vars.color.textPrimary,
              border: `1px solid ${vars.color.border}`,
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '0.9rem',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {SUPPORTED_LANGUAGES.map(({ code, labelKey }) => (
              <option key={code} value={code}>
                {t(labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
