import { useCallback, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomStateMaybe } from '@/util/matrix';

/**
 * Whether people who join a space are joined to everything in it. Matrix has no such setting, so
 * Mudrix keeps it in a state event on the space; whoever may change the space's state sets it.
 */
export const SPACE_AUTO_JOIN_STATE_TYPE = 'chat.mudrix.space_auto_join';

export function readSpaceAutoJoin(client: MatrixClient, spaceId: string): boolean {
  const content = roomStateMaybe(client.getRoom(spaceId))
    ?.getStateEvents(SPACE_AUTO_JOIN_STATE_TYPE, '')
    ?.getContent() as Record<string, unknown> | undefined;
  return content?.['enabled'] === true;
}

export async function setSpaceAutoJoin(
  client: MatrixClient,
  spaceId: string,
  enabled: boolean
): Promise<void> {
  await client.sendStateEvent(
    spaceId,
    SPACE_AUTO_JOIN_STATE_TYPE as never,
    { enabled } as never,
    ''
  );
}

/** The space's setting, kept current as the state event changes. */
export function useSpaceAutoJoin(
  client: MatrixClient | null | undefined,
  spaceId: string | null | undefined
): boolean {
  const read = useCallback(
    () => (client && spaceId ? readSpaceAutoJoin(client, spaceId) : false),
    [client, spaceId]
  );
  const [enabled, setEnabled] = useState(read);
  const [lastKey, setLastKey] = useState(`${spaceId}`);
  if (lastKey !== `${spaceId}`) {
    setLastKey(`${spaceId}`);
    setEnabled(read());
  }
  useMatrixEvent(
    client ?? null,
    'RoomState.events',
    (event: { getType: () => string; getRoomId: () => string | undefined }) => {
      if (event.getType() === SPACE_AUTO_JOIN_STATE_TYPE && event.getRoomId() === spaceId) {
        setEnabled(read());
      }
    }
  );
  return enabled;
}
