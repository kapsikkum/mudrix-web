import { ReceiptType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import type { Preferences } from '@/app/store/atoms/settings';

export const RECEIPTABLE_TYPES = ['m.room.message', 'm.sticker', 'm.room.encrypted'] as const;

export function findLastReceiptableEvent(room: Room): MatrixEvent | null {
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.isRedacted?.()) continue;
    if (RECEIPTABLE_TYPES.includes(event.getType() as (typeof RECEIPTABLE_TYPES)[number])) {
      return event;
    }
  }
  return null;
}

export function receiptTypeFor(
  prefs: Preferences
): typeof ReceiptType.Read | typeof ReceiptType.ReadPrivate {
  return prefs.sendReadReceipts ? ReceiptType.Read : ReceiptType.ReadPrivate;
}

export function sendUnthreadedReadReceipt(
  client: MatrixClient,
  event: MatrixEvent,
  prefs: Preferences
): void {
  client.sendReadReceipt(event, receiptTypeFor(prefs), true).catch(() => {});
}
