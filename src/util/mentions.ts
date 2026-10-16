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

function hasUnreadReplyToMe(room: Room, myId: string): boolean {
  const timelines: Array<{ events: MatrixEvent[]; readUpTo: string | null }> = [
    { events: room.getLiveTimeline().getEvents(), readUpTo: room.getEventReadUpTo(myId) },
  ];
  for (const thread of room.getThreads()) {
    timelines.push({
      events: thread.getUnfilteredTimelineSet().getLiveTimeline().getEvents(),
      readUpTo: thread.getEventReadUpTo(myId, false),
    });
  }

  const [mainTimeline, ...threadTimelines] = timelines;
  const threadBudget = Math.max(
    1,
    Math.floor(MAX_SCANNED_EVENTS / Math.max(1, threadTimelines.length))
  );

  const hasReplyWithin = (
    timeline: { events: MatrixEvent[]; readUpTo: string | null },
    budget: number
  ): boolean => {
    const { events, readUpTo } = timeline;
    for (let i = events.length - 1, scanned = 0; i >= 0 && scanned < budget; i--) {
      const event = events[i];
      if (readUpTo && event.getId() === readUpTo) break;
      scanned++;
      if (event.getSender() === myId) continue;
      if (isReplyToUser(event, room, myId)) return true;
    }
    return false;
  };

  if (hasReplyWithin(mainTimeline, Math.ceil(MAX_SCANNED_EVENTS / 2))) return true;
  return threadTimelines.some((timeline) => hasReplyWithin(timeline, threadBudget));
}

export function roomHasUnreadMention(client: MatrixClient, room: Room): boolean {
  if (getNotifLevelSync(client, room.roomId) === 'mute') return false;
  if ((room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0) > 0) return true;
  const myId = client.getUserId();
  if (!myId) return false;
  return hasUnreadReplyToMe(room, myId);
}
