import { useCallback, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import type { RoomListStyle } from '@/app/store/atoms/settings';
import { roomStateMaybe, rootSpaceId } from '@/util/matrix';
import { isMudrixType, mudrixKey, newestStateEvent, sendMudrixState } from '@/util/namespace';

/**
 * How a space's rooms are listed: 'matrix' (an avatar on every room) or 'modern' (plain channel
 * rows, voice channels, a set order). It belongs to the space, so everyone sees the same list, and
 * whoever may change the space's state sets it. A space with none set is 'matrix'. A space inside
 * another one (a category pinned to the sidebar) follows the top space it is in.
 */
export const SPACE_LIST_STYLE_STATE_TYPE = mudrixKey('space_list_style');

export const DEFAULT_SPACE_LIST_STYLE: RoomListStyle = 'matrix';

/** The style set on exactly this space, ignoring the spaces around it. */
function ownStyle(client: MatrixClient, spaceId: string): RoomListStyle {
  const content = newestStateEvent(
    roomStateMaybe(client.getRoom(spaceId)),
    SPACE_LIST_STYLE_STATE_TYPE,
    ''
  )?.getContent() as Record<string, unknown> | undefined;
  return content?.['style'] === 'modern' ? 'modern' : DEFAULT_SPACE_LIST_STYLE;
}

export function readSpaceListStyle(client: MatrixClient, spaceId: string): RoomListStyle {
  return ownStyle(client, rootSpaceId(client, spaceId));
}

export async function setSpaceListStyle(
  client: MatrixClient,
  spaceId: string,
  style: RoomListStyle
): Promise<void> {
  await sendMudrixState(client, spaceId, SPACE_LIST_STYLE_STATE_TYPE, { style });
}

/** State events that can change what a space's style resolves to. */
function affectsStyle(type: string): boolean {
  return type === 'm.space.child' || isMudrixType(type, SPACE_LIST_STYLE_STATE_TYPE);
}

/**
 * The space's list style, kept current as it changes. Right after a reload the space's state and
 * the spaces above it may not be loaded yet, so it is read again as rooms and state arrive instead
 * of settling on the default.
 */
export function useSpaceListStyle(
  client: MatrixClient | null | undefined,
  spaceId: string | null | undefined
): RoomListStyle {
  const read = useCallback(
    () => (client && spaceId ? readSpaceListStyle(client, spaceId) : DEFAULT_SPACE_LIST_STYLE),
    [client, spaceId]
  );
  const [style, setStyle] = useState(read);
  const [lastKey, setLastKey] = useState(`${spaceId}`);
  if (lastKey !== `${spaceId}`) {
    setLastKey(`${spaceId}`);
    setStyle(read());
  }
  useMatrixEvent(client ?? null, 'RoomState.events', (event: { getType: () => string }) => {
    if (affectsStyle(event.getType())) setStyle(read());
  });
  useMatrixEvent(client ?? null, 'Room', () => setStyle(read()));
  useMatrixEvent(client ?? null, 'sync', (state: string) => {
    if (state === 'PREPARED' || state === 'SYNCING') setStyle(read());
  });
  return style;
}
