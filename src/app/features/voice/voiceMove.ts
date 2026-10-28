import type { MatrixClient } from 'matrix-js-sdk';
import { isActiveSpaceChild, roomState, roomStateMaybe } from '@/util/matrix';
import { legacyTypeOf, mudrixKey } from '@/util/namespace';

/**
 * Matrix call membership belongs to the person who joined, so nobody else can move them. A person
 * who can manage a space asks instead: this event goes into the voice channel the person is in, and
 * their own client checks the request and joins the other channel.
 */
export const VOICE_MOVE_EVENT_TYPE = mudrixKey('voice_move');

export interface VoiceMoveContent {
  user_id: string;
  to_room_id: string;
  /**
   * Shared by the two events (current and legacy type) one move sends, so a client that reads both
   * acts once. Absent from moves sent by older versions, which send only the legacy type.
   */
  move_id?: string;
}

/**
 * Whether `roomId` agrees that `spaceId` is its parent. A child link alone is one-sided: any admin of
 * a space can list somebody else's room, so the room has to name the space back with an
 * `m.space.parent`, which only people with power in the room can send. A room that predates that
 * (or was moved by someone without power in it) still counts when the sender could have set it.
 */
function confirmsParent(
  client: MatrixClient,
  roomId: string,
  spaceId: string,
  senderId: string
): boolean {
  const state = roomStateMaybe(client.getRoom(roomId));
  if (!state) return false;
  const via = (
    state.getStateEvents('m.space.parent', spaceId)?.getContent() as { via?: unknown } | undefined
  )?.via;
  if (Array.isArray(via) && via.length > 0) return true;
  return state.maySendStateEvent('m.space.parent', senderId);
}

/**
 * The spaces above `roomId`, as far as we know them, following only links both sides agree on and
 * only through spaces we are in (a left or invited space's state is stale or partial).
 */
export function ancestorSpaces(
  client: MatrixClient,
  roomId: string,
  senderId: string
): Set<string> {
  const found = new Set<string>();
  const queue = [roomId];
  const spaces = client.getRooms().filter((r) => r.isSpaceRoom() && r.getMyMembership() === 'join');
  while (queue.length > 0) {
    const child = queue.pop()!;
    for (const space of spaces) {
      if (found.has(space.roomId)) continue;
      const event = roomState(space).getStateEvents('m.space.child', child);
      if (
        event &&
        isActiveSpaceChild(event) &&
        confirmsParent(client, child, space.roomId, senderId)
      ) {
        found.add(space.roomId);
        queue.push(space.roomId);
      }
    }
  }
  return found;
}

/**
 * Whether `userId` is in, and manages (can edit the children of), a space that contains both
 * channels.
 */
export function mayMoveBetween(
  client: MatrixClient,
  userId: string,
  fromRoomId: string,
  toRoomId: string
): boolean {
  if (fromRoomId === toRoomId) return false;
  const above = ancestorSpaces(client, toRoomId, userId);
  for (const spaceId of ancestorSpaces(client, fromRoomId, userId)) {
    if (!above.has(spaceId)) continue;
    const space = client.getRoom(spaceId);
    if (space?.getMember(userId)?.membership !== 'join') continue;
    if (roomStateMaybe(space)?.maySendStateEvent('m.space.child', userId)) return true;
  }
  return false;
}

export async function moveVoiceUser(
  client: MatrixClient,
  fromRoomId: string,
  userId: string,
  toRoomId: string
): Promise<void> {
  const content: VoiceMoveContent = {
    user_id: userId,
    to_room_id: toRoomId,
    move_id: crypto.randomUUID(),
  };
  await client.sendEvent(fromRoomId, VOICE_MOVE_EVENT_TYPE as never, content as never);
  // Clients that have not updated only listen for the old name.
  await client
    .sendEvent(fromRoomId, legacyTypeOf(VOICE_MOVE_EVENT_TYPE) as never, content as never)
    .catch(() => {});
}
