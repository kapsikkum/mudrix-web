import { useCallback, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomStateMaybe } from '@/util/matrix';
import { isMudrixType, mudrixKey, newestStateEvent, sendMudrixState } from '@/util/namespace';
import { SPACE_LIST_STYLE_STATE_TYPE, readSpaceListStyle } from './spaceListStyle';

/**
 * Whether people who join a space are joined to everything in it. Matrix has no such setting, so
 * Mudrix keeps it in a state event on the space; whoever may change the space's state sets it.
 *
 * With no event set, a Modern style space auto-joins (its list only shows rooms you are in, so it
 * would look empty otherwise) and a Matrix style one does not. A set event always wins.
 */
export const SPACE_AUTO_JOIN_STATE_TYPE = mudrixKey('space_auto_join');

/** The space's own setting, or null when it has none and the list style decides. */
export function readExplicitSpaceAutoJoin(client: MatrixClient, spaceId: string): boolean | null {
  const content = newestStateEvent(
    roomStateMaybe(client.getRoom(spaceId)),
    SPACE_AUTO_JOIN_STATE_TYPE,
    ''
  )?.getContent() as Record<string, unknown> | undefined;
  const enabled = content?.['enabled'];
  return typeof enabled === 'boolean' ? enabled : null;
}

export function readSpaceAutoJoin(client: MatrixClient, spaceId: string): boolean {
  return (
    readExplicitSpaceAutoJoin(client, spaceId) ?? readSpaceListStyle(client, spaceId) === 'modern'
  );
}

export async function setSpaceAutoJoin(
  client: MatrixClient,
  spaceId: string,
  enabled: boolean
): Promise<void> {
  await sendMudrixState(client, spaceId, SPACE_AUTO_JOIN_STATE_TYPE, { enabled });
}

/** The space's setting (or its default), kept current as either state event changes. */
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
      const type = event.getType();
      if (
        (isMudrixType(type, SPACE_AUTO_JOIN_STATE_TYPE) ||
          isMudrixType(type, SPACE_LIST_STYLE_STATE_TYPE)) &&
        event.getRoomId() === spaceId
      ) {
        setEnabled(read());
      }
    }
  );
  return enabled;
}
