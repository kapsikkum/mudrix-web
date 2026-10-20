import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { sendReadReceiptsAtom } from '@/app/store/atoms/settings';
import { clearRoomMarkedUnread } from '@/util/markedUnread';
import {
  clearRoomNotificationCounts,
  findLastReceiptableEvent,
  markRoomRead,
} from '@/app/pages/client/markAsRead';

export function useRoomReadReceipts(client: MatrixClient, roomId: string): () => void {
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);
  const lastEventIdRef = useRef<string | null>(null);

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
    // Only skip when the SDK agrees we are already read up to this event; a failed or superseded
    // receipt must not leave the room stuck as unread.
    const myId = client.getUserId() ?? '';
    if (eventId === lastEventIdRef.current && room.getEventReadUpTo(myId) === eventId) {
      clearRoomMarkedUnread(client, roomId);
      clearRoomNotificationCounts(room);
      return;
    }
    lastEventIdRef.current = eventId;
    markRoomRead(client, room, sendReadReceipts);
  }, [client, roomId, sendReadReceipts]);
}
