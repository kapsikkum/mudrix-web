import { useState, useCallback, useRef } from 'react';
import { Editor, Transforms, Element, Range } from 'slate';
import { ReactEditor } from 'slate-react';
import { toggleMark, toggleBlock, isMarkActive, isBlockActive } from './editor/keyboard';
import type { CustomEditor, LinkElement } from './editor/types';
import type { FormatType } from './FormatToolbar';

interface UseFormatToolbarOptions {
  editor: CustomEditor;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useFormatToolbar({ editor, containerRef }: UseFormatToolbarOptions) {
  const [toolbar, setToolbar] = useState<{
    top: number;
    left: number;
    activeFormats: FormatType[];
  } | null>(null);
  const [linkPopover, setLinkPopover] = useState<{
    defaultValue: string;
    position: { top: number; left: number };
  } | null>(null);
  const pendingLinkRef = useRef<((url: string | null) => void) | null>(null);
  const toolbarPosRef = useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  const closeLinkPopover = useCallback(() => {
    pendingLinkRef.current = null;
    setLinkPopover(null);
  }, []);

  const submitLink = useCallback(
    (url: string) => {
      pendingLinkRef.current?.(url);
      closeLinkPopover();
      ReactEditor.focus(editor);
    },
    [editor, closeLinkPopover]
  );

  const cancelLink = useCallback(() => {
    pendingLinkRef.current?.(null);
    closeLinkPopover();
    ReactEditor.focus(editor);
  }, [editor, closeLinkPopover]);

  const resetToolbar = useCallback(() => setToolbar(null), []);

  const updateToolbar = useCallback(() => {
    const wrap = containerRef.current;
    if (!wrap) {
      setToolbar(null);
      return;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setToolbar(null);
      return;
    }

    const selection = editor.selection;
    const isCollapsed = domSelection.isCollapsed || domSelection.getRangeAt(0).collapsed;

    if (isCollapsed) {
      if (selection && !Range.isCollapsed(selection)) {
        const range = ReactEditor.toSlateRange(editor, domSelection, {
          exactMatch: false,
          suppressThrow: true,
        });
        if (range) Transforms.select(editor, range);
      }
      setToolbar(null);
      return;
    }

    const domRange = domSelection.getRangeAt(0);
    const rect = domRange.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();

    const activeFormats = detectActiveFormats(editor);
    toolbarPosRef.current = {
      top: rect.top - wrapRect.top - 44,
      left: Math.max(0, rect.left - wrapRect.left),
    };
    setToolbar({
      top: toolbarPosRef.current.top,
      left: toolbarPosRef.current.left,
      activeFormats,
    });
  }, [editor, containerRef]);

  const applyFormat = useCallback(
    async (fmt: FormatType, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      if (fmt === 'link') {
        const { selection } = editor;
        const selectedText =
          selection && !Range.isCollapsed(selection) ? Editor.string(editor, selection) : '';

        const [linkMatch] = Editor.nodes(editor, {
          at: selection ?? undefined,
          match: (n) => Element.isElement(n) && n.type === 'link',
        });
        const existingUrl = linkMatch ? (linkMatch[0] as LinkElement).url : '';

        pendingLinkRef.current?.(null);
        setLinkPopover({ defaultValue: existingUrl, position: toolbarPosRef.current });

        const url = await new Promise<string | null>((resolve) => {
          pendingLinkRef.current = resolve;
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
    [editor]
  );

  return { toolbar, updateToolbar, applyFormat, resetToolbar, linkPopover, submitLink, cancelLink };
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
