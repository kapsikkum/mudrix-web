import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ToggleRow } from '@/app/components/Toggle';
import {
  getDesktopSettings,
  isTauri,
  setDesktopSettings,
  type DesktopSettings,
} from '@/util/desktop';
import * as css from '../Settings.css';

/** Native desktop-shell settings; renders nothing in a browser. */
export function DesktopPreferences() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<DesktopSettings | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    getDesktopSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  if (!isTauri() || !settings) return null;

  const update = (patch: Partial<DesktopSettings>) => {
    setSettings({ ...settings, ...patch });
    setDesktopSettings(patch)
      .then(setSettings)
      .catch(() => getDesktopSettings().then(setSettings));
  };

  return (
    <>
      <div className={css.divider} />

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.preferences.desktop')}</h3>

        <ToggleRow
          label={t('settings.preferences.desktopKeepRunning')}
          description={t('settings.preferences.desktopKeepRunningNote')}
          checked={settings.keepRunningInBackground}
          onChange={(v) => update({ keepRunningInBackground: v })}
        />
        <ToggleRow
          label={t('settings.preferences.desktopLaunchAtLogin')}
          description={t('settings.preferences.desktopLaunchAtLoginNote')}
          checked={settings.launchAtLogin}
          onChange={(v) => update({ launchAtLogin: v })}
        />
        <ToggleRow
          label={t('settings.preferences.desktopStartMinimized')}
          description={t('settings.preferences.desktopStartMinimizedNote')}
          checked={settings.startMinimized}
          disabled={!settings.launchAtLogin}
          onChange={(v) => update({ startMinimized: v })}
        />
      </div>
    </>
  );
}
