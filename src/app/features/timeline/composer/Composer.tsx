import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import {
  PlusIcon,
  SmileyIcon,
  StickerIcon,
  PaperPlaneRightIcon,
  XIcon,
  ChartBarHorizontalIcon,
  DotsThreeVerticalIcon,
} from '@phosphor-icons/react';
import { formatFileSize } from '@/util/format';
import { useAtom, useAtomValue } from 'jotai';
import { stickerPickerAtom, preferencesAtom } from '@/app/store/atoms';
import type { RoomWidget } from '@/app/hooks/useWidgets';
import { StickerPicker } from '@/app/features/widget/StickerPicker';
import { Tooltip } from '@/app/components/Tooltip';
import { AutocompleteDropdown } from '../AutocompleteDropdown';
import { ReplyPreview } from './ReplyPreview';
import { FormatToolbar } from './FormatToolbar';
import { TypingIndicator } from './TypingIndicator';
import { useComposer } from './useComposer';
import { PollCreatorModal } from './PollCreatorModal';
import { RichComposer } from './editor/RichComposer';
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
  const [stickerPicker, setStickerPicker] = useAtom(stickerPickerAtom);
  const [pollOpen, setPollOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreMenuStyle, setMoreMenuStyle] = useState<React.CSSProperties>({});
  const moreRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);

  const menuItems: string[] = [];
  if (!hidePoll && prefs.composerMenuPoll) menuItems.push('poll');
  if (prefs.composerMenuEmoji) menuItems.push('emoji');
  if (stickerWidget) menuItems.push('sticker');
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
    isEmojiOpen,
    cancelUpload,
    handleEditorChange,
    handleEditorKeyDown,
    handlePaste,
    handleFileSelect,
    handleAutocompleteSelect,
    handleOpenEmojiPicker,
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
                className={isEmojiOpen ? css.emojiBtnActive : css.emojiBtn}
                aria-label={t('composer.emoji')}
                onClick={handleOpenEmojiPicker}
              >
                <SmileyIcon size={20} weight={isEmojiOpen ? 'fill' : 'regular'} />
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
                onClick={(e) => {
                  handleOpenEmojiPicker(e);
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
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setStickerPicker(
                    stickerPicker ? null : { x: rect.right - 360, y: rect.top - 460 }
                  );
                  closeMore();
                }}
              >
                <StickerIcon size={18} />
                {stickerWidget.name || t('composer.stickers')}
              </button>
            )}
          </div>
        )}

        {menuItems.includes('sticker') && stickerWidget && (
          <div className={css.stickerWrap}>
            <StickerPicker
              client={client}
              roomId={roomId}
              threadId={threadId}
              widgetUrl={stickerWidget.url}
              widgetName={stickerWidget.name}
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
