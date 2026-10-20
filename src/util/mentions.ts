import { NotificationCountType, ReceiptType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { getNotifLevelSync } from '@/app/hooks/useNotifications';
import { roomState } from '@/util/matrix';
import { isRoomMarkedUnread } from '@/util/markedUnread';

const MAX_SCANNED_EVENTS = 200;

const NOTIFYING_TYPES = new Set([
  'm.room.message',
  'm.sticker',
  'm.room.encrypted',
  'm.poll.start',
  'org.matrix.msc3381.poll.start',
]);

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

export interface RoomUnreadState {
  count: number;
  hasMention: boolean;
}

const EMPTY_UNREAD_STATE: RoomUnreadState = { count: 0, hasMention: false };

function isRoomEncrypted(room: Room): boolean {
  return roomState(room).getStateEvents('m.room.encryption').length > 0;
}

function computeRoomUnreadState(client: MatrixClient, room: Room, myId: string): RoomUnreadState {
  if (getNotifLevelSync(client, room.roomId) === 'mute') return EMPTY_UNREAD_STATE;
  const events = room.getLiveTimeline().getEvents();
  const readUpTo = room.getEventReadUpTo(myId);

  let count = 0;
  let hasMention = false;
  let reachedReadMarker = false;
  for (let i = events.length - 1, scanned = 0; i >= 0 && scanned < MAX_SCANNED_EVENTS; i--) {
    const event = events[i];
    if (readUpTo && event.getId() === readUpTo) {
      reachedReadMarker = true;
      break;
    }
    scanned++;
    if (event.getSender() === myId) continue;
    if (isThreadReplyEvent(event)) continue;
    const type = event.getType();
    if (type === 'm.room.message' && isMentionEvent(event, client, room, myId)) hasMention = true;
    if (NOTIFYING_TYPES.has(type) && client.getPushActionsForEvent(event)?.notify) count++;
  }

  const serverCount = room.getRoomUnreadNotificationCount(NotificationCountType.Total) ?? 0;
  const serverHighlight = room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) ?? 0;
  // The local scan is only meaningful when it ran up to our read marker (or we have never read
  // the room at all). A receipt that points outside the loaded live timeline would otherwise make
  // every old mention within the scan window look unread forever; fall back to SDK counts then.
  const hasAnyReceipt =
    !!room.getReadReceiptForUserId(myId, false, ReceiptType.Read) ||
    !!room.getReadReceiptForUserId(myId, false, ReceiptType.ReadPrivate);
  const scanReliable = readUpTo ? reachedReadMarker : !hasAnyReceipt;

  let finalCount = serverCount;
  let mention = serverHighlight > 0;
  if (scanReliable) {
    mention = hasMention;
    if (!isRoomEncrypted(room)) finalCount = count;
  }
  // A manual "mark as unread" shows as one unread item until the room is opened/read.
  if (finalCount === 0 && !mention && isRoomMarkedUnread(room)) finalCount = 1;
  return { count: finalCount, hasMention: mention };
}

export function getRoomUnreadState(client: MatrixClient, room: Room): RoomUnreadState {
  const myId = client.getUserId();
  if (!myId) return EMPTY_UNREAD_STATE;
  return computeRoomUnreadState(client, room, myId);
}

export function getRoomUnreadCount(client: MatrixClient, room: Room): number {
  return getRoomUnreadState(client, room).count;
}

export function roomHasUnreadMention(client: MatrixClient, room: Room): boolean {
  return getRoomUnreadState(client, room).hasMention;
}
