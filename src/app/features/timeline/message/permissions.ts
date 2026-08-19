import { EventType, EventTimeline } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';

export interface MessagePermissions {
  canEdit: boolean;
  canRedact: boolean;
  canPin: boolean;
}

export function computeMessagePermissions(
  room: Room | null,
  myId: string,
  event: MatrixEvent
): MessagePermissions {
  const state = room?.getLiveTimeline().getState(EventTimeline.FORWARDS);
  if (!state) {
    return { canEdit: false, canRedact: false, canPin: false };
  }
  const isOwn = event.getSender() === myId;
  return {
    canEdit: isOwn && state.maySendMessage(myId),
    canRedact: state.maySendRedactionForEvent(event, myId),
    canPin: state.maySendStateEvent(EventType.RoomPinnedEvents, myId),
  };
}
