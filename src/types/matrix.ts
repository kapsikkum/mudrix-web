import type { MatrixEvent, Room, RoomMember, StateEvents } from 'matrix-js-sdk';

export type UntypedStateEventType = keyof StateEvents;
export type RawStateContent = StateEvents[keyof StateEvents];

export type { MatrixEvent, Room, RoomMember };

export interface TimelineEvent {
  event: MatrixEvent;
  isOwn: boolean;
  sender: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface TypingUser {
  userId: string;
  displayName: string;
}

export interface NotificationLevel {
  roomId: string;
  level: 'all' | 'mentions' | 'mute';
}
