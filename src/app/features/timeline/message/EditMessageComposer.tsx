import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { SmileyIcon } from '@phosphor-icons/react';
import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { optimisticEditBodiesAtom } from '@/app/store/atoms';
import type { EditMessageState } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { FormatToolbar } from '@/app/features/timeline/composer/FormatToolbar';
import { RichComposer } from '@/app/features/timeline/composer/editor/RichComposer';
import {
  fromMarkdown,
  type MentionResolver,
} from '@/app/features/timeline/composer/editor/fromMarkdown';
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

function buildMentionResolver(
  mx: MatrixClient,
  roomId: string,
  eventId: string
): MentionResolver | undefined {
  const room = mx.getRoom(roomId);
  const original = room?.findEventById(eventId);
  if (!original) return undefined;

  const content = original.getContent() as Record<string, unknown>;
  const tokens: MentionResolver['tokens'] = [];
  const seen = new Set<string>();

  const add = (token: string, userId: string, displayName: string) => {
    if (token.length < 2 || seen.has(token)) return;
    seen.add(token);
    tokens.push({ token, userId, displayName });
  };

  const formattedBody = content.formatted_body as string | undefined;
  if (typeof formattedBody === 'string') {
    const anchorRe = /<a[^>]+href="https:\/\/matrix\.to\/#\/(@[^"]+)"[^>]*>([^<]*)<\/a>/g;
    for (const m of formattedBody.matchAll(anchorRe)) {
      const userId = m[1];
      const label = m[2];
      const displayName = label.replace(/^@/, '');
      if (!displayName) continue;
      add(label.startsWith('@') ? label : `@${label}`, userId, displayName);
    }
  }

  const mentioned = (content['m.mentions'] as { user_ids?: string[] } | undefined)?.user_ids;
  if (Array.isArray(mentioned)) {
    for (const userId of mentioned) {
      const name = room?.getMember(userId)?.name ?? userId;
      add(`@${name}`, userId, name);
    }
  }

  tokens.sort((a, b) => b.token.length - a.token.length);
  return tokens.length > 0 ? { tokens } : undefined;
}

export function EditMessageComposer({ client, editState, onClose }: EditMessageComposerProps) {
  const { t } = useTranslation();
  const setOptimisticEditBodies = useSetAtom(optimisticEditBodiesAtom);
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const emojiAreaRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
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
    const resolver = buildMentionResolver(client, editState.roomId, editState.eventId);
    const nodes = fromMarkdown(editState.body, resolver);
    editor.children = nodes;
    setValue([...nodes]);
    const timer = setTimeout(() => {
      try {
        if (editor.children.length > 0) {
          Transforms.select(editor, Editor.end(editor, []));
        }
        ReactEditor.focus(editor);
      } catch {
        // editor may not be mounted yet
      }
      containerRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editState.eventId, editState.body, client]);

  const saveEdit = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const { markdown } = toMarkdown(value);
      const newBody = markdown.trim();
      if (!newBody || newBody === editState.body) {
        onClose();
        return;
      }

      setOptimisticEditBodies((prev) => new Map([...prev, [editState.eventId, newBody]]));
      onClose();

      const built = buildTextContent(value, { myId: client.getUserId() ?? undefined });

      // Union the mentions typed in the editor with the ones from the original
      // message so an edit doesn't silently drop previously notified users.
      const prevMentions = client
        .getRoom(editState.roomId)
        ?.findEventById(editState.eventId)
        ?.getContent()['m.mentions']?.user_ids;
      const allMentions = new Set(built.mentionedUserIds);
      if (Array.isArray(prevMentions)) {
        prevMentions.forEach((id) => allMentions.add(id));
      }
      const mentions = allMentions.size > 0 ? { user_ids: Array.from(allMentions) } : {};

      const newContent: Record<string, unknown> = {
        ...built.content,
        msgtype: editState.msgtype,
        'm.mentions': mentions,
      };
      const replaceContent: Record<string, unknown> = {
        msgtype: editState.msgtype,
        body: `* ${built.body}`,
        'm.new_content': newContent,
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: editState.eventId,
        },
        'm.mentions': mentions,
      };
      if (built.content.format) {
        replaceContent.format = built.content.format;
        replaceContent.formatted_body = built.content.formatted_body;
      }
      await client.sendMessage(
        editState.roomId,
        replaceContent as unknown as RoomMessageEventContent
      );
      setOptimisticEditBodies((prev) => {
        const next = new Map(prev);
        next.delete(editState.eventId);
        return next;
      });
    } catch (err) {
      setOptimisticEditBodies((prev) => {
        const next = new Map(prev);
        next.delete(editState.eventId);
        return next;
      });
      toast.error(t('timeline.editFailed', { error: getErrorMessage(err) }));
    } finally {
      savingRef.current = false;
    }
  }, [value, editState, client, onClose, setOptimisticEditBodies, toast, t]);

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
