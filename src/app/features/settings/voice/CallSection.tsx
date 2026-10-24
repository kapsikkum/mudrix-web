import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue } from 'jotai';
import { ToggleRow } from '@/app/components/Toggle';
import { elementCallEmbedAtom } from '@/app/store/atoms/elementCall';
import { allowVoiceMovesAtom } from '@/app/store/atoms/settings';
import * as layoutCss from '../Settings.css';

// Element Call's own settings modal is hidden; these are the options it had that Mudrix does not
// already cover (devices and sounds are elsewhere on this page). EC reads them from this origin's
// localStorage as `matrix-setting-<key>`, and a running call picks changes up through the bridge.
type CallSettingKey = 'background-blur' | 'reactions-show' | 'hand-raised-show-timer';

function readSetting(key: CallSettingKey, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(`matrix-setting-${key}`);
    return stored === null ? fallback : JSON.parse(stored) === true;
  } catch {
    return fallback;
  }
}

function useCallSetting(key: CallSettingKey, fallback: boolean): [boolean, (v: boolean) => void] {
  const embed = useAtomValue(elementCallEmbedAtom);
  const [value, setValue] = useState(() => readSetting(key, fallback));
  const update = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(`matrix-setting-${key}`, JSON.stringify(next));
    } catch {
      // Storage unavailable: the change still applies to a running call.
    }
    embed?.control.setSetting(key, next);
  };
  return [value, update];
}

export function CallSection() {
  const { t } = useTranslation();
  const [blur, setBlur] = useCallSetting('background-blur', false);
  const [reactions, setReactions] = useCallSetting('reactions-show', true);
  const [handTimer, setHandTimer] = useCallSetting('hand-raised-show-timer', false);
  const [allowMoves, setAllowMoves] = useAtom(allowVoiceMovesAtom);

  return (
    <div className={layoutCss.section}>
      <h3 className={layoutCss.sectionTitle}>{t('settings.voice.callTitle')}</h3>
      <ToggleRow
        label={t('settings.voice.backgroundBlur')}
        description={t('settings.voice.backgroundBlurNote')}
        checked={blur}
        onChange={setBlur}
      />
      <ToggleRow
        label={t('settings.voice.showReactions')}
        description={t('settings.voice.showReactionsNote')}
        checked={reactions}
        onChange={setReactions}
      />
      <ToggleRow
        label={t('settings.voice.handRaisedTimer')}
        description={t('settings.voice.handRaisedTimerNote')}
        checked={handTimer}
        onChange={setHandTimer}
      />
      <ToggleRow
        label={t('settings.voice.allowMoves')}
        description={t('settings.voice.allowMovesNote')}
        checked={allowMoves}
        onChange={setAllowMoves}
      />
    </div>
  );
}
