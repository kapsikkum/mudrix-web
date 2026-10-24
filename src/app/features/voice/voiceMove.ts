import type { MatrixClient } from 'matrix-js-sdk';
import { isActiveSpaceChild, roomState, roomStateMaybe } from '@/util/matrix';

/**
 * Matrix call membership belongs to the person who joined, so nobody else can move them. A person
 * who can manage a space asks instead: this event goes into the voice channel the person is in, and
 * their own client checks the request and joins the other channel.
 */
export const VOICE_MOVE_EVENT_TYPE = 'chat.mudrix.voice_move';

export interface VoiceMoveContent {
  user_id: string;
  to_room_id: string;
}

/** The spaces that list `roomId` as a child, and the spaces above those, as far as we know them. */
export function ancestorSpaces(client: MatrixClient, roomId: string): Set<string> {
  const found = new Set<string>();
  const queue = [roomId];
  // Only spaces we are in: a left or invited space's state is stale or partial.
  const spaces = client.getRooms().filter((r) => r.isSpaceRoom() && r.getMyMembership() === 'join');
  while (queue.length > 0) {
    const child = queue.pop()!;
    for (const space of spaces) {
      if (found.has(space.roomId)) continue;
      const event = roomState(space).getStateEvents('m.space.child', child);
      if (event && isActiveSpaceChild(event)) {
        found.add(space.roomId);
        queue.push(space.roomId);
      }
    }
  }
  return found;
}

/** Whether `userId` manages a space that contains both channels (the level that edits its children). */
export function mayMoveBetween(
  client: MatrixClient,
  userId: string,
  fromRoomId: string,
  toRoomId: string
): boolean {
  if (fromRoomId === toRoomId) return false;
  const above = ancestorSpaces(client, toRoomId);
  for (const spaceId of ancestorSpaces(client, fromRoomId)) {
    if (!above.has(spaceId)) continue;
    const state = roomStateMaybe(client.getRoom(spaceId));
    if (state?.maySendStateEvent('m.space.child', userId)) return true;
  }
  return false;
}

export async function moveVoiceUser(
  client: MatrixClient,
  fromRoomId: string,
  userId: string,
  toRoomId: string
): Promise<void> {
  const content: VoiceMoveContent = { user_id: userId, to_room_id: toRoomId };
  await client.sendEvent(fromRoomId, VOICE_MOVE_EVENT_TYPE as never, content as never);
}
