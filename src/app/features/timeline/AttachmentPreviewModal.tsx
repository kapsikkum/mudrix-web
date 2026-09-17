import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  serverUploadLimitAtom,
  attachmentPreviewAtom,
  attachmentPendingSendAtom,
  type AttachmentPreviewItem,
} from '@/app/store/atoms';
import {
  PaperPlaneRightIcon,
  FileAudioIcon,
  FileTextIcon,
  WarningIcon,
  XIcon,
} from '@phosphor-icons/react';
import { Button } from '@/app/components/Button';
import { Dialog } from '@/app/components/Dialog/Dialog';
import { Tooltip } from '@/app/components/Tooltip';
import { formatFileSize } from '@/util/format';
import * as css from './AttachmentPreviewModal.css';

function revokeItem(item: AttachmentPreviewItem): void {
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
}

export function AttachmentPreviewModal() {
  const { t } = useTranslation();
  const [items, setItems] = useAtom(attachmentPreviewAtom);
  const setPendingSend = useSetAtom(attachmentPendingSendAtom);
  const maxUploadBytes = useAtomValue(serverUploadLimitAtom);

  const [captions, setCaptions] = useState<Record<string, string>>({});

  const open = items.length > 0;

  // Reset captions on open
  useEffect(() => {
    if (open) setCaptions({});
  }, [open, items]);

  const anyOversized = items.some((i) => i.oversized);
  const firstCaptionIndex = items.findIndex((i) => !i.oversized);

  const handleRemove = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (item) revokeItem(item);
    setItems((prev) => prev.filter((i) => i.id !== id));
    setCaptions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleClose = () => {
    items.forEach(revokeItem);
    setItems([]);
  };

  const handleSend = () => {
    if (anyOversized) return;
    setPendingSend(
      items.map((i) => ({
        file: i.file,
        caption: (captions[i.id] ?? '').trim(),
      }))
    );
    items.forEach(revokeItem);
    setItems([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCaptionChange = (id: string, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCaptions((prev) => ({ ...prev, [id]: e.target.value }));
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  const singleImage = items.length === 1 && items[0].file.type.startsWith('image/');
  const title = singleImage
    ? t('attachment.sendImage')
    : items.length === 1
      ? items[0]?.file.type.startsWith('video/')
        ? t('attachment.sendVideo')
        : items[0]?.file.type.startsWith('audio/')
          ? t('attachment.sendAudio')
          : t('attachment.sendFile')
      : t('attachment.sendFiles', { count: items.length });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="md"
      zIndex={7000}
      title={title}
      className={css.dialog}
      bodyClassName={css.dialogBody}
      ariaLabel={title}
    >
      <div className={css.list}>
        {items.map((item, index) => {
          const isImage = item.file.type.startsWith('image/');
          const isVideo = item.file.type.startsWith('video/');
          const isAudio = item.file.type.startsWith('audio/');
          return (
            <div key={item.id} className={css.item}>
              <div className={css.thumb}>
                {isImage ? (
                  <img src={item.previewUrl} alt={item.file.name} className={css.thumbMedia} />
                ) : isVideo ? (
                  <video
                    src={item.previewUrl}
                    className={css.thumbMedia}
                    muted
                    preload="metadata"
                  />
                ) : isAudio ? (
                  <div className={css.thumbIcon}>
                    <FileAudioIcon size={20} />
                  </div>
                ) : (
                  <div className={css.thumbIcon}>
                    <FileTextIcon size={20} />
                  </div>
                )}
              </div>

              <div className={css.itemBody}>
                <div className={css.fileMeta}>
                  <div className={css.fileName} title={item.file.name}>
                    {item.file.name}
                  </div>
                  <div className={item.oversized ? css.fileSizeOversized : css.fileSize}>
                    {formatFileSize(item.file.size)}
                    {item.oversized && (
                      <>
                        {' '}
                        <WarningIcon size={12} weight="fill" />{' '}
                        {t('attachment.fileTooLarge', { limit: formatFileSize(maxUploadBytes) })}
                      </>
                    )}
                  </div>
                </div>
                <textarea
                  data-dialog-autofocus={index === firstCaptionIndex ? '' : undefined}
                  className={css.captionInput}
                  placeholder={t('attachment.captionPlaceholder')}
                  value={captions[item.id] ?? ''}
                  onChange={(e) => handleCaptionChange(item.id, e)}
                  onKeyDown={handleKeyDown}
                  disabled={item.oversized}
                  rows={1}
                  aria-label={t('attachment.captionLabel')}
                />
              </div>

              <Tooltip content={t('common.remove')}>
                <button
                  type="button"
                  className={css.removeBtn}
                  onClick={() => handleRemove(item.id)}
                  aria-label={t('common.remove')}
                >
                  <XIcon size={14} />
                </button>
              </Tooltip>
            </div>
          );
        })}
      </div>

      <div className={css.footer}>
        <Button variant="secondary" size="sm" onClick={handleClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" size="sm" onClick={handleSend} disabled={anyOversized}>
          <PaperPlaneRightIcon size={14} />
          {t('common.send')}
        </Button>
      </div>
    </Dialog>
  );
}
