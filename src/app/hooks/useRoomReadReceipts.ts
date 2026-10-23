import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { sendReadReceiptsAtom } from '@/app/store/atoms/settings';
import { clearRoomMarkedUnread } from '@/util/markedUnread';
import {
  clearRoomNotificationCounts,
  findLastReceiptableEvent,
  hasServerUnreadCounts,
  markRoomRead,
} from '@/app/pages/client/markAsRead';

/** A receipt for the same event is not sent again within this window (its echo may still be due). */
const RESEND_AFTER_MS = 10_000;

export function useRoomReadReceipts(client: MatrixClient, roomId: string): () => void {
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);
  const lastSentRef = useRef<{ eventId: string; at: number } | null>(null);

  // Opening a room counts as reading it, even when there is nothing new to send a receipt for.
  useEffect(() => {
    clearRoomMarkedUnread(client, roomId);
  }, [client, roomId]);

  return useCallback(() => {
    if (!document.hasFocus()) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    const lastEvent = findLastReceiptableEvent(room);
    if (!lastEvent) {
      clearRoomMarkedUnread(client, roomId);
      return;
    }
    const eventId = lastEvent.getId();
    if (!eventId) return;
    // Skip only when the server agrees: our receipt is on this event AND it reports nothing unread.
    // Clearing the counts locally without a receipt would hide the badge until the next reload,
    // when the server's count brings it back.
    const myId = client.getUserId() ?? '';
    const serverRead = room.getEventReadUpTo(myId) === eventId && !hasServerUnreadCounts(room);
    // A receipt just sent for this event is still on its way back through sync; resending it on
    // every timeline update until then floods the server.
    const last = lastSentRef.current;
    const justSent = last?.eventId === eventId && Date.now() - last.at < RESEND_AFTER_MS;
    if (serverRead || justSent) {
      clearRoomMarkedUnread(client, roomId);
      clearRoomNotificationCounts(room);
      return;
    }
    lastSentRef.current = { eventId, at: Date.now() };
    markRoomRead(client, room, sendReadReceipts);
  }, [client, roomId, sendReadReceipts]);
}
