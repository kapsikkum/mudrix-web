import { useState, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { promptModalAtom } from '@/app/store/atoms';
import type { FormatType } from './FormatToolbar';

interface UseFormatToolbarOptions {
  value: string;
  setValue: (val: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useFormatToolbar({
  value,
  setValue,
  textareaRef,
  containerRef,
}: UseFormatToolbarOptions) {
  const { t } = useTranslation();
  const setPrompt = useSetAtom(promptModalAtom);
  const [toolbar, setToolbar] = useState<{
    top: number;
    left: number;
    activeFormats: FormatType[];
  } | null>(null);

  const resetToolbar = useCallback(() => setToolbar(null), []);

  const updateToolbar = useCallback(() => {
    const el = textareaRef.current;
    const wrap = containerRef.current;
    if (!el || !wrap) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      setToolbar(null);
      return;
    }
    const elRect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    const activeFormats = detectActiveFormats(value, start, end);
    setToolbar({ top: elRect.top - wrapRect.top - 44, left: 0, activeFormats });
  }, [value, textareaRef, containerRef]);

  const applyFormat = useCallback(
    async (fmt: FormatType, e?: React.MouseEvent) => {
      e?.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);

      if (fmt === 'link') {
        const url = await new Promise<string | null>((resolve) => {
          setPrompt({
            open: true,
            title: t('composer.enterUrl'),
            message: '',
            defaultValue: 'https://',
            resolve,
          });
        });
        if (!url) {
          el.focus();
          return;
        }
        const label = selected || url;
        const insertion = `[${label}](${url})`;
        const newVal = value.slice(0, start) + insertion + value.slice(end);
        setValue(newVal);
        setToolbar(null);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + insertion.length, start + insertion.length);
        }, 0);
        return;
      }

      const MAP: Record<FormatType, [string, string]> = {
        bold: ['**', '**'],
        italic: ['*', '*'],
        strike: ['~~', '~~'],
        code: ['`', '`'],
        quote: ['> ', ''],
        link: ['', ''],
      };
      const [pre, post] = MAP[fmt];
      const newVal = value.slice(0, start) + pre + selected + post + value.slice(end);
      setValue(newVal);
      setToolbar(null);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + pre.length, end + pre.length);
      }, 0);
    },
    [value, setValue, setPrompt, t, textareaRef]
  );

  return { toolbar, updateToolbar, applyFormat, resetToolbar };
}

function detectActiveFormats(value: string, start: number, end: number): FormatType[] {
  const active: FormatType[] = [];
  const selected = value.slice(start, end);
  const before2 = value.slice(Math.max(0, start - 2), start);
  const after2 = value.slice(end, end + 2);
  const before1 = value[start - 1] ?? '';
  const after1 = value[end] ?? '';

  if (
    (before2 === '**' && after2 === '**') ||
    (selected.startsWith('**') && selected.endsWith('**'))
  ) {
    active.push('bold');
  }

  if (
    (before1 === '*' && before2 !== '**' && after1 === '*' && after2 !== '**') ||
    (selected.startsWith('*') &&
      !selected.startsWith('**') &&
      selected.endsWith('*') &&
      !selected.endsWith('**'))
  ) {
    active.push('italic');
  }

  if (
    (before2 === '~~' && after2 === '~~') ||
    (selected.startsWith('~~') && selected.endsWith('~~'))
  ) {
    active.push('strike');
  }

  if ((before1 === '`' && after1 === '`') || (selected.startsWith('`') && selected.endsWith('`'))) {
    active.push('code');
  }

  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  if (value.slice(lineStart, lineStart + 2) === '> ') {
    active.push('quote');
  }

  if (/^\[([^\]]*)\]\(([^)]*)\)$/.test(selected)) {
    active.push('link');
  }

  return active;
}
