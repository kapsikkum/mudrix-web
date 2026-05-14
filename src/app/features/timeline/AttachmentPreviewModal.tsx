import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  XIcon,
  PaperPlaneIcon,
  SpinnerGapIcon,
  FileVideoIcon,
  FileImageIcon,
} from '@phosphor-icons/react';
import { Button } from '@/app/components/Button';
import { formatFileSize } from '@/util/format';
import type { UploadPhase } from './encryptedMedia';
import * as css from './AttachmentPreviewModal.css';

interface Props {
  file: File;
  previewUrl: string;
  onSend: (caption: string) => Promise<void>;
  onClose: () => void;
  uploadPhase?: UploadPhase | 'idle';
}

export function AttachmentPreviewModal({ file, previewUrl, onSend, onClose, uploadPhase }: Props) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  // Focus caption textarea on open
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sending) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, sending]);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await onSend(caption.trim());
      // onSend resolves after upload+send, then parent revokes blob and unmounts
    } catch {
      // parent shows toast on error; reset to allow retry
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize caption textarea
  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCaption(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className={css.overlay} onClick={sending ? undefined : onClose}>
      <div className={css.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={css.header}>
          <span className={css.headerTitle}>
            {isImage
              ? t('attachment.sendImage')
              : isVideo
                ? t('attachment.sendVideo')
                : t('attachment.sendFile')}
          </span>
          <button
            className={css.closeBtn}
            onClick={onClose}
            disabled={sending}
            aria-label={t('common.cancel')}
          >
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
          {!isImage && !isVideo && (
            /* Generic file — shouldn't reach here since Composer only opens modal
               for images/videos, but guard anyway */
            <div className={css.mutedText}>{t('attachment.noPreview')}</div>
          )}
        </div>

        {/* File info bar */}
        <div className={css.fileInfo}>
          <div className={css.fileIconWrap}>
            {isVideo ? <FileVideoIcon size={20} /> : <FileImageIcon size={20} />}
          </div>
          <div className={css.fileMeta}>
            <div className={css.fileName} title={file.name}>
              {file.name}
            </div>
            <div className={css.fileSize}>{formatFileSize(file.size)}</div>
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
            disabled={sending}
            rows={2}
          />
        </div>

        {/* Footer */}
        <div className={css.footer}>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={sending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <SpinnerGapIcon size={14} className={`icon-spin ${css.iconMargin}`} />
                {t('common.sending')}
              </>
            ) : (
              <>
                <PaperPlaneIcon size={14} className={css.sendIcon} />
                {t('common.send')}
              </>
            )}
          </Button>
        </div>

        {/* Full-dialog uploading overlay (blocks interaction while sending) */}
        {sending && (
          <div className={css.uploadingOverlay}>
            <SpinnerGapIcon size={28} className="icon-spin" />
            <span>
              {uploadPhase === 'encrypting' ? t('common.encrypting') : t('common.uploading')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
