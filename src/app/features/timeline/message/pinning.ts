import { EventType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';

import { roomState, roomStateMaybe } from '@/util/matrix';

export function isPinnedEvent(room: Room | null, eventId: string): boolean {
  const pinnedEvent = roomStateMaybe(room)?.getStateEvents('m.room.pinned_events', '');
  const content = (Array.isArray(pinnedEvent) ? pinnedEvent[0] : pinnedEvent)?.getContent();
  const pinnedIds: string[] = Array.isArray(content?.pinned) ? content.pinned : [];
  return pinnedIds.includes(eventId);
}

export async function togglePin(
  client: MatrixClient,
  room: Room,
  event: MatrixEvent,
  currentlyPinned: boolean
): Promise<void> {
  const pinnedStateEvent = roomState(room).getStateEvents('m.room.pinned_events', '');
  const stateContent =
    (Array.isArray(pinnedStateEvent) ? pinnedStateEvent[0] : pinnedStateEvent)?.getContent() ?? {};
  const pinned: string[] = Array.isArray(stateContent.pinned) ? stateContent.pinned : [];
  const eventId = event.getId() ?? '';
  const newPinned = currentlyPinned ? pinned.filter((id) => id !== eventId) : [...pinned, eventId];

  await client.sendStateEvent(
    event.getRoomId() ?? '',
    EventType.RoomPinnedEvents,
    { pinned: newPinned },
    ''
  );
}
