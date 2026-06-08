import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  serverUploadLimitAtom,
  attachmentPreviewAtom,
  attachmentPendingSendAtom,
} from '@/app/store/atoms';
import {
  XIcon,
  PaperPlaneIcon,
  FileVideoIcon,
  FileImageIcon,
  FileAudioIcon,
  FileTextIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { Button } from '@/app/components/Button';
import { formatFileSize } from '@/util/format';
import * as css from './AttachmentPreviewModal.css';

export function AttachmentPreviewModal() {
  const { t } = useTranslation();
  const [data, setData] = useAtom(attachmentPreviewAtom);
  const setPendingSend = useSetAtom(attachmentPendingSendAtom);
  const maxUploadBytes = useAtomValue(serverUploadLimitAtom);

  const [caption, setCaption] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const open = data !== null;
  const file = data?.file ?? null;
  const previewUrl = data?.previewUrl ?? '';
  const oversized = data?.oversized ?? false;

  const isImage = file?.type.startsWith('image/') ?? false;
  const isVideo = file?.type.startsWith('video/') ?? false;
  const isAudio = file?.type.startsWith('audio/') ?? false;

  // Reset caption on open
  useEffect(() => {
    if (open) {
      setCaption('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  // Revoke object URL when modal closes
  useEffect(() => {
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [open, previewUrl]);

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setData(null);
  };

  const handleSend = () => {
    if (oversized) return;
    setPendingSend(caption.trim());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setData(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCaption(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  if (!open || !file) return null;

  const title = isImage
    ? t('attachment.sendImage')
    : isVideo
      ? t('attachment.sendVideo')
      : isAudio
        ? t('attachment.sendAudio')
        : t('attachment.sendFile');

  return (
    <div className={css.overlay} onClick={handleClose}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css.header}>
          <span className={css.headerTitle}>{title}</span>
          <button className={css.closeBtn} onClick={handleClose} aria-label={t('common.cancel')}>
            <XIcon size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className={css.previewArea}>
          {isImage && (
            <img src={previewUrl} alt={file.name} className={css.previewImage} draggable={false} />
          )}
          {isVideo && (
            <video src={previewUrl} className={css.previewVideo} controls preload="metadata" />
          )}
          {isAudio && (
            <audio src={previewUrl} className={css.previewAudio} controls preload="metadata" />
          )}
          {!isImage && !isVideo && !isAudio && (
            <div className={css.genericFilePreview}>
              <div className={css.genericFileIcon}>
                <FileTextIcon size={40} />
              </div>
            </div>
          )}
        </div>

        {/* File info bar */}
        <div className={css.fileInfo}>
          <div className={css.fileIconWrap}>
            {isImage ? (
              <FileImageIcon size={20} />
            ) : isVideo ? (
              <FileVideoIcon size={20} />
            ) : isAudio ? (
              <FileAudioIcon size={20} />
            ) : (
              <FileTextIcon size={20} />
            )}
          </div>
          <div className={css.fileMeta}>
            <div className={css.fileName} title={file.name}>
              {file.name}
            </div>
            <div className={oversized ? css.fileSizeOversized : css.fileSize}>
              {formatFileSize(file.size)}
              {oversized && (
                <>
                  {' '}
                  <WarningIcon size={12} weight="fill" />{' '}
                  {t('attachment.fileTooLarge', { limit: formatFileSize(maxUploadBytes) })}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Caption */}
        <div className={css.captionArea}>
          <textarea
            ref={textareaRef}
            className={css.captionInput}
            placeholder={t('attachment.captionPlaceholder')}
            value={caption}
            onChange={handleCaptionChange}
            onKeyDown={handleKeyDown}
            disabled={oversized}
            rows={2}
          />
        </div>

        {/* Footer */}
        <div className={css.footer}>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSend} disabled={oversized}>
            <PaperPlaneIcon size={14} className={css.sendIcon} />
            {t('common.send')}
          </Button>
        </div>
      </div>
    </div>
  );
}
