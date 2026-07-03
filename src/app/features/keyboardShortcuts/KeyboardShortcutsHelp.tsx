import { useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { keyboardShortcutsOpenAtom } from '@/app/store/atoms';
import { MODIFIER_KEY } from '@/app/util/platform';
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
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), [setOpen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => dialogRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div className={css.overlay} onClick={close}>
      <div
        className={css.dialog}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={css.header}>
          <span className={css.title}>{t('keyboardShortcuts.title')}</span>
          <button
            type="button"
            className={css.closeBtn}
            onClick={close}
            aria-label={t('common.close')}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className={css.list}>
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className={css.row}>
              <span>{t(s.labelKey)}</span>
              <span className={css.kbd}>{s.keys}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
