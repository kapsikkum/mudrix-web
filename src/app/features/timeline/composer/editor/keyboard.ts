import type { KeyboardEvent } from 'react';
import { Editor, Transforms, Element } from 'slate';
import type { CustomEditor } from './types';

const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

function isMod(e: KeyboardEvent): boolean {
  return isMac ? e.metaKey : e.ctrlKey;
}

export function handleEditorKeyDown(e: KeyboardEvent, editor: CustomEditor): boolean {
  if (!isMod(e)) return false;

  switch (e.key) {
    case 'b':
    case 'B':
      toggleMark(editor, 'bold');
      return true;
    case 'i':
    case 'I':
      toggleMark(editor, 'italic');
      return true;
    case 's':
    case 'S':
      if (e.shiftKey) {
        toggleMark(editor, 'strikethrough');
        return true;
      }
      return false;
    case 'e':
    case 'E':
      toggleMark(editor, 'code');
      return true;
    default:
      return false;
  }
}

export type MarkKey = 'bold' | 'italic' | 'strikethrough' | 'code';

export function isMarkActive(editor: CustomEditor, mark: MarkKey): boolean {
  const marks = Editor.marks(editor);
  return marks ? marks[mark] === true : false;
}

export function toggleMark(editor: CustomEditor, mark: MarkKey): void {
  if (isMarkActive(editor, mark)) {
    Editor.removeMark(editor, mark);
  } else {
    Editor.addMark(editor, mark, true);
  }
}

export type BlockType = 'paragraph' | 'block-quote' | 'code-block';

export function isBlockActive(editor: CustomEditor, blockType: BlockType): boolean {
  const [match] = Editor.nodes(editor, {
    match: (n) => Element.isElement(n) && n.type === blockType,
  });
  return !!match;
}

export function toggleBlock(editor: CustomEditor, blockType: BlockType): void {
  const isActive = isBlockActive(editor, blockType);
  Transforms.setNodes(
    editor,
    { type: isActive ? 'paragraph' : blockType },
    { match: (n) => Element.isElement(n) && Editor.isBlock(editor, n) }
  );
}
