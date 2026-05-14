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

export function mxcToHttp(mxcUrl: string | null | undefined, client: MatrixClient): string | null {
  if (!mxcUrl) return null;
  return client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false);
}

export function formatUserId(userId: string | null | undefined): string {
  if (!userId) return '';
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
