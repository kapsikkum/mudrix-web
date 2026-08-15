import { EventType, JoinRule } from 'matrix-js-sdk';
import { EventTimeline } from 'matrix-js-sdk/lib/models/event-timeline';
import type { MatrixClient, Room } from 'matrix-js-sdk';

export function getMemberDisplayName(
  userId: string,
  client: MatrixClient,
  roomId?: string
): string {
  if (roomId) {
    const room = client.getRoom(roomId);
    const member = room?.getMember(userId);
    if (member?.name) return member.name;
  }
  const user = client.getUser(userId);
  return user?.displayName || formatUserId(userId);
}

export function isDmRoom(room: Room, client: MatrixClient): boolean {
  const dmData = client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();
  if (dmData && Object.values(dmData).some((ids) => ids.includes(room.roomId))) {
    return true;
  }
  return !!room.getDMInviter();
}

export function isSpace(room: Room): boolean {
  return room.isSpaceRoom();
}

const VOICE_ROOM_TYPES = new Set(['org.matrix.msc3401.call', 'org.matrix.msc3417.call']);
const VOICE_ROOM_STATE_TYPE = 'org.matrix.msc3401.call';

export function isVoiceRoom(room: Room | null | undefined): boolean {
  if (!room) return false;
  const type = room.getType?.();
  if (typeof type === 'string' && VOICE_ROOM_TYPES.has(type)) return true;
  return !!roomState(room).getStateEvents(VOICE_ROOM_STATE_TYPE, '');
}

export function formatUserId(userId: string | null | undefined): string {
  if (!userId) return '';
  return userId.split(':')[0].substring(1);
}

export function getStateEventContent(room: Room | null, type: string): Record<string, unknown> {
  return (
    room
      ?.getLiveTimeline()
      .getState(EventTimeline.FORWARDS)
      ?.getStateEvents(type, '')
      ?.getContent<Record<string, unknown>>() ?? {}
  );
}

export function roomState(room: Room) {
  return room.getLiveTimeline().getState(EventTimeline.FORWARDS)!;
}

export function roomStateMaybe(room: Room | null | undefined) {
  return room?.getLiveTimeline().getState(EventTimeline.FORWARDS);
}

export function joinRuleToAccess(rule: string): 'invite' | 'restricted' | 'public' | 'knock' {
  if (rule === JoinRule.Public) return 'public';
  if (rule === 'restricted' || rule === 'knock_restricted') return 'restricted';
  if (rule === 'knock') return 'knock';
  return 'invite';
}

const MESSAGE_EVENT_TYPES = new Set<string>([
  'm.room.message',
  'm.room.encrypted',
  'm.sticker',
  'm.call.invite',
]);

export function getLastMessageTimestamp(room: Room): number {
  const events = room.getLiveTimeline().getEvents();
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.isRedacted?.()) continue;
    if (MESSAGE_EVENT_TYPES.has(ev.getType())) return ev.getTs();
  }
  return room.getLastActiveTimestamp?.() ?? 0;
}
