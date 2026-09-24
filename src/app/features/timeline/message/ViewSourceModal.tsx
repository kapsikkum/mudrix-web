import { useTranslation } from 'react-i18next';
import type { MatrixEvent } from 'matrix-js-sdk';
import { CodeIcon } from '@phosphor-icons/react';
import { Modal } from '@/app/components/Modal';
import { CopyButton } from '@/app/components/Button';
import * as css from './ViewSourceModal.css';

interface ViewSourceModalProps {
  event: MatrixEvent | null;
  onClose: () => void;
}

export function ViewSourceModal({ event, onClose }: ViewSourceModalProps) {
  const { t } = useTranslation();

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
        <CopyButton text={roomId ?? ''} />
      </div>
      <div className={css.metaRow}>
        <span className={css.metaLabel}>{t('timeline.eventId')}:</span>
        <code className={css.metaValue}>{eventId}</code>
        <CopyButton text={eventId ?? ''} />
      </div>

      <div className={css.section}>
        <div className={css.sectionHeader}>
          <span className={css.sectionTitle}>{t('timeline.decryptedSource')}</span>
          <CopyButton text={JSON.stringify(decryptedSource, null, 2)} />
        </div>
        <pre className={css.jsonBlock}>{JSON.stringify(decryptedSource, null, 2)}</pre>
      </div>

      <div className={css.section}>
        <div className={css.sectionHeader}>
          <span className={css.sectionTitle}>{t('timeline.originalSource')}</span>
          <CopyButton text={JSON.stringify(originalSource, null, 2)} />
        </div>
        <pre className={css.jsonBlock}>{JSON.stringify(originalSource, null, 2)}</pre>
      </div>
    </Modal>
  );
}
