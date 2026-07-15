import { useCallback, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Slate, Editable, type RenderElementProps, type RenderLeafProps } from 'slate-react';
import type { Descendant } from 'slate';
import type { CustomEditor } from './types';
import { Element, Leaf } from './Elements';
import { handleEditorKeyDown } from './keyboard';

export interface RichComposerProps {
  editor: CustomEditor;
  value: Descendant[];
  onChange: (value: Descendant[]) => void;
  onSend: () => void;
  onEscape?: () => void;
  onSelectionChange?: () => void;
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  autoFocus?: boolean;
  readOnly?: boolean;
}

const renderElement = (props: RenderElementProps) => <Element {...props} />;
const renderLeaf = (props: RenderLeafProps) => <Leaf {...props} />;

export function RichComposer({
  editor,
  value,
  onChange,
  onSend,
  onEscape,
  onSelectionChange,
  onPaste,
  placeholder,
  className,
  onKeyDown: externalKeyDown,
  autoFocus,
  readOnly,
}: RichComposerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (externalKeyDown) {
        externalKeyDown(e);
        if (e.defaultPrevented) return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
        return;
      }

      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (handleEditorKeyDown(e, editor)) {
        e.preventDefault();
      }
    },
    [editor, onSend, onEscape, externalKeyDown]
  );

  const handleChange = useCallback(
    (newValue: Descendant[]) => {
      onChange(newValue);
      onSelectionChange?.();
    },
    [onChange, onSelectionChange]
  );

  return (
    <Slate editor={editor} initialValue={value} onValueChange={handleChange}>
      <Editable
        className={className}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onSelect={onSelectionChange}
        onPaste={onPaste}
        autoFocus={autoFocus}
        readOnly={readOnly}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
      />
    </Slate>
  );
}
