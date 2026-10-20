import { useAtom, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  languageAtom,
  typingIndicatorsAtom,
  sendReadReceiptsAtom,
  showPresenceAtom,
  autoplayGifsAtom,
  mediaVisibilityAtom,
  gifProviderAtom,
  hideMembershipEventsAtom,
  hideProfileEventsAtom,
  timeFormatAtom,
  dateFormatAtom,
  type MediaVisibility,
  type TimeFormatPreference,
  type DateFormatPreference,
} from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { Select } from '@/app/components/Select';
import { DesktopPreferences } from './DesktopPreferences';
import * as css from '../Settings.css';

const MEDIA_VISIBILITY_OPTIONS: Record<MediaVisibility, string> = {
  always: 'settings.preferences.mediaVisibilityAlways',
  private: 'settings.preferences.mediaVisibilityPrivate',
  never: 'settings.preferences.mediaVisibilityNever',
};

const TIME_FORMAT_OPTIONS: Record<TimeFormatPreference, string> = {
  auto: 'settings.preferences.timeFormatAuto',
  '12h': 'settings.preferences.timeFormat12h',
  '24h': 'settings.preferences.timeFormat24h',
};

const DATE_FORMAT_OPTIONS: Record<DateFormatPreference, string> = {
  long: 'settings.preferences.dateFormatLong',
  dmy: 'settings.preferences.dateFormatDmy',
  mdy: 'settings.preferences.dateFormatMdy',
  ymd: 'settings.preferences.dateFormatYmd',
};

export function Preferences() {
  const { t, i18n } = useTranslation();
  const [typingIndicators, setTypingIndicators] = useAtom(typingIndicatorsAtom);
  const [sendReadReceipts, setSendReadReceipts] = useAtom(sendReadReceiptsAtom);
  const [showPresence, setShowPresence] = useAtom(showPresenceAtom);
  const [autoplayGifs, setAutoplayGifs] = useAtom(autoplayGifsAtom);
  const [mediaVisibility, setMediaVisibility] = useAtom(mediaVisibilityAtom);
  const [gifProvider, setGifProvider] = useAtom(gifProviderAtom);
  const [hideMembershipEvents, setHideMembershipEvents] = useAtom(hideMembershipEventsAtom);
  const [hideProfileEvents, setHideProfileEvents] = useAtom(hideProfileEventsAtom);
  const [timeFormat, setTimeFormat] = useAtom(timeFormatAtom);
  const [dateFormat, setDateFormat] = useAtom(dateFormatAtom);
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
        <h3 className={css.sectionTitle}>{t('settings.preferences.timelineDisplay')}</h3>

        <ToggleRow
          label={t('settings.preferences.hideMembershipEvents')}
          description={t('settings.preferences.hideMembershipEventsNote')}
          checked={hideMembershipEvents}
          onChange={setHideMembershipEvents}
        />
        <ToggleRow
          label={t('settings.preferences.hideProfileEvents')}
          description={t('settings.preferences.hideProfileEventsNote')}
          checked={hideProfileEvents}
          onChange={setHideProfileEvents}
        />
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.preferences.timeFormat')}</span>
          </div>
          <Select<TimeFormatPreference>
            aria-label={t('settings.preferences.timeFormat')}
            value={timeFormat}
            options={(Object.keys(TIME_FORMAT_OPTIONS) as TimeFormatPreference[]).map((option) => ({
              value: option,
              label: t(TIME_FORMAT_OPTIONS[option]),
            }))}
            onChange={setTimeFormat}
          />
        </div>
        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.preferences.dateFormat')}</span>
          </div>
          <Select<DateFormatPreference>
            aria-label={t('settings.preferences.dateFormat')}
            value={dateFormat}
            options={(Object.keys(DATE_FORMAT_OPTIONS) as DateFormatPreference[]).map((option) => ({
              value: option,
              label: t(DATE_FORMAT_OPTIONS[option]),
            }))}
            onChange={setDateFormat}
          />
        </div>
      </div>

      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.preferences.gifs')}</h3>

        <div className={css.settingRow}>
          <div className={css.settingInfo}>
            <span className={css.settingLabel}>{t('settings.preferences.gifProvider')}</span>
          </div>
          <Select
            aria-label={t('settings.preferences.gifProvider')}
            value={gifProvider}
            options={[
              { value: 'giphy', label: 'GIPHY' },
              { value: 'klipy', label: 'KLIPY' },
            ]}
            onChange={(v) => setGifProvider(v === 'klipy' ? 'klipy' : 'giphy')}
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

      <DesktopPreferences />
    </div>
  );
}
