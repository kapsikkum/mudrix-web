import { useState } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { LockOpenIcon, InfoIcon } from '@phosphor-icons/react';
import { enterRecoveryKeyModalAtom } from '@/app/store/atoms';
import { Modal } from '@/app/components/Modal';
import { Button } from '@/app/components/Button';
import { vars } from '@/theme/vars.css';
import * as css from './EnterRecoveryKeyModal.css';

export function EnterRecoveryKeyModal() {
  const { t } = useTranslation();
  const [state, setState] = useAtom(enterRecoveryKeyModalAtom);
  const [value, setValue] = useState('');

  const close = (result: string | null) => {
    state.resolve?.(result);
    setState({ open: false, resolve: undefined, canSkip: false });
    setValue('');
  };

  const trimmed = value.trim();

  return (
    <Modal
      open={state.open}
      onClose={() => close(null)}
      title={t('settings.keyBackup.enterRecoveryKeyTitle')}
      size="md"
      zIndex={8500}
      footer={
        <>
          {state.canSkip && (
            <Button
              variant="ghost"
              size="md"
              onClick={() => close(null)}
              style={{ marginRight: 'auto' }}
            >
              {t('settings.keyBackup.skipForNow')}
            </Button>
          )}

          {!state.canSkip && (
            <Button variant="secondary" size="md" onClick={() => close(null)}>
              {t('common.cancel')}
            </Button>
          )}

          <Button
            variant="primary"
            size="md"
            disabled={trimmed.length === 0}
            onClick={() => close(trimmed)}
          >
            <LockOpenIcon size={14} style={{ marginRight: '6px' }} />
            {t('settings.keyBackup.restoreBtn')}
          </Button>
        </>
      }
    >
      {/* Auto-prompt context banner */}
      {state.canSkip && (
        <div className={css.infoBox}>
          <InfoIcon size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
          <span>{t('settings.keyBackup.autoPromptBanner')}</span>
        </div>
      )}

      <p className={css.hint}>
        {t('settings.keyBackup.recoveryKeyHint')}{' '}
        <code style={{ fontFamily: 'monospace', fontSize: '0.9em', color: vars.color.textPrimary }}>
          EsTq XofW VuGm Tele …
        </code>
      </p>

      <textarea
        className={css.textarea}
        placeholder={t('settings.keyBackup.recoveryKeyPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </Modal>
  );
}
