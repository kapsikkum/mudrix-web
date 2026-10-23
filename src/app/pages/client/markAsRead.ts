import { NotificationCountType, ReceiptType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { clearRoomMarkedUnread } from '@/util/markedUnread';

/**
 * The newest event in the live timeline the server knows about, of any type. The receipt has to
 * cover reactions, edits, polls and the like too: the server counts those as unread (in an
 * encrypted room it cannot tell them from messages), so a receipt on the last message alone
 * leaves its count above zero.
 */
export function findLastReceiptableEvent(room: Room): MatrixEvent | null {
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    // An event still being sent has a local id the server does not know; a receipt for it is rejected.
    if (event.getId()?.startsWith('~') || event.status != null) continue;
    if (event.getId()) return event;
  }
  return null;
}

/** Whether the server still reports unread notifications for the room or any of its threads. */
export function hasServerUnreadCounts(room: Room): boolean {
  return (
    room.getUnreadNotificationCount(NotificationCountType.Total) > 0 ||
    room.getUnreadNotificationCount(NotificationCountType.Highlight) > 0
  );
}

export function receiptTypeFor(
  sendReadReceipts: boolean
): typeof ReceiptType.Read | typeof ReceiptType.ReadPrivate {
  return sendReadReceipts ? ReceiptType.Read : ReceiptType.ReadPrivate;
}

export function sendUnthreadedReadReceipt(
  client: MatrixClient,
  event: MatrixEvent,
  sendReadReceipts: boolean
): void {
  client.sendReadReceipt(event, receiptTypeFor(sendReadReceipts), true).catch(() => {});
  const roomId = event.getRoomId();
  if (roomId) clearRoomMarkedUnread(client, roomId);
}

/**
 * Zeroes the SDK's main-timeline notification counts for the room. The SDK never resets the
 * highlight count of an encrypted room once it is non-zero (it only ever trusts its own
 * client-side increments), so after reading we have to do it ourselves, like Element does.
 * Returns true when something changed.
 */
export function clearRoomNotificationCounts(room: Room): boolean {
  let changed = false;
  for (const type of [NotificationCountType.Total, NotificationCountType.Highlight]) {
    if (room.getRoomUnreadNotificationCount(type) > 0) {
      room.setUnreadNotificationCount(type, 0);
      changed = true;
    }
  }
  return changed;
}

/**
 * Marks a room as read: sends the receipt for its latest event, moves the fully-read marker,
 * clears the marked-unread flag (all prefixes) and the SDK notification counts.
 */
export function markRoomRead(
  client: MatrixClient,
  room: Room,
  sendReadReceipts: boolean
): MatrixEvent | null {
  clearRoomMarkedUnread(client, room.roomId);
  const lastEvent = findLastReceiptableEvent(room);
  const eventId = lastEvent?.getId();
  if (lastEvent && eventId) {
    sendUnthreadedReadReceipt(client, lastEvent, sendReadReceipts);
    client.setRoomReadMarkers(room.roomId, eventId).catch(() => {});
  }
  clearRoomNotificationCounts(room);
  return lastEvent;
}
