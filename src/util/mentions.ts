import { NotificationCountType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { getNotifLevelSync } from '@/app/hooks/useNotifications';

const MAX_SCANNED_EVENTS = 200;

export function getReplyEventId(event: MatrixEvent): string | null {
  const relatesTo = event.getContent()?.['m.relates_to'];
  if (!relatesTo?.['m.in_reply_to']?.event_id) return null;
  if (relatesTo?.is_falling_back) return null;
  return relatesTo['m.in_reply_to'].event_id as string;
}

export function isReplyToUser(
  event: MatrixEvent,
  room: Room | null | undefined,
  myId: string
): boolean {
  if (!myId) return false;
  const replyEventId = getReplyEventId(event);
  if (!replyEventId) return false;
  return room?.findEventById(replyEventId)?.getSender() === myId;
}

export function isMentionEvent(
  event: MatrixEvent,
  client: MatrixClient,
  room: Room | null | undefined,
  myId: string
): boolean {
  if (client.getPushActionsForEvent(event)?.tweaks?.highlight === true) return true;
  return isReplyToUser(event, room, myId);
}

function isThreadReplyEvent(event: MatrixEvent): boolean {
  const rel = event.getRelation();
  return rel?.rel_type === 'm.thread';
}

function hasUnreadReplyToMe(room: Room, myId: string): boolean {
  const events = room.getLiveTimeline().getEvents();
  const readUpTo = room.getEventReadUpTo(myId);

  for (let i = events.length - 1, scanned = 0; i >= 0 && scanned < MAX_SCANNED_EVENTS; i--) {
    const event = events[i];
    if (readUpTo && event.getId() === readUpTo) break;
    scanned++;
    if (event.getSender() === myId) continue;
    if (isThreadReplyEvent(event)) continue;
    if (isReplyToUser(event, room, myId)) return true;
  }
  return false;
}

export function roomHasUnreadMention(client: MatrixClient, room: Room): boolean {
  if (getNotifLevelSync(client, room.roomId) === 'mute') return false;
  if ((room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) ?? 0) > 0) return true;
  const myId = client.getUserId();
  if (!myId) return false;
  return hasUnreadReplyToMe(room, myId);
}
