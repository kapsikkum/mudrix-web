import type { MatrixEvent, Room, RoomMember, StateEvents } from 'matrix-js-sdk';

export type UntypedStateEventType = keyof StateEvents;
export type RawStateContent = StateEvents[keyof StateEvents];

export type { MatrixEvent, Room, RoomMember };
