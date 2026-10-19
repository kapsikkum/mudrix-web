import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  languageAtom,
  typingIndicatorsAtom,
  sendReadReceiptsAtom,
  showPresenceAtom,
  autoplayGifsAtom,
  mediaVisibilityAtom,
  type MediaVisibility,
} from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { Select } from '@/app/components/Select';
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
          label={t('settings.preferences.autoplayGifs')}
          description={t('settings.preferences.autoplayGifsNote')}
          checked={autoplayGifs}
          onChange={setAutoplayGifs}
        />
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.preferences.mediaVisibility')}</span>
          </div>
          <Select
            aria-label={t('settings.preferences.mediaVisibility')}
            value={mediaVisibility}
            options={Object.entries(MEDIA_VISIBILITY_OPTIONS).map(([option, labelKey]) => ({
              value: option,
              label: t(labelKey),
            }))}
            onChange={(v) => setMediaVisibility(v as MediaVisibility)}
          />
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.preferences.roomList')}</h3>

        <ToggleRow
          label={t('settings.preferences.showPresence')}
          description={t('settings.preferences.showPresenceNote')}
          checked={showPresence}
          onChange={setShowPresence}
        />
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.preferences.languageDisplay')}</span>
          </div>
          <Select
            aria-label={t('settings.preferences.languageDisplay')}
            value={i18n.language}
            options={SUPPORTED_LANGUAGES.map(({ code, labelKey }) => ({
              value: code,
              label: t(labelKey),
            }))}
            onChange={handleLanguageChange}
          />
        </div>
      </div>
    </div>
  );
}
