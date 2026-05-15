import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { PlusIcon, SmileyIcon, StickerIcon, PaperPlaneIcon } from '@phosphor-icons/react';
import { useAtom } from 'jotai';
import { stickerPickerOpenAtom } from '@/app/store/atoms';
import type { RoomWidget } from '@/app/hooks/useWidgets';
import { StickerPicker } from '@/app/features/widget/StickerPicker';
import { AutocompleteDropdown } from '../AutocompleteDropdown';
import { AttachmentPreviewModal } from '../AttachmentPreviewModal';
import { ReplyPreview } from './ReplyPreview';
import { FormatToolbar } from './FormatToolbar';
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
  } = useComposer({ client, roomId, replyTo, onClearReply, droppedFile, onDroppedFileConsumed });

  return (
    <div ref={composerWrapRef} className={css.composerWrap}>
      {replyTo && <ReplyPreview replyTo={replyTo} onClear={onClearReply} />}

      <AutocompleteDropdown
        state={autocomplete.state}
        client={client}
        onSelect={handleAutocompleteSelect}
      />

      {toolbar && (
        <FormatToolbar top={toolbar.top} left={toolbar.left} onFormat={applyFormat} />
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
          onBlur={() => {/* toolbar intentionally left open on blur so format buttons work */}}
          onPaste={handlePaste}
          rows={1}
        />

        <button
          className={isEmojiOpen ? css.emojiBtnActive : css.emojiBtn}
          title={t('composer.emoji')}
          onClick={handleOpenEmojiPicker}
        >
          <SmileyIcon size={20} weight={isEmojiOpen ? 'fill' : 'regular'} />
        </button>

        {stickerWidget && (
          <div className={css.stickerWrap}>
            <button
              className={stickerPickerOpen ? css.stickerBtnActive : css.stickerBtn}
              title={t('composer.stickers')}
              onClick={() => setStickerPickerOpen((o) => !o)}
            >
              <StickerIcon size={20} />
            </button>
            <StickerPicker client={client} roomId={roomId} widgetUrl={stickerWidget.url} />
          </div>
        )}

        <button className={css.sendBtn} onClick={sendMessage} disabled={!value.trim()}>
          <PaperPlaneIcon size={18} weight="fill" className={css.sendBtnIcon} />
        </button>
      </div>

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
