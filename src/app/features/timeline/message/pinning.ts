import { EventType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

export function isPinnedEvent(room: Room | null, eventId: string): boolean {
  const pinnedEvent = room?.currentState.getStateEvents('m.room.pinned_events', '');
  const pinnedIds: string[] =
    (Array.isArray(pinnedEvent) ? pinnedEvent[0] : pinnedEvent)?.getContent()?.pinned ?? [];
  return pinnedIds.includes(eventId);
}

export async function togglePin(
  client: MatrixClient,
  room: Room,
  event: MatrixEvent,
  currentlyPinned: boolean
): Promise<void> {
  const pinnedStateEvent = room.currentState.getStateEvents('m.room.pinned_events', '');
  const stateContent =
    (Array.isArray(pinnedStateEvent) ? pinnedStateEvent[0] : pinnedStateEvent)?.getContent() ?? {};
  const pinned: string[] = stateContent.pinned ?? [];
  const eventId = event.getId() ?? '';
  const newPinned = currentlyPinned ? pinned.filter((id) => id !== eventId) : [...pinned, eventId];

  await client.sendStateEvent(
    event.getRoomId() ?? '',
    EventType.RoomPinnedEvents,
    { pinned: newPinned },
    ''
  );
}
