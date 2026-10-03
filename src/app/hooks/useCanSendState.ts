import { useCallback, useState } from 'react';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { roomStateMaybe } from '@/util/matrix';
import type { MatrixClient, Room } from 'matrix-js-sdk';

export function useCanSendState(room: Room | null): (type: string) => boolean {
  const client = getMatrixClientOrNull();

  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useMatrixEvent(client, 'RoomState.events', refresh);

  return (type: string) => canSendState(room, type, client, revision);
}

export function canSendState(
  room: Room | null,
  type: string,
  client: MatrixClient | null = getMatrixClientOrNull(),
  _revision?: number
): boolean {
  if (!client || !room) return false;
  return roomStateMaybe(room)?.mayClientSendStateEvent(type, client) ?? false;
}
