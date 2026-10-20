import { useState } from 'react';
import { Direction } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/app/components/Modal/Modal';
import { Button } from '@/app/components/Button/Button';
import { Input } from '@/app/components/Input/Input';
import { useToast } from '@/app/hooks/useToast';
import * as dialogCss from '@/app/components/Dialog/Dialog.css';

interface Props {
  open: boolean;
  onClose: () => void;
  client: MatrixClient;
  roomId: string;
  onJump: (eventId: string) => void;
}

function toDateInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses a YYYY-MM-DD input value as local midnight (not UTC). */
function startOfLocalDay(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

function errcodeOf(err: unknown): string | undefined {
  return (err as { errcode?: string } | null)?.errcode;
}

export function JumpToDateModal({ open, onClose, client, roomId, onJump }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [value, setValue] = useState(() => toDateInputValue(new Date()));
  const [busy, setBusy] = useState(false);
  const today = toDateInputValue(new Date());

  const submit = async () => {
    const ts = startOfLocalDay(value);
    if (ts === null || busy) return;
    setBusy(true);
    try {
      let eventId: string | undefined;
      try {
        eventId = (await client.timestampToEvent(roomId, ts, Direction.Forward)).event_id;
      } catch (err) {
        // Nothing at or after that date: fall back to the closest earlier event.
        if (errcodeOf(err) !== 'M_NOT_FOUND') throw err;
        eventId = (await client.timestampToEvent(roomId, ts, Direction.Backward)).event_id;
      }
      onClose();
      if (eventId) onJump(eventId);
    } catch (err) {
      const code = errcodeOf(err);
      if (code === 'M_NOT_FOUND') toast.info(t('room.jumpToDate.notFound'));
      else if (code === 'M_UNRECOGNIZED') toast.error(t('room.jumpToDate.unsupported'));
      else toast.error(t('room.jumpToDate.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('room.jumpToDate.title')}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="md" onClick={submit} disabled={busy || !value}>
            {t('room.jumpToDate.jump')}
          </Button>
        </>
      }
    >
      <p className={dialogCss.dialogMessage}>{t('room.jumpToDate.description')}</p>
      <Input
        type="date"
        value={value}
        max={today}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        data-dialog-autofocus
      />
    </Modal>
  );
}
