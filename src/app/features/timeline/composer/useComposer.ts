import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { useAtom, useAtomValue } from 'jotai';
import { preferencesAtom, emojiPickerAtom } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { markdownToHtml } from '@/util/markdownToHtml';
import { useAutocomplete, trackEmojiUsage } from '../useAutocomplete';
import type { Suggestion } from '../useAutocomplete';
import { uploadEncryptedFile, buildMediaMessageContent } from '../encryptedMedia';
import type { FormatType } from './FormatToolbar';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

interface UseComposerOptions {
  client: MatrixClient;
  roomId: string;
  replyTo: MatrixEvent | null;
  onClearReply: () => void;
  droppedFile?: File | null;
  onDroppedFileConsumed?: () => void;
}

export interface ComposerState {
  // Textarea
  value: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  composerWrapRef: React.RefObject<HTMLDivElement | null>;

  // Floating format toolbar
  toolbar: { top: number; left: number } | null;

  // Autocomplete
  autocomplete: ReturnType<typeof useAutocomplete>;

  // Attachment
  pendingAttachment: { file: File; previewUrl: string; oversized: boolean } | null;
  uploadPhase: 'idle' | 'encrypting' | 'uploading';

  // Emoji picker
  isEmojiOpen: boolean;

  // Handlers
  handleChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  handleAttachmentSend: (caption: string) => Promise<void>;
  closePendingAttachment: () => void;
  handleAutocompleteSelect: (suggestion: Suggestion) => void;
  handleOpenEmojiPicker: (e: React.MouseEvent<HTMLButtonElement>) => void;
  applyFormat: (fmt: FormatType, e?: React.MouseEvent) => void;
  updateToolbar: () => void;
  sendMessage: () => Promise<void>;
}

