import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { keybindsAtom, type Keybinds as KeybindsState } from '@/app/store/atoms';
import { vars } from '@/theme/vars.css';
import * as css from '../Settings.css';

type KeybindAction = keyof KeybindsState;

const ACTIONS: { action: KeybindAction; labelKey: string }[] = [
  { action: 'toggleMute', labelKey: 'settings.keybinds.toggleMute' },
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

  const handleKeyDown = (e: React.KeyboardEvent, action: KeybindAction) => {
    if (listening !== action) return;
    e.preventDefault();
    if (e.key === 'Escape') {
      setListening(null);
      return;
    }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    setKeybinds((prev) => ({ ...prev, [action]: key }));
    setListening(null);
  };

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
        {ACTIONS.map(({ action, labelKey }) => (
          <div key={action} className={css.settingRow}>
            <span className={css.settingLabel}>{t(labelKey)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {keybinds[action] && (
                <button
                  style={{
                    border: 'none',
                    background: 'none',
                    color: vars.color.textMuted,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                  onClick={() => clear(action)}
                >
                  <XIcon size={14} />
                </button>
              )}
              <button
                onKeyDown={(e) => handleKeyDown(e, action)}
                onClick={() => startListening(action)}
                style={{
                  width: '110px',
                  padding: '5px 0',
                  borderRadius: '6px',
                  border:
                    listening === action
                      ? `2px solid ${vars.color.accent}`
                      : keybinds[action]
                        ? `2px solid ${vars.color.border}`
                        : `2px dashed ${vars.color.border}`,
                  backgroundColor:
                    listening === action ? vars.color.bgActive : vars.color.bgTertiary,
                  color:
                    listening === action
                      ? vars.color.accent
                      : keybinds[action]
                        ? vars.color.textPrimary
                        : vars.color.textMuted,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: keybinds[action] ? 600 : 400,
                  letterSpacing: keybinds[action] && !listening ? '0.05em' : 'normal',
                  textAlign: 'center',
                  transition: 'border-color 0.15s, background-color 0.15s, color 0.15s',
                }}
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
