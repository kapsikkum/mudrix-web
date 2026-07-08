import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixEvent } from 'matrix-js-sdk';
import { CodeIcon, CopyIcon } from '@phosphor-icons/react';
import { Modal } from '@/app/components/Modal';
import { IconButton } from '@/app/components/Button';
import { useToast } from '@/app/hooks/useToast';
import * as css from './ViewSourceModal.css';

interface ViewSourceModalProps {
  event: MatrixEvent | null;
  onClose: () => void;
}

export function ViewSourceModal({ event, onClose }: ViewSourceModalProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const eventId = event?.getId();
  const roomId = event?.getRoomId();

  const decryptedSource = event
    ? {
        content: event.getContent(),
        event_id: event.getId(),
        origin_server_ts: event.getTs(),
        room_id: event.getRoomId(),
        sender: event.getSender(),
        type: event.getType(),
        unsigned: (event.event as Record<string, unknown>)?.unsigned ?? {},
      }
    : null;

  const originalSource = event?.event ?? null;

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(
        () => toast.success(t('common.copied')),
        () => toast.error(t('common.copyFailed'))
      );
    },
    [toast, t]
  );

  if (!event) return null;

  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title={t('timeline.viewSourceTitle')}
      titleIcon={<CodeIcon size={18} />}
      size="xl"
    >
      <div className={css.metaRow}>
        <span className={css.metaLabel}>{t('timeline.roomId')}:</span>
        <code className={css.metaValue}>{roomId}</code>
        <IconButton
          size="sm"
          onClick={() => copyToClipboard(roomId ?? '')}
          aria-label={t('common.copy')}
        >
          <CopyIcon size={14} />
        </IconButton>
      </div>
      <div className={css.metaRow}>
        <span className={css.metaLabel}>{t('timeline.eventId')}:</span>
        <code className={css.metaValue}>{eventId}</code>
        <IconButton
          size="sm"
          onClick={() => copyToClipboard(eventId ?? '')}
          aria-label={t('common.copy')}
        >
          <CopyIcon size={14} />
        </IconButton>
      </div>

      <div className={css.section}>
        <div className={css.sectionHeader}>
          <span className={css.sectionTitle}>{t('timeline.decryptedSource')}</span>
          <IconButton
            size="sm"
            onClick={() => copyToClipboard(JSON.stringify(decryptedSource, null, 2))}
            aria-label={t('common.copy')}
          >
            <CopyIcon size={14} />
          </IconButton>
        </div>
        <pre className={css.jsonBlock}>{JSON.stringify(decryptedSource, null, 2)}</pre>
      </div>

      <div className={css.section}>
        <div className={css.sectionHeader}>
          <span className={css.sectionTitle}>{t('timeline.originalSource')}</span>
          <IconButton
            size="sm"
            onClick={() => copyToClipboard(JSON.stringify(originalSource, null, 2))}
            aria-label={t('common.copy')}
          >
            <CopyIcon size={14} />
          </IconButton>
        </div>
        <pre className={css.jsonBlock}>{JSON.stringify(originalSource, null, 2)}</pre>
      </div>
    </Modal>
  );
}