export function useComposer({
  client,
  roomId,
  replyTo,
  onClearReply,
  droppedFile,
  onDroppedFileConsumed,
}: UseComposerOptions): ComposerState {
  const { t } = useTranslation();
  const prefs = useAtomValue(preferencesAtom);
  const [, setEmojiPicker] = useAtom(emojiPickerAtom);
  const [emojiPicker] = useAtom(emojiPickerAtom);
  const isEmojiOpen = emojiPicker !== null;
  const toast = useToast();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const autocomplete = useAutocomplete(client, roomId);
  const mentionMapRef = useRef<Map<string, string>>(new Map());

  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    previewUrl: string;
    oversized: boolean;
  } | null>(null);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'encrypting' | 'uploading'>('idle');

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const capped = Math.min(el.scrollHeight, 180);
    el.style.height = `${capped}px`;
    el.style.overflowY = el.scrollHeight > 180 ? 'auto' : 'hidden';
  }, []);

  const updateToolbar = useCallback(() => {
    const el = textareaRef.current;
    const wrap = composerWrapRef.current;
    if (!el || !wrap) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      setToolbar(null);
      return;
    }
    const elRect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    setToolbar({ top: elRect.top - wrapRect.top - 44, left: 0 });
  }, []);

  const sendTyping = useCallback(
    (typing: boolean) => {
      if (!prefs.typingIndicators) return;
      if (typing === isTypingRef.current) return;
      isTypingRef.current = typing;
      client.sendTyping(roomId, typing, typing ? 5000 : 0).catch(() => {});
    },
    [client, roomId, prefs.typingIndicators]
  );

  // Stop typing indicator when component unmounts
  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        client.sendTyping(roomId, false, 0).catch(() => {});
      }
    };
  }, [client, roomId]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    resize();
    sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(false), 4000);
    const cursor = e.target.selectionStart ?? next.length;
    autocomplete.onInput(next, cursor);
    setToolbar(null);
  };

  const sendMessage = useCallback(async () => {
    const text = value.trim();
    if (!text) return;
    autocomplete.close();
    setValue('');
    resize();
    sendTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    try {
      const mentionMap = mentionMapRef.current;
      const mentionedUserIds: string[] = [];

      // Replace @displayName tokens with matrix.to mention links
      let htmlText = text;
      const sortedNames = [...mentionMap.keys()].sort((a, b) => b.length - a.length);
      for (const displayName of sortedNames) {
        const userId = mentionMap.get(displayName)!;
        const escaped = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`@${escaped}(?=\\s|$)`, 'g');
        if (re.test(htmlText)) {
          mentionedUserIds.push(userId);
          htmlText = htmlText.replace(
            new RegExp(`@${escaped}(?=\\s|$)`, 'g'),
            `<a href="https://matrix.to/#/${userId}">@${displayName}</a>`
          );
        }
      }
      mentionMapRef.current = new Map();

      const content: Record<string, unknown> = {
        msgtype: 'm.text',
        body: text,
        format: 'org.matrix.custom.html',
        formatted_body: markdownToHtml(htmlText),
      };

      if (mentionedUserIds.length > 0) {
        content['m.mentions'] = { user_ids: mentionedUserIds };
      }
      if (replyTo) {
        const replyId = replyTo.getId();
        const replySender = replyTo.getSender();
        const replyBody = replyTo.getContent()?.body ?? '';
        content['m.relates_to'] = { 'm.in_reply_to': { event_id: replyId } };
        content.body = `> <${replySender}> ${replyBody}\n\n${text}`;
        onClearReply();
      }

      await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
    } catch (err) {
      toast.error(t('timeline.sendFailed', { error: getErrorMessage(err) }));
    }
  }, [value, client, roomId, replyTo, onClearReply, sendTyping, resize, toast, t, autocomplete]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
        const el = textareaRef.current;
        const result = autocomplete.confirm(value, el?.selectionStart ?? value.length);
        if (result) {
          e.preventDefault();
          if (result.mention) {
            mentionMapRef.current.set(result.mention.displayName, result.mention.userId);
          }
          setValue(result.newValue);
          setTimeout(() => {
            el?.setSelectionRange(result.newCursor, result.newCursor);
            el?.focus();
            resize();
          }, 0);
          return;
        }
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const applyFormat = useCallback(
    (fmt: FormatType, e?: React.MouseEvent) => {
      e?.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);

      if (fmt === 'link') {
        const url = window.prompt(t('composer.enterUrl'), 'https://');
        if (!url) {
          el.focus();
          return;
        }
        const label = selected || url;
        const insertion = `[${label}](${url})`;
        const newVal = value.slice(0, start) + insertion + value.slice(end);
        setValue(newVal);
        setToolbar(null);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + insertion.length, start + insertion.length);
        }, 0);
        return;
      }

      const MAP: Record<FormatType, [string, string]> = {
        bold: ['**', '**'],
        italic: ['*', '*'],
        strike: ['~~', '~~'],
        code: ['`', '`'],
        quote: ['> ', ''],
        link: ['', ''], // handled above
      };
      const [pre, post] = MAP[fmt];
      const newVal = value.slice(0, start) + pre + selected + post + value.slice(end);
      setValue(newVal);
      setToolbar(null);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + pre.length, end + pre.length);
      }, 0);
    },
    [value, t]
  );

  const handleAutocompleteSelect = useCallback(
    (suggestion: Suggestion) => {
      const el = textareaRef.current;
      const result = autocomplete.confirm(value, el?.selectionStart ?? value.length);
      if (result) {
        if (result.mention) {
          mentionMapRef.current.set(result.mention.displayName, result.mention.userId);
        }
        setValue(result.newValue);
        if (suggestion.kind === 'emoji') trackEmojiUsage(suggestion.char);
        setTimeout(() => {
          el?.setSelectionRange(result.newCursor, result.newCursor);
          el?.focus();
          resize();
        }, 0);
      }
    },
    [autocomplete, value, resize]
  );

  const handleOpenEmojiPicker = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setEmojiPicker({
      x: rect.right - 350,
      y: rect.top - 460,
      onPick: (emoji: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + emoji + value.slice(end);
        setValue(next);
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
      },
    });
  };

  const closePendingAttachment = useCallback(() => {
    if (pendingAttachment) URL.revokeObjectURL(pendingAttachment.previewUrl);
    setPendingAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingAttachment]);

  const uploadFile = useCallback(
    async (file: File, caption: string) => {
      try {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const msgtype = isImage ? 'm.image' : isVideo ? 'm.video' : 'm.file';
        const body = caption.length > 0 ? caption : file.name;
        const uploadResult = await uploadEncryptedFile(client, roomId, file, setUploadPhase);
        const msgContent = buildMediaMessageContent(msgtype, file.name, body, uploadResult, {
          mimetype: file.type,
          size: file.size,
        });
        await client.sendMessage(roomId, msgContent as unknown as RoomMessageEventContent);
      } catch (err) {
        toast.error(t('timeline.uploadFailed', { error: getErrorMessage(err) }));
        throw err;
      } finally {
        setUploadPhase('idle');
      }
    },
    [client, roomId, toast, t]
  );

  const openPreviewForFile = useCallback((file: File) => {
    const oversized = file.size > MAX_UPLOAD_BYTES;
    const previewUrl =
      file.type.startsWith('image/') || file.type.startsWith('video/')
        ? URL.createObjectURL(file)
        : '';
    setPendingAttachment({ file, previewUrl, oversized });
  }, []);

  // Consume a file dropped onto the timeline
  useEffect(() => {
    if (!droppedFile) return;
    openPreviewForFile(droppedFile);
    onDroppedFileConsumed?.();
  }, [droppedFile, openPreviewForFile, onDroppedFileConsumed]);

  const handleAttachmentSend = useCallback(
    async (caption: string) => {
      if (!pendingAttachment || pendingAttachment.oversized) return;
      await uploadFile(pendingAttachment.file, caption);
      closePendingAttachment();
    },
    [pendingAttachment, uploadFile, closePendingAttachment]
  );

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openPreviewForFile(file);
    e.target.value = '';
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      if (pendingAttachment) return;
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
    [pendingAttachment, openPreviewForFile]
  );

  return {
    value,
    textareaRef,
    fileInputRef,
    composerWrapRef,
    toolbar,
    autocomplete,
    pendingAttachment,
    uploadPhase,
    isEmojiOpen,
    handleChange,
    handleKeyDown,
    handlePaste,
    handleFileSelect,
    handleAttachmentSend,
    closePendingAttachment,
    handleAutocompleteSelect,
    handleOpenEmojiPicker,
    applyFormat,
    updateToolbar,
    sendMessage,
  };
}
