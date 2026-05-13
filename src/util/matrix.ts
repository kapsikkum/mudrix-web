import { EventType, JoinRule } from 'matrix-js-sdk';
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
  return user?.displayName || userId.split(':')[0].substring(1);
}

export function isDmRoom(room: Room, client: MatrixClient): boolean {
  const dmInviter = room.getDMInviter();
  if (dmInviter) return true;

  const dmRooms = client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();
  if (!dmRooms) return false;

  return Object.values(dmRooms).some((ids) => ids.includes(room.roomId));
}

export function isSpace(room: Room): boolean {
  return room.isSpaceRoom();
}

export function mxcToHttp(mxcUrl: string | null | undefined, client: MatrixClient): string | null {
  if (!mxcUrl) return null;
  return client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false);
}

export function formatUserId(userId: string): string {
  return userId.split(':')[0].substring(1);
}

export function getStateEventContent(room: Room | null, type: string): Record<string, unknown> {
  return room?.currentState?.getStateEvents(type, '')?.getContent<Record<string, unknown>>() ?? {};
}

export function joinRuleToAccess(rule: string): 'invite' | 'restricted' | 'public' {
  if (rule === JoinRule.Public) return 'public';
  if (rule === 'restricted' || rule === 'knock_restricted') return 'restricted';
  return 'invite';
}
