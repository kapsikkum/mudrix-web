import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  preferencesAtom,
  serverUploadLimitAtom,
  attachmentPreviewAtom,
  attachmentPendingSendAtom,
  mentionInsertAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { createEditor, Transforms, type Descendant, Node, Element } from 'slate';
import { withReact, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { useAutocomplete } from '../useAutocomplete';
import type { Suggestion } from '../useAutocomplete';
import { uploadEncryptedFile, buildMediaMessageContent } from '../encryptedMedia';
import { getMediaCacheKey, setCachedBlobUrl } from '../message/mediaCache';
import { parseCommand, getCommandDefinition } from './commands';
import { useFormatToolbar } from './useFormatToolbar';
import type { FormatType } from './FormatToolbar';
import type { CommandContext } from './commands';
import { toMarkdown, toHtml } from './editor/toMarkdown';
import { emptyDocument, withMentions } from './editor/types';
import type { CustomEditor, MentionElement } from './editor/types';

interface UseComposerOptions {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  replyTo: MatrixEvent | null;
  onClearReply: () => void;
  onSent?: () => void;
  droppedFile?: File | null;
  onDroppedFileConsumed?: () => void;
}

export interface ComposerState {
  editor: CustomEditor;
  editorValue: Descendant[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  composerWrapRef: React.RefObject<HTMLDivElement | null>;

  toolbar: { top: number; left: number; activeFormats: FormatType[] } | null;
  autocomplete: ReturnType<typeof useAutocomplete>;

  uploadProgress: number | null;
  uploadFileInfo: { name: string; size: number } | null;

  cancelUpload: () => void;
  handleEditorChange: (value: Descendant[]) => void;
  handleEditorKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  handlePaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAutocompleteSelect: (suggestion: Suggestion) => void;
  applyFormat: (fmt: FormatType, e?: React.MouseEvent) => Promise<void>;
  updateToolbar: () => void;
  sendMessage: () => Promise<void>;
  isEmpty: boolean;
}

export function useComposer({
  client,
  roomId,
  threadId,
  replyTo,
  onClearReply,
  onSent,
  droppedFile,
  onDroppedFileConsumed,
}: UseComposerOptions): ComposerState {
  const { t } = useTranslation();
  const prefs = useAtomValue(preferencesAtom);
  const maxUploadBytes = useAtomValue(serverUploadLimitAtom);
  const [mentionInsert, setMentionInsert] = useAtom(mentionInsertAtom);
  const toast = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);

  const editor = useMemo(
    () => withMentions(withHistory(withReact(createEditor() as CustomEditor))),
    []
  );

  const [editorValue, setEditorValue] = useState<Descendant[]>(() => emptyDocument());

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const autocomplete = useAutocomplete(client, roomId);

  const { toolbar, updateToolbar, applyFormat, resetToolbar } = useFormatToolbar({
    editor,
    containerRef: composerWrapRef,
  });

  const attachmentPreview = useAtomValue(attachmentPreviewAtom);
  const setAttachmentPreview = useSetAtom(attachmentPreviewAtom);
  const pendingSend = useAtomValue(attachmentPendingSendAtom);
  const setPendingSend = useSetAtom(attachmentPendingSendAtom);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadFileInfo, setUploadFileInfo] = useState<{ name: string; size: number } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const pendingFileRef = useRef<{ file: File; oversized: boolean } | null>(null);

  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!prefs.typingIndicators) return;
      if (typing === isTypingRef.current) return;
      isTypingRef.current = typing;
      client.sendTyping(roomId, typing, typing ? 5000 : 0).catch(() => {});
    },
    [client, roomId, prefs.typingIndicators]
  );

  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        client.sendTyping(roomId, false, 0).catch(() => {});
      }
    };
  }, [client, roomId]);

  useEffect(() => {
    if (replyTo) {
      ReactEditor.focus(editor);
    }
  }, [replyTo, editor]);

  useEffect(() => {
    if (!mentionInsert) return;
    const mentionNode: MentionElement = {
      type: 'mention',
      userId: mentionInsert.userId,
      displayName: mentionInsert.displayName,
      children: [{ text: '' }],
    };
    ReactEditor.focus(editor);
    Transforms.insertNodes(editor, mentionNode);
    Transforms.move(editor, { unit: 'offset' });
    Transforms.insertText(editor, ' ');
    setMentionInsert(null);
  }, [mentionInsert, editor, setMentionInsert]);

  const isEmpty = editorValue.every((node) => {
    if (Node.string(node).trim().length > 0) return false;
    // Void emoticon nodes have no text content but are not empty
    for (const [child] of Node.nodes(node)) {
      if (Element.isElement(child) && child.type === 'emoticon') return false;
    }
    return true;
  });

  const clearEditor = useCallback(() => {
    const blank = emptyDocument();
    Transforms.select(editor, {
      anchor: { path: [0, 0], offset: 0 },
      focus: { path: [0, 0], offset: 0 },
    });
    editor.children = blank;
    setEditorValue([...blank]);
  }, [editor]);

  // handleEditorChange

  const handleEditorChange = useCallback(
    (value: Descendant[]) => {
      setEditorValue(value);
      sendTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTyping(false), 4000);
      autocomplete.onEditorChange(editor);
      resetToolbar();
    },
    [editor, sendTyping, autocomplete, resetToolbar]
  );

  const sendMessage = useCallback(async () => {
    if (isEmpty) return;
    autocomplete.close();

    const { markdown } = toMarkdown(editorValue);
    const text = markdown.trim();
    if (!text) return;

    clearEditor();
    sendTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    try {
      const parsed = parseCommand(text);
      if (parsed) {
        const cmd = getCommandDefinition(parsed.command);
        if (cmd) {
          const ctx: CommandContext = { client, roomId, t, toast };
          try {
            await cmd.fn(parsed.args, ctx);
          } catch (cmdErr) {
            toast.error(getErrorMessage(cmdErr));
          }
          if (replyTo) onClearReply();
          return;
        }
        toast.error(t('timeline.unknownCommand', { command: parsed.command }));
        if (replyTo) onClearReply();
        return;
      }

      const {
        html: formattedBody,
        mentionMap: htmlMentionMap,
        hasCustomContent,
      } = toHtml(editorValue);
      const mentionedUserIds = Array.from(htmlMentionMap.values());

      const content: Record<string, unknown> = {
        msgtype: 'm.text',
        body: text,
      };

      if (hasCustomContent || mentionedUserIds.length > 0 || formattedBody !== text || replyTo) {
        content.format = 'org.matrix.custom.html';
        content.formatted_body = formattedBody;
      }

      if (replyTo) {
        const replyId = replyTo.getId();
        const replySenderId = replyTo.getSender();
        content['m.relates_to'] = { 'm.in_reply_to': { event_id: replyId } };
        const allMentions = new Set(mentionedUserIds);
        if (replySenderId && replySenderId !== client.getUserId()) {
          allMentions.add(replySenderId);
        }
        if (allMentions.size > 0) {
          content['m.mentions'] = { user_ids: Array.from(allMentions) };
        }
        onClearReply();
      } else if (mentionedUserIds.length > 0) {
        content['m.mentions'] = { user_ids: mentionedUserIds };
      }

      if (threadId) {
        await client.sendEvent(
          roomId,
          threadId,
          EventType.RoomMessage,
          content as unknown as RoomMessageEventContent
        );
      } else {
        await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
      }
      onSent?.();
    } catch (err) {
      toast.error(t('timeline.sendFailed', { error: getErrorMessage(err) }));
    }
  }, [
    isEmpty,
    editorValue,
    autocomplete,
    clearEditor,
    sendTyping,
    client,
    roomId,
    threadId,
    replyTo,
    onClearReply,
    onSent,
    t,
    toast,
  ]);

  const handleEditorKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (autocomplete.state.open) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          autocomplete.onArrow('down');
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          autocomplete.onArrow('up');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          autocomplete.close();
          return;
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
          const confirmed = autocomplete.confirm(editor);
          if (confirmed) {
            e.preventDefault();
            return;
          }
        }
      }
      if (e.key === 'Escape' && replyTo) {
        e.preventDefault();
        onClearReply();
      }
    },
    [autocomplete, editor, replyTo, onClearReply]
  );

  const handleAutocompleteSelect = useCallback(
    (_suggestion: Suggestion) => {
      autocomplete.confirm(editor);
    },
    [autocomplete, editor]
  );

  const openPreviewForFile = useCallback(
    (file: File) => {
      const oversized = file.size > maxUploadBytes;
      const previewUrl =
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type.startsWith('audio/')
          ? URL.createObjectURL(file)
          : '';
      pendingFileRef.current = { file, oversized };
      setAttachmentPreview({ file, previewUrl, oversized });
    },
    [maxUploadBytes, setAttachmentPreview]
  );

  useEffect(() => {
    if (!droppedFile) return;
    openPreviewForFile(droppedFile);
    onDroppedFileConsumed?.();
  }, [droppedFile, openPreviewForFile, onDroppedFileConsumed]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openPreviewForFile(file);
    e.target.value = '';
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (attachmentPreview) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        openPreviewForFile(file);
        return;
      }
    },
    [attachmentPreview, openPreviewForFile]
  );

  const uploadFile = useCallback(
    async (file: File, caption: string) => {
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      setUploadFileInfo({ name: file.name, size: file.size });
      try {
        const isImage = file.type.startsWith('image/') && file.type !== 'image/svg+xml';
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        const msgtype = isImage ? 'm.image' : isVideo ? 'm.video' : isAudio ? 'm.audio' : 'm.file';
        const body = caption.length > 0 ? caption : file.name;
        const uploadResult = await uploadEncryptedFile(
          client,
          roomId,
          file,
          () => {},
          setUploadProgress,
          controller
        );
        if (uploadResult.file) {
          const cacheKey = getMediaCacheKey(uploadResult.file);
          const blobUrl = URL.createObjectURL(file);
          setCachedBlobUrl(cacheKey, blobUrl, file.type);
        }
        const msgContent = buildMediaMessageContent(msgtype, file.name, body, uploadResult, {
          mimetype: file.type,
          size: file.size,
        });
        if (threadId) {
          await client.sendEvent(
            roomId,
            threadId,
            EventType.RoomMessage,
            msgContent as unknown as RoomMessageEventContent
          );
        } else {
          await client.sendMessage(roomId, msgContent as unknown as RoomMessageEventContent);
        }
        onSent?.();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        toast.error(t('timeline.uploadFailed', { error: getErrorMessage(err) }));
        throw err;
      } finally {
        setUploadProgress(null);
        setUploadFileInfo(null);
        uploadAbortRef.current = null;
      }
    },
    [client, roomId, threadId, onSent, toast, t]
  );

  const cancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (pendingSend === null) return;
    const fileInfo = pendingFileRef.current;
    pendingFileRef.current = null;
    setPendingSend(null);
    if (!fileInfo || fileInfo.oversized) return;
    uploadFile(fileInfo.file, pendingSend);
  }, [pendingSend, uploadFile, setPendingSend]);

  return {
    editor,
    editorValue,
    fileInputRef,
    composerWrapRef,
    toolbar,
    autocomplete,
    uploadProgress,
    uploadFileInfo,
    cancelUpload,
    handleEditorChange,
    handleEditorKeyDown,
    handlePaste,
    handleFileSelect,
    handleAutocompleteSelect,
    applyFormat,
    updateToolbar,
    sendMessage,
    isEmpty,
  };
}
