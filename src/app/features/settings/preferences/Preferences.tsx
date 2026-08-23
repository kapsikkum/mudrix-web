import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { preferencesAtom, languageAtom } from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { requestNotificationPermission } from '@/app/hooks/useNotifications';
import { vars } from '@/theme/vars.css';
import * as css from '../Settings.css';

const SUPPORTED_LANGUAGES = [
  { code: 'en', labelKey: 'settings.preferences.languageEn' },
  { code: 'de', labelKey: 'settings.preferences.languageDe' },
] as const;

export function Preferences() {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useAtom(preferencesAtom);
  const setLanguage = useSetAtom(languageAtom);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  const update = (key: keyof typeof prefs, value: boolean) =>
    setPrefs((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.preferences.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.preferences.chat')}</h3>

        <ToggleRow
          label={t('settings.preferences.typingIndicators')}
          description={t('settings.preferences.typingIndicatorsNote')}
          checked={prefs.typingIndicators}
          onChange={(v) => update('typingIndicators', v)}
        />
        <ToggleRow
          label={t('settings.preferences.sendReadReceipts')}
          description={t('settings.preferences.sendReadReceiptsNote')}
          checked={prefs.sendReadReceipts}
          onChange={(v) => update('sendReadReceipts', v)}
        />
        <ToggleRow
          label={t('settings.preferences.showPresence')}
          description={t('settings.preferences.showPresenceNote')}
          checked={prefs.showPresence}
          onChange={(v) => update('showPresence', v)}
        />
        <ToggleRow
          label={t('settings.preferences.autoplayGifs')}
          description={t('settings.preferences.autoplayGifsNote')}
          checked={prefs.autoplayGifs}
          onChange={(v) => update('autoplayGifs', v)}
        />
        <ToggleRow
          label={t('settings.preferences.prettifyLinks')}
          description={t('settings.preferences.prettifyLinksNote')}
          checked={prefs.prettifyLinks}
          onChange={(v) => update('prettifyLinks', v)}
        />
      </div>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.preferences.notifications')}</h3>
        <ToggleRow
          label={t('settings.preferences.notificationSounds')}
          checked={prefs.notificationSounds}
          onChange={(v) => update('notificationSounds', v)}
        />
        <ToggleRow
          label={t('settings.preferences.notificationBanners')}
          checked={prefs.notificationBanners}
          disabled={!('Notification' in window)}
          onChange={async (v) => {
            if (!v) {
              update('notificationBanners', false);
              return;
            }
            const result = await requestNotificationPermission();
            update('notificationBanners', result === 'granted');
          }}
        />
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
