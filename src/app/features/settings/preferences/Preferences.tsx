import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { ChartBarHorizontalIcon, SmileyIcon, StickerIcon, GifIcon } from '@phosphor-icons/react';
import { preferencesAtom } from '@/app/store/atoms';
import { ToggleRow } from '@/app/components/Toggle';
import { requestNotificationPermission } from '@/app/hooks/useNotifications';
import { STORAGE_KEY } from '@/i18n';
import { vars } from '@/theme/vars.css';
import * as css from '../Settings.css';

const SUPPORTED_LANGUAGES = [
  { code: 'en', labelKey: 'settings.preferences.languageEn' },
  { code: 'de', labelKey: 'settings.preferences.languageDe' },
] as const;

function ComposerToolbarItem({
  icon,
  label,
  inMenu,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  inMenu: boolean;
  onChange: (inMenu: boolean) => void;
}) {
  const btn: React.CSSProperties = {
    padding: '5px 12px',
    fontSize: '0.82rem',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    background: 'transparent',
    color: vars.color.textSecondary,
    transition: 'background-color 0.15s, color 0.15s',
    outline: 'none',
  };

  const btnActive: React.CSSProperties = {
    ...btn,
    backgroundColor: vars.color.accent,
    color: '#fff',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 0',
        borderBottom: `1px solid ${vars.color.border}`,
      }}
    >
      <span style={{ display: 'flex', color: vars.color.textMuted, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: '0.9rem', color: vars.color.textPrimary }}>{label}</span>
      <div
        style={{
          display: 'flex',
          borderRadius: '6px',
          overflow: 'hidden',
          flexShrink: 0,
          border: `1px solid ${vars.color.border}`,
        }}
      >
        <button type="button" style={!inMenu ? btnActive : btn} onClick={() => onChange(false)}>
          Toolbar
        </button>
        <button type="button" style={inMenu ? btnActive : btn} onClick={() => onChange(true)}>
          Menu
        </button>
      </div>
    </div>
  );
}

export function Preferences() {
  const { t, i18n } = useTranslation();
  const [prefs, setPrefs] = useAtom(preferencesAtom);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);
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
        <h3 className={css.sectionTitle}>{t('settings.preferences.composer')}</h3>
        <p className={css.settingNoteBlock}>{t('settings.preferences.composerNote')}</p>

        <div>
          <ComposerToolbarItem
            icon={<ChartBarHorizontalIcon size={18} />}
            label={t('composer.poll.create')}
            inMenu={prefs.composerMenuPoll}
            onChange={(v) => update('composerMenuPoll', v)}
          />
          <ComposerToolbarItem
            icon={<SmileyIcon size={18} />}
            label={t('composer.emoji')}
            inMenu={prefs.composerMenuEmoji}
            onChange={(v) => update('composerMenuEmoji', v)}
          />
          <ComposerToolbarItem
            icon={<StickerIcon size={18} />}
            label={t('composer.stickers')}
            inMenu={prefs.composerMenuSticker}
            onChange={(v) => update('composerMenuSticker', v)}
          />
          <ComposerToolbarItem
            icon={<GifIcon size={18} />}
            label={t('composer.gif')}
            inMenu={prefs.composerMenuGif}
            onChange={(v) => update('composerMenuGif', v)}
          />
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
