import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type ClipboardEvent,
  type MouseEvent,
} from 'react';
import {
  ArrowBendUpLeftIcon,
  TextBIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  CodeIcon,
  QuotesIcon,
  LinkIcon,
  PlusIcon,
  SmileyIcon,
  NoteIcon,
  PaperPlaneIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { useAtom, useAtomValue } from 'jotai';
import { preferencesAtom, stickerPickerOpenAtom, emojiPickerAtom } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import type { RoomWidget } from '@/app/hooks/useWidgets';
import { getErrorMessage } from '@/util/error';
import { StickerPicker } from '@/app/features/widget/StickerPicker';
import { useAutocomplete, trackEmojiUsage } from './useAutocomplete';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import type { Suggestion } from './useAutocomplete';
import { markdownToHtml } from '@/util/markdownToHtml';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { uploadEncryptedFile, buildMediaMessageContent } from './encryptedMedia';
import * as css from './Composer.css';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

interface Props {
  client: MatrixClient;
  roomId: string;
  replyTo: MatrixEvent | null;
  onClearReply: () => void;
  stickerWidget?: RoomWidget | null;
  droppedFile?: File | null;
  onDroppedFileConsumed?: () => void;
}

export function Composer({
  client,
  roomId,
  replyTo,
  onClearReply,
  stickerWidget,
  droppedFile,
  onDroppedFileConsumed,
}: Props) {
  const { t } = useTranslation();
  const prefs = useAtomValue(preferencesAtom);
  const [stickerPickerOpen, setStickerPickerOpen] = useAtom(stickerPickerOpenAtom);
  const [emojiPicker, setEmojiPicker] = useAtom(emojiPickerAtom);
  const isEmojiOpen = emojiPicker !== null;
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const autocomplete = useAutocomplete(client, roomId);
  // Maps display name → userId for every mention confirmed in this composer session.
  // Cleared when the message is sent.
  const mentionMapRef = useRef<Map<string, string>>(new Map());

  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);

  // Show floating toolbar when user has a text selection inside the textarea
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

    // Approximate position: place toolbar above the textarea
    const elRect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    setToolbar({
      top: elRect.top - wrapRect.top - 44, // 44px = toolbar height + gap
      left: 0,
    });
  }, []);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const capped = Math.min(el.scrollHeight, 180);
    el.style.height = `${capped}px`;
    // Only enable scrolling once the textarea has reached its max height
    el.style.overflowY = el.scrollHeight > 180 ? 'auto' : 'hidden';
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

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    resize();
    sendTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(false), 4000);
    // Feed autocomplete on every change
    const cursor = e.target.selectionStart ?? next.length;
    autocomplete.onInput(next, cursor);
    // Hide toolbar when typing (selection will be gone)
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
      // mentionMapRef maps displayName → userId for every mention confirmed
      // via autocomplete in this message. We build the formatted_body by
      // replacing @displayName tokens with proper matrix.to anchor links.
      const mentionMap = mentionMapRef.current;
      const mentionedUserIds: string[] = [];

      // Build formatted text: replace each known @displayName with a mention link.
      // Sort by length descending so longer names match before substrings.
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

      // Clear map for next message
      mentionMapRef.current = new Map();

      const content: Record<string, unknown> = {
        msgtype: 'm.text',
        body: text,
        format: 'org.matrix.custom.html',
        formatted_body: markdownToHtml(htmlText),
      };

      // m.mentions — Matrix spec for explicit mention list (push notifications etc.)
      if (mentionedUserIds.length > 0) {
        content['m.mentions'] = { user_ids: mentionedUserIds };
      }
      if (replyTo) {
        const replyId = replyTo.getId();
        const replySender = replyTo.getSender();
        const replyBody = replyTo.getContent()?.body ?? '';
        content['m.relates_to'] = {
          'm.in_reply_to': { event_id: replyId },
        };
        content.body = `> <${replySender}> ${replyBody}\n\n${text}`;
        onClearReply();
      }
      await client.sendMessage(roomId, content as unknown as RoomMessageEventContent);
    } catch (err) {
      toast.error(t('timeline.sendFailed', { error: getErrorMessage(err) }));
    }
  }, [value, client, roomId, replyTo, onClearReply, sendTyping, resize, toast, t, autocomplete]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Let autocomplete consume arrow keys, Tab, Enter and Escape first
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

  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'encrypting' | 'uploading'>('idle');

  const closePendingAttachment = useCallback(() => {
    if (pendingAttachment) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [pendingAttachment]);

  const openPreviewForFile = useCallback(
    (file: File) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(t('timeline.fileTooLarge', { name: file.name }));
        return;
      }
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (isImage || isVideo) {
        const previewUrl = URL.createObjectURL(file);
        setPendingAttachment({ file, previewUrl });
      } else {
        // Non-previewable file — send directly without modal
        uploadFile(file, '');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toast]
  );

  useEffect(() => {
    if (!droppedFile) return;
    openPreviewForFile(droppedFile);
    onDroppedFileConsumed?.();
  }, [droppedFile]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadFile = useCallback(
    async (file: File, caption: string) => {
      try {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const msgtype = isImage ? 'm.image' : isVideo ? 'm.video' : 'm.file';

        // MSC2530: body = caption (or filename if empty), filename = original name
        const body = caption.length > 0 ? caption : file.name;

        // Upload — encrypts automatically for E2EE rooms (MSC3090)
        const uploadResult = await uploadEncryptedFile(client, roomId, file, setUploadPhase);

        // Build event content — MSC3090 `file` field for encrypted, `url` for plain
        const msgContent = buildMediaMessageContent(msgtype, file.name, body, uploadResult, {
          mimetype: file.type,
          size: file.size,
        });

        await client.sendMessage(
          roomId,
          msgContent as unknown as import('matrix-js-sdk/lib/@types/events').RoomMessageEventContent
        );
      } catch (err) {
        toast.error(t('timeline.uploadFailed', { error: getErrorMessage(err) }));
        throw err; // re-throw so the modal can reset its sending state
      } finally {
        setUploadPhase('idle');
      }
    },
    [client, roomId, toast, t]
  );

  const handleAttachmentSend = useCallback(
    async (caption: string) => {
      if (!pendingAttachment) return;
      await uploadFile(pendingAttachment.file, caption);
      closePendingAttachment();
    },
    [pendingAttachment, uploadFile, closePendingAttachment]
  );

  // Only accept one file at a time — take the first selected file
  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) openPreviewForFile(file);
    e.target.value = '';
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      // If a modal is already open, do nothing — don't queue a second file
      if (pendingAttachment) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Find the first file item that is an image or video
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== 'file') continue;
        if (!item.type.startsWith('image/') && !item.type.startsWith('video/')) continue;

        const file = item.getAsFile();
        if (!file) continue;

        // Prevent the browser from pasting the image as an <img> into the textarea
        e.preventDefault();
        openPreviewForFile(file);
        return; // only handle the first matching file
      }

      // No file found — let the browser handle the paste normally (plain text, etc.)
    },
    [pendingAttachment, openPreviewForFile]
  );

  const applyFormat = useCallback(
    (fmt: string, e?: MouseEvent) => {
      // Prevent the button click from stealing textarea focus + collapsing selection
      e?.preventDefault();
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);

      if (fmt === 'link') {
        // Prompt for URL — use the selected text as the label
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

      const MAP: Record<string, [string, string]> = {
        bold: ['**', '**'],
        italic: ['*', '*'],
        strike: ['~~', '~~'],
        code: ['`', '`'],
        quote: ['> ', ''],
      };
      const [pre, post] = MAP[fmt] ?? ['', ''];
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
    // Position picker above the button, right-aligned to its right edge
    setEmojiPicker({
      x: rect.right - 350, // 350px is the picker width — right-align it
      y: rect.top - 460, // 450px picker height + 10px gap above button
      onPick: (emoji: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + emoji + value.slice(end);
        setValue(next);
        // Restore cursor right after the inserted emoji
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(start + emoji.length, start + emoji.length);
        }, 0);
      },
    });
  };

  // Cleanup typing on unmount or room change
  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        client.sendTyping(roomId, false, 0).catch(() => {});
      }
    };
  }, [client, roomId]);

  return (
    <div ref={composerWrapRef} className={css.composerWrap} style={{ position: 'relative' }}>
      {replyTo && (
        <div className={css.replyPreview}>
          <ArrowBendUpLeftIcon size={14} />
          <span>
            <strong>{replyTo.getSender()?.split(':')[0].substring(1)}: </strong>
            {((replyTo.getContent()?.body as string) ?? '').substring(0, 80)}
          </span>
          <button className={css.replyCancel} onClick={onClearReply}>
            &times;
          </button>
        </div>
      )}

      <AutocompleteDropdown
        state={autocomplete.state}
        client={client}
        onSelect={handleAutocompleteSelect}
      />

      {/* Floating format toolbar — only visible when text is selected */}
      {toolbar && (
        <div className={css.floatingToolbar} style={{ top: toolbar.top, left: toolbar.left }}>
          {(
            [
              { fmt: 'bold', icon: <TextBIcon size={14} />, title: t('composer.formatting.bold') },
              {
                fmt: 'italic',
                icon: <TextItalicIcon size={14} />,
                title: t('composer.formatting.italic'),
              },
              {
                fmt: 'strike',
                icon: <TextStrikethroughIcon size={14} />,
                title: t('composer.formatting.strikethrough'),
              },
              { fmt: 'code', icon: <CodeIcon size={14} />, title: t('composer.formatting.code') },
              {
                fmt: 'quote',
                icon: <QuotesIcon size={14} />,
                title: t('composer.formatting.quote'),
              },
              { fmt: 'link', icon: <LinkIcon size={14} />, title: t('composer.formatting.link') },
            ] as const
          ).map(({ fmt, icon, title }) => (
            <button
              key={fmt}
              className={css.fmtBtn}
              title={title}
              // mousedown fires before blur/selection-collapse — keep selection alive
              onMouseDown={(e) => applyFormat(fmt as string, e)}
            >
              {icon}
            </button>
          ))}
        </div>
      )}

      <div className={css.inputRow}>
        <button
          className={css.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          title={t('composer.attach')}
        >
          <PlusIcon size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />

        <textarea
          ref={textareaRef}
          className={css.textarea}
          placeholder={t('composer.typeMessage')}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onMouseUp={updateToolbar}
          onKeyUp={updateToolbar}
          onBlur={() => setToolbar(null)}
          onPaste={handlePaste}
          rows={1}
        />

        {/* Emoji picker button */}
        <button
          className={isEmojiOpen ? css.emojiBtnActive : css.emojiBtn}
          title={t('composer.emoji')}
          onClick={handleOpenEmojiPicker}
        >
          <SmileyIcon size={20} weight={isEmojiOpen ? 'fill' : 'regular'} />
        </button>

        {/* Sticker button — only visible when a sticker widget is configured */}
        {stickerWidget && (
          <div style={{ position: 'relative' }}>
            <button
              className={stickerPickerOpen ? css.stickerBtnActive : css.stickerBtn}
              title={t('composer.stickers')}
              onClick={() => setStickerPickerOpen((o) => !o)}
            >
              <NoteIcon size={20} />
            </button>
            {/* StickerPicker is absolutely positioned relative to this button */}
            <StickerPicker client={client} roomId={roomId} widgetUrl={stickerWidget.url} />
          </div>
        )}

        <button className={css.sendBtn} onClick={sendMessage} disabled={!value.trim()}>
          <PaperPlaneIcon size={18} weight="fill" className={css.sendBtnIcon} />
        </button>
      </div>

      {/* Attachment preview modal — shown before sending images/videos */}
      {pendingAttachment && (
        <AttachmentPreviewModal
          file={pendingAttachment.file}
          previewUrl={pendingAttachment.previewUrl}
          onSend={handleAttachmentSend}
          onClose={closePendingAttachment}
          uploadPhase={uploadPhase}
        />
      )}
    </div>
  );
}
