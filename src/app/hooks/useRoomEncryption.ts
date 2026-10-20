import { useCallback, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

/** Whether the room has an `m.room.encryption` state event; updates when room state changes. */
export function useRoomEncrypted(
  client: MatrixClient | null | undefined,
  roomId: string | null | undefined
): boolean {
  const key = roomId ?? '';
  const read = useCallback(
    () => !!(client && roomId && client.getRoom(roomId)?.hasEncryptionStateEvent()),
    [client, roomId]
  );
  const [state, setState] = useState<{ key: string; value: boolean }>(() => ({
    key,
    value: read(),
  }));

  useMatrixEvent(client, 'RoomState.events', (ev: { getType(): string; getRoomId(): string }) => {
    if (ev.getType() !== 'm.room.encryption' || ev.getRoomId() !== roomId) return;
    setState({ key, value: read() });
  });

  // Switching rooms: derive synchronously instead of waiting for an effect.
  if (state.key !== key) {
    const value = read();
    setState({ key, value });
    return value;
  }
  return state.value;
}
