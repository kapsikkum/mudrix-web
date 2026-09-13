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
  typingIndicatorsAtom,
  serverUploadLimitAtom,
  attachmentPreviewAtom,
  attachmentPendingSendAtom,
  mentionInsertAtom,
  commandActionsAtom,
  type AttachmentPendingSendItem,
} from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { useConfirm } from '@/app/hooks/useConfirm';
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
  droppedFile?: File[] | null;
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
  uploadFileInfo: { name: string; size: number; current: number; total: number } | null;

  cancelUpload: () => void;
  handleEditorChange: (value: Descendant[]) => void;
  handleEditorKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  handlePaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleAutocompleteSelect: (suggestion: Suggestion) => void;
  applyFormat: (fmt: FormatType, e?: React.MouseEvent) => Promise<void>;
  updateToolbar: () => void;
  linkPopover: { defaultValue: string; position: { top: number; left: number } } | null;
  submitLink: (url: string) => void;
  cancelLink: () => void;
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
  const typingIndicators = useAtomValue(typingIndicatorsAtom);
  const maxUploadBytes = useAtomValue(serverUploadLimitAtom);
  const [mentionInsert, setMentionInsert] = useAtom(mentionInsertAtom);
  const confirmDialog = useConfirm();
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
    linkPopover,
    submitLink,
    cancelLink,
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
  const [uploadFileInfo, setUploadFileInfo] = useState<{
    name: string;
    size: number;
    current: number;
    total: number;
  } | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);

  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!typingIndicators) return;
      if (typing === isTypingRef.current) return;
      isTypingRef.current = typing;
      client.sendTyping(roomId, typing, typing ? 5000 : 0).catch(() => {});
    },
    [client, roomId, typingIndicators]
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

  const sendingRef = useRef(false);

  const sendMessage = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
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
              editorValue,
              navigate,
              t,
              toast,
              confirm: (title: string, message: string, danger?: boolean) =>
                confirmDialog({ title, message, danger }),
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
    } finally {
      sendingRef.current = false;
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
    confirmDialog,
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

  const addFilesToPreview = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const items = files.map((file) => {
        const oversized = file.size > maxUploadBytes;
        const previewUrl =
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          file.type.startsWith('audio/')
            ? URL.createObjectURL(file)
            : '';
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewUrl,
          oversized,
        };
      });
      setAttachmentPreview((prev) => [...prev, ...items]);
    },
    [maxUploadBytes, setAttachmentPreview]
  );

  useEffect(() => {
    if (!droppedFile || droppedFile.length === 0) return;
    addFilesToPreview(droppedFile);
    onDroppedFileConsumed?.();
  }, [droppedFile, addFilesToPreview, onDroppedFileConsumed]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFilesToPreview(Array.from(e.target.files));
    e.target.value = '';
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (attachmentPreview.length > 0) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        addFilesToPreview([file]);
        return;
      }
    },
    [attachmentPreview.length, addFilesToPreview]
  );

  const uploadOne = useCallback(
    async (file: File, caption: string): Promise<void> => {
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
        uploadAbortRef.current ?? undefined
      );
      if (uploadResult.file) {
        const cacheKey = getMediaCacheKey(uploadResult.file);
        const blobUrl = URL.createObjectURL(file);
        setCachedBlobUrl(cacheKey, blobUrl, file.type);
      }
      let mediaInfo: { mimetype: string; size: number; w?: number; h?: number; duration?: number } =
        {
          mimetype: file.type,
          size: file.size,
        };
      if (isImage) {
        const dims = await getImageDimensions(file);
        if (dims) mediaInfo = { ...mediaInfo, ...dims };
      } else if (isVideo) {
        if (uploadResult.mediaWidth && uploadResult.mediaHeight) {
          mediaInfo = { ...mediaInfo, w: uploadResult.mediaWidth, h: uploadResult.mediaHeight };
        }
        if (uploadResult.durationMs) {
          mediaInfo = { ...mediaInfo, duration: uploadResult.durationMs };
        }
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
    },
    [client, roomId, threadId]
  );

  const uploadFiles = useCallback(
    async (items: AttachmentPendingSendItem[]) => {
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      const total = items.length;
      let failed = 0;
      try {
        for (let i = 0; i < items.length; i++) {
          if (controller.signal.aborted) break;
          const item = items[i];
          setUploadFileInfo({ name: item.file.name, size: item.file.size, current: i + 1, total });
          try {
            await uploadOne(item.file, item.caption);
            onSent?.();
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') break;
            failed += 1;
            toast.error(t('timeline.uploadFailed', { error: getErrorMessage(err) }));
          }
        }
        if (failed > 0 && total > 1) {
          toast.error(t('timeline.uploadFailedMany', { failed, total }));
        }
      } finally {
        setUploadProgress(null);
        setUploadFileInfo(null);
        uploadAbortRef.current = null;
      }
    },
    [uploadOne, onSent, toast, t]
  );

  const cancelUpload = useCallback(() => {
    uploadAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (pendingSend === null) return;
    const items = pendingSend;
    setPendingSend(null);
    uploadFiles(items);
  }, [pendingSend, uploadFiles, setPendingSend]);

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
    linkPopover,
    submitLink,
    cancelLink,
    sendMessage,
    isEmpty,
  };
}
