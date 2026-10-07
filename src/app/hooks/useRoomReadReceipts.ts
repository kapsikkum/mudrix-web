import { useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { sendReadReceiptsAtom } from '@/app/store/atoms/settings';
import { findLastReceiptableEvent, sendUnthreadedReadReceipt } from '@/app/pages/client/markAsRead';

export function useRoomReadReceipts(client: MatrixClient, roomId: string): () => void {
  const sendReadReceipts = useAtomValue(sendReadReceiptsAtom);
  const lastEventIdRef = useRef<string | null>(null);

  return useCallback(() => {
    if (!document.hasFocus()) return;
    const room = client.getRoom(roomId);
    if (!room) return;
    const lastEvent = findLastReceiptableEvent(room);
    if (!lastEvent) return;
    const eventId = lastEvent.getId();
    if (!eventId || eventId === lastEventIdRef.current) return;
    lastEventIdRef.current = eventId;
    sendUnthreadedReadReceipt(client, lastEvent, sendReadReceipts);
    client.setRoomReadMarkers(roomId, eventId).catch(() => {});
  }, [client, roomId, sendReadReceipts]);
}
