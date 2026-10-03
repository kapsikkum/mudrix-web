import { useState, useCallback, useLayoutEffect, useId } from 'react';
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
  GifIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react';
import { formatFileSize } from '@/util/format';
import { useAtomValue, useSetAtom } from 'jotai';
import {
  stickerPickerAtom,
  editMessageAtom,
  editComposerEmojiInserterAtom,
} from '@/app/store/atoms';
import type { RoomWidget } from '@/app/hooks/useWidgets';
import { StickerPicker } from '@/app/features/widget/StickerPicker';
import { ComposerMediaPicker } from '@/app/features/timeline/composer/ComposerMediaPicker';
import { Tooltip } from '@/app/components/Tooltip';
import { AutocompleteDropdown } from '../AutocompleteDropdown';
import { ReplyPreview } from './ReplyPreview';
import { FormatToolbar } from './FormatToolbar';
import { LinkInputPopover } from './LinkInputPopover';
import { TypingIndicator } from './TypingIndicator';
import { useComposer } from './useComposer';
import { PollCreatorModal } from './PollCreatorModal';
import { RichComposer } from './editor/RichComposer';
import { insertEmoji } from './editor/insertEmoji';
import { anchorFromElement, isMenuOpenKey, useContextMenu } from '@/app/hooks/useContextMenu';
import { contextMenuAtom } from '@/app/features/contextMenu/contextMenuAtom';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import * as css from '../Composer.css';

interface Props {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  replyTo: MatrixEvent | null;
  onClearReply: () => void;
  onSent?: () => void;
  stickerWidget?: RoomWidget | null;
  droppedFile?: File[] | null;
  onDroppedFileConsumed?: () => void;
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
  className,
}: Props) {
  const { t } = useTranslation();
  const stickerPickerOpen = useAtomValue(stickerPickerAtom);
  const setStickerPickerOpen = useSetAtom(stickerPickerAtom);
  const editState = useAtomValue(editMessageAtom);
  const editComposerEmojiInserter = useAtomValue(editComposerEmojiInserterAtom);
  const editingInThisRoom = editState?.roomId === roomId && editComposerEmojiInserter != null;
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerTab, setMediaPickerTab] = useState<'emoji' | 'sticker' | 'gif'>('emoji');
  const [gifSending, setGifSending] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const autocompleteListId = useId();

  const { openContextMenuAt } = useContextMenu();
  const contextMenu = useAtomValue(contextMenuAtom);
  const [moreOpener, setMoreOpener] = useState<HTMLElement | null>(null);
  const moreOpen = !!contextMenu && contextMenu.opener === moreOpener;

  const openMoreMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>) => {
      const trigger = e.currentTarget;
      const items: ContextMenuItem[] = [
        {
          label: t('composer.poll.create'),
          icon: <ChartBarHorizontalIcon size={14} />,
          onClick: () => setPollOpen(true),
        },
      ];
      if (stickerWidget) {
        items.push({
          label: stickerWidget.name || t('composer.stickers'),
          icon: <StickerIcon size={14} />,
          onClick: () => setStickerPickerOpen(true),
        });
      }
      setMoreOpener(trigger);
      openContextMenuAt(items, anchorFromElement(trigger), trigger);
    },
    [openContextMenuAt, setStickerPickerOpen, stickerWidget, t]
  );

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
    handleAutocompleteHover,
    applyFormat,
    updateToolbar,
    linkPopover,
    submitLink,
    cancelLink,
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

  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    const wrap = composerWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setPopoverStyle({
      right: window.innerWidth - rect.right + 12,
      bottom: window.innerHeight - rect.top + 4,
    });
  }, [composerWrapRef, mediaPickerOpen]);

  return (
    <>
      <div
        ref={composerWrapRef}
        className={`${css.composerWrap}${className ? ` ${className}` : ''}`}
      >
        {!threadId && <TypingIndicator client={client} roomId={roomId} />}
        {replyTo && (
          <ReplyPreview replyTo={replyTo} onClear={onClearReply} client={client} roomId={roomId} />
        )}

        <AutocompleteDropdown
          state={autocomplete.state}
          client={client}
          onSelect={handleAutocompleteSelect}
          onHover={handleAutocompleteHover}
          anchorRef={composerWrapRef}
          listId={autocompleteListId}
        />

        {gifSending && (
          <div className={css.gifSendStatus}>
            <SpinnerGapIcon size={14} className="icon-spin" />
            <span>{t('composer.sendingGif')}</span>
          </div>
        )}

        {uploadProgress !== null && uploadFileInfo && (
          <div className={css.uploadProgressBar}>
            <span className={css.uploadProgressLabel}>
              {uploadFileInfo.name}
              {uploadFileInfo.total > 1
                ? ` (${uploadFileInfo.current}/${uploadFileInfo.total}) | ${formatFileSize(uploadFileInfo.size)}`
                : ` | ${formatFileSize(uploadFileInfo.size)}`}
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

        <div className={css.inputArea}>
          {toolbar && (
            <FormatToolbar activeFormats={toolbar.activeFormats} onFormat={applyFormat} />
          )}

          {linkPopover && (
            <LinkInputPopover
              defaultUrl={linkPopover.defaultValue}
              onSubmit={submitLink}
              onCancel={cancelLink}
            />
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
              multiple
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
              client={client}
              ariaLabel={t('composer.messageInput')}
              autocompleteListId={autocompleteListId}
              autocompleteOpen={
                autocomplete.state.open && autocomplete.state.suggestions.length > 0
              }
              autocompleteActiveId={
                autocomplete.state.open && autocomplete.state.suggestions.length > 0
                  ? `${autocompleteListId}-option-${autocomplete.state.selectedIndex}`
                  : undefined
              }
            />

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

            <Tooltip content={t('composer.moreOptions')}>
              <button
                type="button"
                className={moreOpen ? css.moreBtnActive : css.moreBtn}
                aria-label={t('composer.moreOptions')}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                onClick={openMoreMenu}
                onKeyDown={(e) => {
                  if (!isMenuOpenKey(e)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  openMoreMenu(e);
                }}
              >
                <DotsThreeVerticalIcon size={20} weight="bold" />
              </button>
            </Tooltip>

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
        </div>

        {stickerWidget && stickerPickerOpen && (
          <div className={css.popoverLayerFixed} style={popoverStyle}>
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
          <div className={css.popoverLayerFixed} style={popoverStyle}>
            <ComposerMediaPicker
              client={client}
              roomId={roomId}
              threadId={threadId}
              initialTab={mediaPickerTab}
              onPickEmoji={(emoji: string, mxcUrl?: string) => {
                if (editingInThisRoom && editComposerEmojiInserter) {
                  editComposerEmojiInserter(emoji, mxcUrl);
                } else {
                  insertEmoji(editor, emoji, mxcUrl);
                }
              }}
              onClose={() => setMediaPickerOpen(false)}
              onGifStatusChange={setGifSending}
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
