import { useState, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Editor, Transforms, Element, Range } from 'slate';
import { ReactEditor } from 'slate-react';
import { promptModalAtom } from '@/app/store/atoms';
import { toggleMark, toggleBlock, isMarkActive, isBlockActive } from './editor/keyboard';
import type { CustomEditor, LinkElement } from './editor/types';
import type { FormatType } from './FormatToolbar';

interface UseFormatToolbarOptions {
  editor: CustomEditor;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useFormatToolbar({ editor, containerRef }: UseFormatToolbarOptions) {
  const { t } = useTranslation();
  const setPrompt = useSetAtom(promptModalAtom);
  const [toolbar, setToolbar] = useState<{
    top: number;
    left: number;
    activeFormats: FormatType[];
  } | null>(null);

  const resetToolbar = useCallback(() => setToolbar(null), []);

  const updateToolbar = useCallback(() => {
    const { selection } = editor;
    const wrap = containerRef.current;
    if (!wrap || !selection || Range.isCollapsed(selection)) {
      setToolbar(null);
      return;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setToolbar(null);
      return;
    }
    const domRange = domSelection.getRangeAt(0);
    const rect = domRange.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();

    const activeFormats = detectActiveFormats(editor);
    setToolbar({
      top: rect.top - wrapRect.top - 44,
      left: Math.max(0, rect.left - wrapRect.left),
      activeFormats,
    });
  }, [editor, containerRef]);

  const applyFormat = useCallback(
    async (fmt: FormatType, e?: React.MouseEvent) => {
      e?.preventDefault();

      if (fmt === 'link') {
        const { selection } = editor;
        const selectedText =
          selection && !Range.isCollapsed(selection) ? Editor.string(editor, selection) : '';

        const url = await new Promise<string | null>((resolve) => {
          setPrompt({
            open: true,
            title: t('composer.enterUrl'),
            message: '',
            defaultValue: '',
            resolve,
          });
        });
        if (!url) {
          ReactEditor.focus(editor);
          return;
        }

        const link: LinkElement = {
          type: 'link',
          url,
          children: [{ text: selectedText || url }],
        };
        if (selection && !Range.isCollapsed(selection)) {
          Transforms.wrapNodes(editor, link, { split: true });
          Transforms.collapse(editor, { edge: 'end' });
        } else {
          Transforms.insertNodes(editor, link);
        }
        setToolbar(null);
        ReactEditor.focus(editor);
        return;
      }

      if (fmt === 'quote') {
        toggleBlock(editor, 'block-quote');
        setToolbar(null);
        ReactEditor.focus(editor);
        return;
      }

      const markMap: Partial<Record<FormatType, 'bold' | 'italic' | 'strikethrough' | 'code'>> = {
        bold: 'bold',
        italic: 'italic',
        strike: 'strikethrough',
        code: 'code',
      };
      const mark = markMap[fmt];
      if (mark) {
        toggleMark(editor, mark);
        setToolbar(null);
        ReactEditor.focus(editor);
      }
    },
    [editor, setPrompt, t]
  );

  return { toolbar, updateToolbar, applyFormat, resetToolbar };
}

function detectActiveFormats(editor: CustomEditor): FormatType[] {
  const active: FormatType[] = [];

  if (isMarkActive(editor, 'bold')) active.push('bold');
  if (isMarkActive(editor, 'italic')) active.push('italic');
  if (isMarkActive(editor, 'strikethrough')) active.push('strike');
  if (isMarkActive(editor, 'code')) active.push('code');
  if (isBlockActive(editor, 'block-quote')) active.push('quote');

  const [linkMatch] = Editor.nodes(editor, {
    match: (n) => Element.isElement(n) && n.type === 'link',
  });
  if (linkMatch) active.push('link');

  return active;
}
