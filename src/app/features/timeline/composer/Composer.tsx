import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import {
  PlusIcon,
  SmileyIcon,
  StickerIcon,
  PaperPlaneRightIcon,
  XIcon,
  ChartBarHorizontalIcon,
  DotsThreeVerticalIcon,
  GifIcon,
} from '@phosphor-icons/react';
import { formatFileSize } from '@/util/format';
import { useAtomValue, useSetAtom } from 'jotai';
import { stickerPickerAtom, preferencesAtom } from '@/app/store/atoms';
import type { RoomWidget } from '@/app/hooks/useWidgets';
import { StickerPicker } from '@/app/features/widget/StickerPicker';
import { ComposerMediaPicker } from '@/app/features/timeline/composer/ComposerMediaPicker';
import { Tooltip } from '@/app/components/Tooltip';
import { AutocompleteDropdown } from '../AutocompleteDropdown';
import { ReplyPreview } from './ReplyPreview';
import { FormatToolbar } from './FormatToolbar';
import { TypingIndicator } from './TypingIndicator';
import { useComposer } from './useComposer';
import { PollCreatorModal } from './PollCreatorModal';
import { RichComposer } from './editor/RichComposer';
import { roomState } from '@/util/matrix';
import * as css from '../Composer.css';

interface Props {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  replyTo: MatrixEvent | null;
  onClearReply: () => void;
  onSent?: () => void;
  stickerWidget?: RoomWidget | null;
  droppedFile?: File | null;
  onDroppedFileConsumed?: () => void;
  hidePoll?: boolean;
  className?: string;
}

