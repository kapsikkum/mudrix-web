import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
  commandActionsAtom,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { Transforms, type Descendant } from 'slate';
import { ReactEditor } from 'slate-react';
import { useAutocomplete } from '../useAutocomplete';
import type { Suggestion } from '../useAutocomplete';
import { elementCallUiAtom } from '@/app/store/atoms/elementCall';
import {
  uploadEncryptedFile,
  buildMediaMessageContent,
  getImageDimensions,
} from '../encryptedMedia';
import { getMediaCacheKey, setCachedBlobUrl } from '../message/mediaCache';
import { parseCommand, getCommandDefinition } from './commands';
import type { FormatType } from './FormatToolbar';
import type { CommandContext } from './commands';
import { toMarkdown } from './editor/toMarkdown';
import { buildTextContent } from './editor/buildTextContent';
import { sendMessageContent } from './sendMessageContent';
import { useRichEditor } from './useRichEditor';
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
  const navigate = useNavigate();
  const prefs = useAtomValue(preferencesAtom);
  const maxUploadBytes = useAtomValue(serverUploadLimitAtom);
  const [mentionInsert, setMentionInsert] = useAtom(mentionInsertAtom);
  const toast = useToast();
  const commandActions = useAtomValue(commandActionsAtom);
  const elementUi = useAtomValue(elementCallUiAtom);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);

  const {
    editor,
    value: editorValue,
    toolbar,
    updateToolbar,
    applyFormat,
    autocomplete,
    handleChange: handleRichChange,
    handleKeyDown: handleRichKeyDown,
    handleAutocompleteSelect,
    clearValue: clearEditor,
    isEmpty,
  } = useRichEditor({
    client,
    roomId,
    containerRef: composerWrapRef,
  });

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

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

  const handleEditorChange = useCallback(
    (value: Descendant[]) => {
      handleRichChange(value);
      sendTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => sendTyping(false), 4000);
    },
    [handleRichChange, sendTyping]
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
          const ctx: CommandContext = {
            client,
            roomId,
            threadId,
            replyTo,
            navigate,
            t,
            toast,
            placeCall: commandActions?.placeCall,
            joinVoice: commandActions?.joinVoice,
            hangup: commandActions?.hangup,
            elementCallActive: elementUi.phase === 'joined',
          };
          try {
            await cmd.fn(parsed.args, ctx);
          } catch (cmdErr) {
            toast.error(getErrorMessage(cmdErr));
          }
          if (replyTo) onClearReply();
          return;
        }
        // Not a known command: fall through and send as literal text.
      }

      const built = buildTextContent(editorValue, {
        forceFormatted: !!replyTo,
        myId: client.getUserId() ?? '',
      });
      await sendMessageContent(built.content, {
        client,
        roomId,
        threadId,
        replyTo,
        myId: client.getUserId() ?? '',
        mentionedUserIds: built.mentionedUserIds,
      });
      if (replyTo) onClearReply();
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
    commandActions,
    elementUi,
    navigate,
  ]);

  const handleEditorKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (handleRichKeyDown(e)) return;
      if (e.key === 'Escape' && replyTo) {
        e.preventDefault();
        onClearReply();
      }
    },
    [handleRichKeyDown, replyTo, onClearReply]
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
        let mediaInfo: { mimetype: string; size: number; w?: number; h?: number } = {
          mimetype: file.type,
          size: file.size,
        };
        if (isImage) {
          const dims = await getImageDimensions(file);
          if (dims) mediaInfo = { ...mediaInfo, ...dims };
        }
        const msgContent = buildMediaMessageContent(
          msgtype,
          file.name,
          body,
          uploadResult,
          mediaInfo
        );
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
