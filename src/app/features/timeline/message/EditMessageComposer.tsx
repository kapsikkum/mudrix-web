import { useCallback, useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSetAtom } from 'jotai';
import { MatrixEventEvent } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import {
  optimisticEditBodiesAtom,
  editMessageAtom,
  editComposerEmojiInserterAtom,
} from '@/app/store/atoms';
import type { EditMessageState } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { FormatToolbar } from '@/app/features/timeline/composer/FormatToolbar';
import { LinkInputPopover } from '@/app/features/timeline/composer/LinkInputPopover';
import { RichComposer } from '@/app/features/timeline/composer/editor/RichComposer';
import {
  fromMarkdown,
  type MentionResolver,
} from '@/app/features/timeline/composer/editor/fromMarkdown';
import { toMarkdown } from '@/app/features/timeline/composer/editor/toMarkdown';
import { buildTextContent } from '@/app/features/timeline/composer/editor/buildTextContent';
import { insertEmoji } from '@/app/features/timeline/composer/editor/insertEmoji';
import { useRichEditor } from '@/app/features/timeline/composer/useRichEditor';
import { resolveRelationTarget } from './relationTarget';
import { AutocompleteDropdown } from '@/app/features/timeline/AutocompleteDropdown';
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
  const setEditMessage = useSetAtom(editMessageAtom);
  const setEditComposerEmojiInserter = useSetAtom(editComposerEmojiInserterAtom);
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const autocompleteListId = useId();

  const {
    editor,
    value,
    setValue,
    toolbar,
    updateToolbar,
    applyFormat,
    linkPopover,
    submitLink,
    cancelLink,
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

  const draftRef = useRef(value);
  draftRef.current = value;
  useEffect(() => {
    const eventId = editState.eventId;
    if (!eventId.startsWith('~')) return;
    const room = client.getRoom(editState.roomId);
    const pending = room?.getPendingEvents().find((e) => e.getId() === eventId);
    if (!pending) return;

    const onReplaced = () => {
      const newId = pending.getId();
      if (!newId?.startsWith('$')) return;
      setEditMessage((prev) => {
        if (!prev || prev.eventId !== eventId) return prev;
        let body = prev.body;
        try {
          const { markdown } = toMarkdown(draftRef.current);
          if (markdown.trim()) body = markdown;
        } catch {
          // keep previous body on serialization failure
        }
        return { ...prev, eventId: newId, body };
      });
    };
    pending.once(MatrixEventEvent.LocalEventIdReplaced, onReplaced);
    return () => {
      pending.removeListener(MatrixEventEvent.LocalEventIdReplaced, onReplaced);
    };
  }, [client, editState.roomId, editState.eventId, setEditMessage]);

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

      const built = buildTextContent(value, {
        myId: client.getUserId() ?? undefined,
      });

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
      const builtMentions =
        (built.content['m.mentions'] as { user_ids?: string[]; room?: boolean } | undefined) ?? {};
      const mentions: Record<string, unknown> =
        allMentions.size > 0 ? { user_ids: Array.from(allMentions) } : {};
      if (builtMentions.room) mentions.room = true;

      const prevRoomMentioned =
        client.getRoom(editState.roomId)?.findEventById(editState.eventId)?.getContent()[
          'm.mentions'
        ]?.room === true;
      if (prevRoomMentioned) mentions.room = true;

      const newContent: Record<string, unknown> = {
        ...built.content,
        msgtype: editState.msgtype,
        'm.mentions': mentions,
      };
      const targetId = await resolveRelationTarget(client, editState.roomId, editState.eventId);
      const replaceContent: Record<string, unknown> = {
        msgtype: editState.msgtype,
        body: `* ${built.body}`,
        'm.new_content': newContent,
        'm.relates_to': {
          rel_type: 'm.replace',
          event_id: targetId,
        },
        'm.mentions': mentions,
      };
      if (built.content.format) {
        replaceContent.format = built.content.format;
        replaceContent.formatted_body = built.content.formatted_body;
      }
      await client.sendMessage(
        editState.roomId,
        editState.threadId ?? null,
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

  useEffect(() => {
    setEditComposerEmojiInserter(
      () => (emoji: string, mxcUrl?: string) => insertEmoji(editor, emoji, mxcUrl)
    );
    return () => setEditComposerEmojiInserter(null);
  }, [setEditComposerEmojiInserter, editor]);

  return (
    <div className={css.editContainer} ref={containerRef}>
      <AutocompleteDropdown
        state={autocomplete.state}
        client={client}
        onSelect={handleAutocompleteSelect}
        anchorRef={containerRef}
        listId={autocompleteListId}
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
        ariaLabel={t('timeline.editPlaceholder')}
        autocompleteListId={autocompleteListId}
        autocompleteOpen={autocomplete.state.open && autocomplete.state.suggestions.length > 0}
        autocompleteActiveId={
          autocomplete.state.open && autocomplete.state.suggestions.length > 0
            ? `${autocompleteListId}-option-${autocomplete.state.selectedIndex}`
            : undefined
        }
      />
      {toolbar && (
        <FormatToolbar
          top={toolbar.top}
          left={toolbar.left}
          activeFormats={toolbar.activeFormats}
          onFormat={applyFormat}
        />
      )}
      {linkPopover && (
        <LinkInputPopover
          defaultUrl={linkPopover.defaultValue}
          position={linkPopover.position}
          onSubmit={submitLink}
          onCancel={cancelLink}
        />
      )}
      <div className={css.editActions}>
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
