import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { SmileyIcon } from '@phosphor-icons/react';
import { ReactEditor } from 'slate-react';
import { optimisticEditBodiesAtom } from '@/app/store/atoms';
import type { EditMessageState } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getMatrixClient } from '@/client/initMatrix';
import { FormatToolbar } from '@/app/features/timeline/composer/FormatToolbar';
import { RichComposer } from '@/app/features/timeline/composer/editor/RichComposer';
import { fromMarkdown } from '@/app/features/timeline/composer/editor/fromMarkdown';
import { toMarkdown } from '@/app/features/timeline/composer/editor/toMarkdown';
import { buildTextContent } from '@/app/features/timeline/composer/editor/buildTextContent';
import { insertEmoji } from '@/app/features/timeline/composer/editor/insertEmoji';
import { useRichEditor } from '@/app/features/timeline/composer/useRichEditor';
import { AutocompleteDropdown } from '@/app/features/timeline/AutocompleteDropdown';
import { EmojiPicker } from '@/app/features/timeline/EmojiPicker';
import * as css from '../Timeline.css';

interface EditMessageComposerProps {
  client: MatrixClient;
  editState: EditMessageState;
  onClose: () => void;
}

export function EditMessageComposer({ client, editState, onClose }: EditMessageComposerProps) {
  const { t } = useTranslation();
  const setOptimisticEditBodies = useSetAtom(optimisticEditBodiesAtom);
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const emojiAreaRef = useRef<HTMLDivElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const {
    editor,
    value,
    setValue,
    toolbar,
    updateToolbar,
    applyFormat,
    autocomplete,
    handleChange,
    handleKeyDown,
    handleAutocompleteSelect,
    isEmpty,
  } = useRichEditor({
    client,
    roomId: editState.roomId,
    containerRef,
    onEscape: onClose,
    disableCommands: true,
  });

  useEffect(() => {
    const nodes = fromMarkdown(editState.body);
    editor.children = nodes;
    setValue([...nodes]);
    const timer = setTimeout(() => {
      try {
        ReactEditor.focus(editor);
      } catch {
        // editor may not be mounted yet
      }
      containerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editState.eventId, editState.body]);

  const saveEdit = useCallback(() => {
    const { markdown } = toMarkdown(value);
    const newBody = markdown.trim();
    if (!newBody || newBody === editState.body) {
      onClose();
      return;
    }

    setOptimisticEditBodies((prev) => new Map([...prev, [editState.eventId, newBody]]));
    onClose();

    const mx = getMatrixClient();
    const built = buildTextContent(value);
    const replaceContent: Record<string, unknown> = {
      msgtype: 'm.text',
      body: `* ${built.body}`,
      'm.new_content': built.content,
      'm.relates_to': {
        rel_type: 'm.replace',
        event_id: editState.eventId,
      },
    };
    if (built.content.format) {
      replaceContent.format = built.content.format;
      replaceContent.formatted_body = built.content.formatted_body;
    }
    if (built.mentionedUserIds.length > 0) {
      replaceContent['m.mentions'] = { user_ids: built.mentionedUserIds };
    }
    mx.sendMessage(editState.roomId, replaceContent as unknown as RoomMessageEventContent)
      .then(() => {
        setOptimisticEditBodies((prev) => {
          const next = new Map(prev);
          next.delete(editState.eventId);
          return next;
        });
      })
      .catch((err) => {
        setOptimisticEditBodies((prev) => {
          const next = new Map(prev);
          next.delete(editState.eventId);
          return next;
        });
        toast.error(t('timeline.editFailed', { error: getErrorMessage(err) }));
      });
  }, [value, editState, onClose, setOptimisticEditBodies, toast, t]);

  const handlePickEmoji = useCallback(
    (emoji: string, mxcUrl?: string) => {
      insertEmoji(editor, emoji, mxcUrl);
      setEmojiOpen(false);
    },
    [editor]
  );

  useEffect(() => {
    if (!emojiOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (emojiAreaRef.current && !emojiAreaRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmojiOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [emojiOpen]);

  return (
    <div className={css.editContainer} ref={containerRef}>
      <AutocompleteDropdown
        state={autocomplete.state}
        client={client}
        onSelect={handleAutocompleteSelect}
        anchorRef={containerRef}
      />
      <RichComposer
        editor={editor}
        value={value}
        onChange={handleChange}
        onSend={saveEdit}
        onKeyDown={handleKeyDown}
        onSelectionChange={updateToolbar}
        placeholder={t('timeline.editPlaceholder')}
        className={css.editRichEditor}
        autoFocus
        client={client}
      />
      {toolbar && (
        <FormatToolbar
          top={toolbar.top}
          left={toolbar.left}
          activeFormats={toolbar.activeFormats}
          onFormat={applyFormat}
        />
      )}
      <div className={css.editActions}>
        <div ref={emojiAreaRef} className={css.editEmojiArea}>
          <button
            type="button"
            className={css.editEmojiBtn}
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label={t('composer.emoji')}
          >
            <SmileyIcon size={18} weight={emojiOpen ? 'fill' : 'regular'} />
          </button>
          {emojiOpen && (
            <div className={css.editEmojiPicker}>
              <EmojiPicker
                embedded
                naked
                client={client}
                roomId={editState.roomId}
                onPick={handlePickEmoji}
                onClose={() => setEmojiOpen(false)}
              />
            </div>
          )}
        </div>
        <button type="button" className={css.editBtnCancel} onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="button" className={css.editBtnSave} onClick={saveEdit} disabled={isEmpty}>
          {t('common.save')}
        </button>
      </div>
    </div>
  );
}
