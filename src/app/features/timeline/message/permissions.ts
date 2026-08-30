import { EventType, EventTimeline } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';

export interface MessagePermissions {
  canEdit: boolean;
  canRedact: boolean;
  canPin: boolean;
}

export interface RoomPermissions {
  canPin: boolean;
  canSendMessage: boolean;
}

export function computeRoomPermissions(room: Room | null, myId: string): RoomPermissions {
  const state = room?.getLiveTimeline().getState(EventTimeline.FORWARDS) ?? null;
  if (!state) {
    return { canPin: false, canSendMessage: false };
  }
  return {
    canPin: state.maySendStateEvent(EventType.RoomPinnedEvents, myId),
    canSendMessage: state.maySendMessage(myId),
  };
}

function getCanRedact(room: Room | null, myId: string, event: MatrixEvent): boolean {
  const state = room?.getLiveTimeline().getState(EventTimeline.FORWARDS) ?? null;
  if (!state) return false;
  return state.maySendRedactionForEvent(event, myId);
}

export function computeMessagePermissions(
  room: Room | null,
  myId: string,
  event: MatrixEvent,
  roomPerms?: RoomPermissions
): MessagePermissions {
  const perms = roomPerms ?? computeRoomPermissions(room, myId);
  if (!perms.canPin && !perms.canSendMessage) {
    return {
      canEdit: false,
      canRedact: getCanRedact(room, myId, event),
      canPin: false,
    };
  }
  const isOwn = event.getSender() === myId;
  return {
    canEdit: isOwn && perms.canSendMessage,
    canRedact: getCanRedact(room, myId, event),
    canPin: perms.canPin,
  };
}
