import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { keyboardShortcutsOpenAtom } from '@/app/store/atoms';
import { MODIFIER_KEY } from '@/app/util/platform';
import { Dialog } from '@/app/components/Dialog/Dialog';
import * as css from './KeyboardShortcutsHelp.css';

const SHORTCUTS: { keys: string; labelKey: string }[] = [
  { keys: `${MODIFIER_KEY} + K`, labelKey: 'keyboardShortcuts.searchGlobal' },
  { keys: `${MODIFIER_KEY} + F`, labelKey: 'keyboardShortcuts.searchInRoom' },
  { keys: 'Escape', labelKey: 'keyboardShortcuts.close' },
  { keys: 'Enter', labelKey: 'keyboardShortcuts.send' },
  { keys: `Shift + Enter`, labelKey: 'keyboardShortcuts.newLine' },
  { keys: `${MODIFIER_KEY} + /`, labelKey: 'keyboardShortcuts.showHelp' },
];

export function KeyboardShortcutsHelp() {
  const { t } = useTranslation();
  const [open, setOpen] = useAtom(keyboardShortcutsOpenAtom);

  const close = useCallback(() => setOpen(false), [setOpen]);

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('keyboardShortcuts.title')}
      size="md"
      zIndex={9500}
    >
      <div className={css.list}>
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className={css.row}>
            <span>{t(s.labelKey)}</span>
            <span className={css.kbd}>{s.keys}</span>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
