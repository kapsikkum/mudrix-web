import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { PlusIcon, SmileyIcon, StickerIcon, PaperPlaneIcon, XIcon } from '@phosphor-icons/react';
import { formatFileSize } from '@/util/format';
import { useAtom } from 'jotai';
import { stickerPickerOpenAtom } from '@/app/store/atoms';
import type { RoomWidget } from '@/app/hooks/useWidgets';
import { StickerPicker } from '@/app/features/widget/StickerPicker';
import { Tooltip } from '@/app/components/Tooltip';
import { AutocompleteDropdown } from '../AutocompleteDropdown';
import { ReplyPreview } from './ReplyPreview';
import { FormatToolbar } from './FormatToolbar';
import { TypingIndicator } from './TypingIndicator';
import { useComposer } from './useComposer';
import * as css from '../Composer.css';

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
  const [stickerPickerOpen, setStickerPickerOpen] = useAtom(stickerPickerOpenAtom);

  const {
    value,
    textareaRef,
    fileInputRef,
    composerWrapRef,
    toolbar,
    autocomplete,
    uploadProgress,
    uploadFileInfo,
    isEmojiOpen,
    cancelUpload,
    handleChange,
    handleKeyDown,
    handlePaste,
    handleFileSelect,
    handleAutocompleteSelect,
    handleOpenEmojiPicker,
    applyFormat,
    updateToolbar,
    sendMessage,
  } = useComposer({ client, roomId, replyTo, onClearReply, droppedFile, onDroppedFileConsumed });

  return (
    <div ref={composerWrapRef} className={css.composerWrap}>
      <TypingIndicator client={client} roomId={roomId} />
      {replyTo && <ReplyPreview replyTo={replyTo} onClear={onClearReply} />}

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

        <textarea
          ref={textareaRef}
          className={css.textarea}
          placeholder={t('composer.typeMessage')}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onMouseUp={updateToolbar}
          onKeyUp={updateToolbar}
          onBlur={() => {
            /* toolbar intentionally left open on blur so format buttons work */
          }}
          onPaste={handlePaste}
          rows={1}
        />

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

        {stickerWidget && (
          <div className={css.stickerWrap}>
            <Tooltip content={t('composer.stickers')}>
              <button
                type="button"
                className={stickerPickerOpen ? css.stickerBtnActive : css.stickerBtn}
                aria-label={t('composer.stickers')}
                onClick={() => setStickerPickerOpen((o) => !o)}
              >
                <StickerIcon size={20} />
              </button>
            </Tooltip>
            <StickerPicker client={client} roomId={roomId} widgetUrl={stickerWidget.url} />
          </div>
        )}

        <Tooltip content={t('composer.send')}>
          <button
            type="button"
            className={css.sendBtn}
            onClick={sendMessage}
            disabled={!value.trim()}
            aria-label={t('composer.send')}
          >
            <PaperPlaneIcon size={18} weight="fill" className={css.sendBtnIcon} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
