import { NotificationCountType, ReceiptType } from 'matrix-js-sdk';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { getNotifLevelSync } from '@/app/hooks/useNotifications';
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
  const userIds = event.getContent()?.['m.mentions']?.user_ids;
  if (Array.isArray(userIds) && userIds.includes(myId)) return true;
  return isReplyToUser(event, room, myId);
}

function isThreadReplyEvent(event: MatrixEvent): boolean {
  const rel = event.getRelation();
  return rel?.rel_type === 'm.thread';
}

function isEditEvent(event: MatrixEvent): boolean {
  return event.getRelation()?.rel_type === 'm.replace';
}

export interface RoomUnreadState {
  count: number;
  hasMention: boolean;
}

const EMPTY_UNREAD_STATE: RoomUnreadState = { count: 0, hasMention: false };

interface ReadBoundary {
  index: number;
  ts: number;
}

function getReadBoundary(room: Room, events: MatrixEvent[], myId: string): ReadBoundary {
  const receiptIds = new Set<string>();
  let ts = 0;
  for (const type of [ReceiptType.Read, ReceiptType.ReadPrivate]) {
    for (const ignoreSynthesized of [true, false]) {
      const receipt = room.getReadReceiptForUserId(myId, ignoreSynthesized, type);
      if (!receipt?.eventId) continue;
      receiptIds.add(receipt.eventId);
      const target = room.findEventById(receipt.eventId);
      ts = Math.max(ts, target?.getTs() ?? receipt.data?.ts ?? 0);
    }
  }

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const id = event.getId();
    if ((id && receiptIds.has(id)) || event.getSender() === myId) return { index: i, ts };
  }
  return { index: -1, ts };
}

function isRead(boundary: ReadBoundary, index: number, event: MatrixEvent): boolean {
  if (boundary.index >= 0) return index <= boundary.index;
  return event.getTs() <= boundary.ts;
}

interface UnreadScan {
  count: number;
  mentions: MatrixEvent[];
  boundaryFound: boolean;
}

function scanUnread(
  client: MatrixClient,
  room: Room,
  myId: string,
  mentionLimit: number
): UnreadScan {
  const events = room.getLiveTimeline().getEvents();
  const boundary = getReadBoundary(room, events, myId);

  let count = 0;
  const mentions: MatrixEvent[] = [];
  for (let i = events.length - 1, scanned = 0; i >= 0 && scanned < MAX_SCANNED_EVENTS; i--) {
    const event = events[i];
    if (isRead(boundary, i, event)) break;
    scanned++;
    if (event.getSender() === myId) continue;
    if (isThreadReplyEvent(event) || event.isRedacted()) continue;
    const type = event.getType();
    if (
      type === 'm.room.message' &&
      !isEditEvent(event) &&
      mentions.length < mentionLimit &&
      isMentionEvent(event, client, room, myId)
    ) {
      mentions.push(event);
    }
    if (NOTIFYING_TYPES.has(type) && client.getPushActionsForEvent(event)?.notify) count++;
  }
  return { count, mentions, boundaryFound: boundary.index >= 0 };
}

function computeRoomUnreadState(client: MatrixClient, room: Room, myId: string): RoomUnreadState {
  if (getNotifLevelSync(client, room.roomId) === 'mute') return EMPTY_UNREAD_STATE;
  const scan = scanUnread(client, room, myId, 1);

  const serverCount = room.getRoomUnreadNotificationCount(NotificationCountType.Total) ?? 0;
  const serverHighlight = room.getRoomUnreadNotificationCount(NotificationCountType.Highlight) ?? 0;
  // The local scan is only meaningful when it found a receipt-based boundary within the scanned
  // window (or we have never read the room at all). A receipt that points outside the loaded live
  // timeline would otherwise make every old mention within the scan window look unread forever;
  // fall back to SDK counts then.
  const hasAnyReceipt =
    !!room.getReadReceiptForUserId(myId, false, ReceiptType.Read) ||
    !!room.getReadReceiptForUserId(myId, false, ReceiptType.ReadPrivate);
  const scanReliable = hasAnyReceipt ? scan.boundaryFound : true;

  // In an encrypted room the SDK's counts are its own: it adds one for each decrypted event it
  // cannot yet place after our receipt, which happens for the whole initial timeline when receipts
  // land after decryption (sliding sync on every reload). Those counts never go back down, so a
  // reliable receipt scan wins there too.
  let finalCount = serverCount;
  let mention = serverHighlight > 0;
  if (scanReliable) {
    mention = scan.mentions.length > 0;
    finalCount = scan.count;
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

export function getUnreadMentionEvents(
  client: MatrixClient,
  room: Room,
  limit: number
): MatrixEvent[] {
  const myId = client.getUserId();
  if (!myId || getNotifLevelSync(client, room.roomId) === 'mute') return [];
  return scanUnread(client, room, myId, limit).mentions;
}
