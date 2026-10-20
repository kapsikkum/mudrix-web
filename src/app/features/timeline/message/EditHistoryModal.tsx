import { useEffect, useState } from 'react';
import { EventType, RelationType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { ClockCounterClockwiseIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/app/components/Modal';
import { Spinner } from '@/app/components/Spinner';
import { getErrorMessage } from '@/util/error';
import * as css from './EditHistoryModal.css';

interface Props {
  client: MatrixClient;
  /** The (possibly already-replaced) event whose versions are listed; null keeps the modal closed. */
  event: MatrixEvent | null;
  onClose: () => void;
}

interface Version {
  key: string;
  ts: number;
  body: string;
  isOriginal: boolean;
}

const MAX_EDITS = 200;

function bodyOfEdit(edit: MatrixEvent): string {
  const content = edit.getContent() as {
    body?: unknown;
    'm.new_content'?: { body?: unknown };
  };
  const newBody = content['m.new_content']?.body;
  if (typeof newBody === 'string') return newBody;
  return typeof content.body === 'string' ? content.body.replace(/^\* /, '') : '';
}

async function fetchEdits(client: MatrixClient, event: MatrixEvent): Promise<MatrixEvent[]> {
  const roomId = event.getRoomId();
  const eventId = event.getId();
  if (!roomId || !eventId) return [];

  const edits: MatrixEvent[] = [];
  let from: string | undefined;
  try {
    do {
      const page = await client.relations(
        roomId,
        eventId,
        RelationType.Replace,
        EventType.RoomMessage,
        { from, limit: 50 }
      );
      edits.push(...page.events);
      from = page.nextBatch ?? undefined;
    } while (from && edits.length < MAX_EDITS);
    return edits;
  } catch (err) {
    // Server without /relations support: fall back to whatever edits we have locally.
    const local = client
      .getRoom(roomId)
      ?.relations.getChildEventsForEvent(eventId, RelationType.Replace, EventType.RoomMessage)
      ?.getRelations();
    if (local) return local;
    throw err;
  }
}

export function EditHistoryModal({ client, event, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    let cancelled = false;
    setVersions(null);
    setError(null);
    fetchEdits(client, event)
      .then((edits) => {
        if (cancelled) return;
        const sender = event.getSender();
        // Only the original sender may edit; ignore anything else (spec requirement).
        const valid = edits
          .filter((e) => e.getSender() === sender && !e.isRedacted())
          .sort((a, b) => a.getTs() - b.getTs());
        const original = event.getOriginalContent() as { body?: unknown };
        const list: Version[] = [
          {
            key: 'original',
            ts: event.getTs(),
            body: typeof original.body === 'string' ? original.body : '',
            isOriginal: true,
          },
          ...valid.map((e) => ({
            key: e.getId() ?? String(e.getTs()),
            ts: e.getTs(),
            body: bodyOfEdit(e),
            isOriginal: false,
          })),
        ];
        setVersions(list.reverse());
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [client, event]);

  if (!event) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={t('timeline.editHistory.title')}
      titleIcon={<ClockCounterClockwiseIcon size={18} />}
      size="md"
    >
      {error ? (
        <div className={css.status}>{t('timeline.editHistory.failed', { error })}</div>
      ) : !versions ? (
        <div className={css.status}>
          <Spinner />
        </div>
      ) : versions.length <= 1 ? (
        <div className={css.status}>{t('timeline.editHistory.empty')}</div>
      ) : (
        <div className={css.list}>
          {versions.map((v, i) => (
            <div key={v.key} className={css.version}>
              <div className={css.versionMeta}>
                {i === 0 && (
                  <span className={css.versionBadge}>{t('timeline.editHistory.current')}</span>
                )}
                {v.isOriginal && (
                  <span className={css.versionBadge}>{t('timeline.editHistory.original')}</span>
                )}
                <span>{new Date(v.ts).toLocaleString(i18n.language)}</span>
              </div>
              <div className={css.versionBody}>{v.body}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
