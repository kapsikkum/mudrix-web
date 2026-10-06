import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { keybindsAtom, type Keybinds as KeybindsState } from '@/app/store/atoms';
import * as css from '../Settings.css';

type KeybindAction = keyof KeybindsState;

const ACTIONS: { action: KeybindAction; labelKey: string }[] = [
  { action: 'toggleMute', labelKey: 'settings.keybinds.toggleMute' },
  { action: 'toggleDeafen', labelKey: 'settings.keybinds.toggleDeafen' },
  { action: 'toggleVideo', labelKey: 'settings.keybinds.toggleVideo' },
  { action: 'disconnect', labelKey: 'settings.keybinds.disconnect' },
];

export function Keybinds() {
  const { t } = useTranslation();
  const [keybinds, setKeybinds] = useAtom(keybindsAtom);
  const [listening, setListening] = useState<KeybindAction | null>(null);

  const startListening = (action: KeybindAction) => {
    setListening(action);
  };

  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        setListening(null);
        return;
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      setKeybinds((prev) => ({ ...prev, [listening]: key }));
      setListening(null);
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [listening, setKeybinds]);

  const clear = (action: KeybindAction) => {
    setKeybinds((prev) => ({ ...prev, [action]: '' }));
  };

  const displayKey = (key: string) => {
    if (!key) return t('settings.keybinds.clickToSet');
    if (key === 'Escape') return 'Esc';
    return key.toUpperCase();
  };

  return (
    <div>
      <h2 className={css.panelTitle}>{t('settings.keybinds.title')}</h2>

      <div className={css.section}>
        <h3 className={css.sectionTitle}>{t('settings.keybinds.voiceRoom')}</h3>
        {listening && (
          <p className={css.keybindHint}>
            <kbd className={css.kbd}>Esc</kbd>
            {t('settings.keybinds.escToCancel')}
          </p>
        )}
        {ACTIONS.map(({ action, labelKey }) => (
          <div key={action} className={`${css.settingRow} ${css.settingRowClickable}`}>
            <span className={css.settingLabel}>{t(labelKey)}</span>
            <div className={css.flexRow}>
              {keybinds[action] && (
                <button
                  type="button"
                  className={css.clearBtn}
                  onClick={() => clear(action)}
                  aria-label={t('common.clear')}
                >
                  <XIcon size={14} />
                </button>
              )}
              <button
                type="button"
                className={[
                  'keybind-input',
                  listening === action
                    ? css.keybindBtnListening
                    : keybinds[action]
                      ? css.keybindBtnSet
                      : css.keybindBtnEmpty,
                ].join(' ')}
                onClick={() => startListening(action)}
              >
                {listening === action
                  ? t('settings.keybinds.pressAKey')
                  : displayKey(keybinds[action])}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