export function Composer({
  client,
  roomId,
  threadId,
  replyTo,
  onClearReply,
  onSent,
  stickerWidget,
  droppedFile,
  onDroppedFileConsumed,
  hidePoll = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const prefs = useAtomValue(preferencesAtom);
  const setStickerPickerOpen = useSetAtom(stickerPickerAtom);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');
  const [pollOpen, setPollOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreMenuStyle, setMoreMenuStyle] = useState<React.CSSProperties>({});
  const moreRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const [hasNativeStickers, setHasNativeStickers] = useState(false);
  useEffect(() => {
    if (!client || !roomId) {
      setHasNativeStickers(false);
      return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
      setHasNativeStickers(false);
      return;
    }
    const check = () => {
      const state = roomState(room);
      const raw = state?.getStateEvents('im.ponies.room_emotes');
      const events = Array.isArray(raw) ? raw : raw ? [raw] : [];
      for (const ev of events) {
        const content = ev.getContent() as Record<string, unknown>;
        const pack = content?.pack as Record<string, unknown> | undefined;
        const packUsage = pack?.usage as string[] | undefined;
        const images = content?.images as
          | Record<string, { url: string; usage?: string[] }>
          | undefined;
        if (!images) continue;
        for (const img of Object.values(images)) {
          const usage = img.usage ?? packUsage ?? ['emoticon', 'sticker'];
          if (img.url && usage.includes('sticker')) {
            setHasNativeStickers(true);
            return;
          }
        }
      }
      setHasNativeStickers(false);
    };
    check();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    room.on('RoomState.events' as any, check);
    return () => {
      room.off('RoomState.events' as any, check);
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, [client, roomId]);

  const menuItems: string[] = [];
  if (!hidePoll && prefs.composerMenuPoll) menuItems.push('poll');
  if (prefs.composerMenuEmoji) menuItems.push('emoji');
  if (stickerWidget) menuItems.push('sticker');
  if (hasNativeStickers && prefs.composerMenuSticker) menuItems.push('nativeSticker');
  if (prefs.composerMenuGif) menuItems.push('gif');
  const showMore = menuItems.length > 0;

  useEffect(() => {
    if (!moreOpen) {
      setMoreMenuStyle({});
      return;
    }
    const btn = moreBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setMoreMenuStyle({
        position: 'fixed',
        zIndex: 9000,
        right: window.innerWidth - rect.right,
        top: rect.top - 4,
        transform: 'translateY(-100%)',
      });
    }
    const handle = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [moreOpen]);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  const {
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
  } = useComposer({
    client,
    roomId,
    threadId,
    replyTo,
    onClearReply,
    onSent,
    droppedFile,
    onDroppedFileConsumed,
  });

  return (
    <>
      <div
        ref={composerWrapRef}
        className={`${css.composerWrap}${className ? ` ${className}` : ''}`}
      >
        <TypingIndicator client={client} roomId={roomId} />
        {replyTo && (
          <ReplyPreview replyTo={replyTo} onClear={onClearReply} client={client} roomId={roomId} />
        )}

        <AutocompleteDropdown
          state={autocomplete.state}
          client={client}
          onSelect={handleAutocompleteSelect}
          anchorRef={composerWrapRef}
        />

        {toolbar && (
          <FormatToolbar
            top={toolbar.top}
            left={toolbar.left}
            activeFormats={toolbar.activeFormats}
            onFormat={applyFormat}
          />
        )}

        {uploadProgress !== null && uploadFileInfo && (
          <div className={css.uploadProgressBar}>
            <span className={css.uploadProgressLabel}>
              {uploadFileInfo.name} | {formatFileSize(uploadFileInfo.size)}
            </span>
            <Tooltip content={t('composer.cancelUpload')}>
              <button
                type="button"
                className={css.uploadCancelBtn}
                onClick={cancelUpload}
                aria-label={t('composer.cancelUpload')}
              >
                <XIcon size={14} />
              </button>
            </Tooltip>
            <div
              className={css.uploadProgressFill}
              style={{ width: `${Math.round(uploadProgress * 100)}%` }}
            />
          </div>
        )}

        <div className={css.inputRow}>
          <Tooltip content={t('composer.attach')}>
            <button
              type="button"
              className={css.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              aria-label={t('composer.attach')}
            >
              <PlusIcon size={18} />
            </button>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            className={css.hiddenInput}
            onChange={handleFileSelect}
          />

          <RichComposer
            editor={editor}
            value={editorValue}
            onChange={handleEditorChange}
            onSend={sendMessage}
            onKeyDown={handleEditorKeyDown}
            onSelectionChange={updateToolbar}
            onPaste={handlePaste}
            placeholder={t('composer.typeMessage')}
            className={css.richEditor}
          />

          {!hidePoll && !prefs.composerMenuPoll && (
            <Tooltip content={t('composer.poll.create')}>
              <button
                type="button"
                className={css.emojiBtn}
                aria-label={t('composer.poll.create')}
                onClick={() => setPollOpen(true)}
              >
                <ChartBarHorizontalIcon size={20} />
              </button>
            </Tooltip>
          )}

          {!prefs.composerMenuEmoji && (
            <Tooltip content={t('composer.emoji')}>
              <button
                type="button"
                className={
                  mediaPickerOpen && mediaPickerTab === 'emoji' ? css.emojiBtnActive : css.emojiBtn
                }
                aria-label={t('composer.emoji')}
                onClick={() => {
                  if (mediaPickerOpen && mediaPickerTab === 'emoji') {
                    setMediaPickerOpen(false);
                  } else {
                    setMediaPickerTab('emoji');
                    setMediaPickerOpen(true);
                  }
                }}
              >
                <SmileyIcon
                  size={20}
                  weight={mediaPickerOpen && mediaPickerTab === 'emoji' ? 'fill' : 'regular'}
                />
              </button>
            </Tooltip>
          )}

          {hasNativeStickers && !prefs.composerMenuSticker && (
            <Tooltip content={t('composer.stickers')}>
              <button
                type="button"
                className={
                  mediaPickerOpen && mediaPickerTab === 'sticker'
                    ? css.emojiBtnActive
                    : css.emojiBtn
                }
                aria-label={t('composer.stickers')}
                onClick={() => {
                  if (mediaPickerOpen && mediaPickerTab === 'sticker') {
                    setMediaPickerOpen(false);
                  } else {
                    setMediaPickerTab('sticker');
                    setMediaPickerOpen(true);
                  }
                }}
              >
                <StickerIcon size={20} />
              </button>
            </Tooltip>
          )}

          {!prefs.composerMenuGif && (
            <Tooltip content={t('composer.gif')}>
              <button
                type="button"
                className={
                  mediaPickerOpen && mediaPickerTab === 'gif' ? css.emojiBtnActive : css.emojiBtn
                }
                aria-label={t('composer.gif')}
                onClick={() => {
                  if (mediaPickerOpen && mediaPickerTab === 'gif') {
                    setMediaPickerOpen(false);
                  } else {
                    setMediaPickerTab('gif');
                    setMediaPickerOpen(true);
                  }
                }}
              >
                <GifIcon size={20} weight="bold" />
              </button>
            </Tooltip>
          )}

          {showMore && (
            <Tooltip content={t('composer.moreOptions')}>
              <button
                type="button"
                ref={moreBtnRef}
                className={moreOpen ? css.moreBtnActive : css.moreBtn}
                aria-label={t('composer.moreOptions')}
                onClick={() => setMoreOpen((o) => !o)}
              >
                <DotsThreeVerticalIcon size={20} weight="bold" />
              </button>
            </Tooltip>
          )}

          <Tooltip content={t('composer.send')}>
            <button
              type="button"
              className={css.sendBtn}
              onClick={sendMessage}
              disabled={isEmpty}
              aria-label={t('composer.send')}
            >
              <PaperPlaneRightIcon size={18} weight="fill" />
            </button>
          </Tooltip>
        </div>

        {showMore && moreOpen && (
          <div ref={moreRef} className={css.moreMenu} style={moreMenuStyle}>
            {menuItems.includes('poll') && (
              <button
                type="button"
                className={css.moreMenuItem}
                onClick={() => {
                  setPollOpen(true);
                  closeMore();
                }}
              >
                <ChartBarHorizontalIcon size={18} />
                {t('composer.poll.create')}
              </button>
            )}
            {menuItems.includes('emoji') && (
              <button
                type="button"
                className={css.moreMenuItem}
                onClick={() => {
                  setMediaPickerTab('emoji');
                  setMediaPickerOpen(true);
                  closeMore();
                }}
              >
                <SmileyIcon size={18} />
                {t('composer.emoji')}
              </button>
            )}
            {menuItems.includes('sticker') && stickerWidget && (
              <button
                type="button"
                className={css.moreMenuItem}
                onClick={() => {
                  setStickerPickerOpen(true);
                  closeMore();
                }}
              >
                <StickerIcon size={18} />
                {stickerWidget.name || t('composer.stickers')}
              </button>
            )}
            {menuItems.includes('nativeSticker') && (
              <button
                type="button"
                className={css.moreMenuItem}
                onClick={() => {
                  setMediaPickerTab('sticker');
                  setMediaPickerOpen(true);
                  closeMore();
                }}
              >
                <StickerIcon size={18} />
                {t('composer.stickers')}
              </button>
            )}
            {menuItems.includes('gif') && (
              <button
                type="button"
                className={css.moreMenuItem}
                onClick={() => {
                  setMediaPickerTab('gif');
                  setMediaPickerOpen(true);
                  closeMore();
                }}
              >
                <GifIcon size={18} />
                {t('composer.gif')}
              </button>
            )}
          </div>
        )}

        {menuItems.includes('sticker') && stickerWidget && (
          <div className={css.popoverLayer}>
            <StickerPicker
              client={client}
              roomId={roomId}
              threadId={threadId}
              widgetUrl={stickerWidget.url}
              widgetName={stickerWidget.name}
            />
          </div>
        )}
        {mediaPickerOpen && (
          <div className={css.popoverLayer}>
            <ComposerMediaPicker
              client={client}
              roomId={roomId}
              threadId={threadId}
              initialTab={mediaPickerTab}
              onPickEmoji={(emoji: string) => {
                Transforms.insertText(editor, emoji);
                ReactEditor.focus(editor);
              }}
              onClose={() => setMediaPickerOpen(false)}
            />
          </div>
        )}
      </div>

      <PollCreatorModal
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        client={client}
        roomId={roomId}
        threadId={threadId}
      />
    </>
  );
}
