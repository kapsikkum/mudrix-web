import { EventType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { viaServersFor } from '@/util/matrix';

export async function registerDmIfNeeded(client: MatrixClient, roomId: string): Promise<void> {
  const room = client.getRoom(roomId);
  if (!room) return;
  const inviter = room.getDMInviter?.();
  if (!inviter) return;
  const dmData =
    client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>() ?? {};
  const existing = dmData[inviter] ?? [];
  if (existing.includes(roomId)) return;
  await client.setAccountData(EventType.Direct, {
    ...dmData,
    [inviter]: [...existing, roomId],
  });
}

export async function acceptInvite(client: MatrixClient, roomId: string): Promise<void> {
  const viaServers = viaServersFor(roomId, client.getDomain()).viaServers;
  await client.joinRoom(roomId, viaServers.length > 0 ? { viaServers } : undefined);
  registerDmIfNeeded(client, roomId).catch(() => {});
}

export async function declineInvite(client: MatrixClient, roomId: string): Promise<void> {
  await client.leave(roomId);
}

/**
 * Declines the invite and adds the inviter to the account's ignore list, so the homeserver
 * stops delivering their invites and events (m.ignored_user_list).
 */
export async function declineAndBlockInvite(
  client: MatrixClient,
  roomId: string,
  inviterUserId: string
): Promise<void> {
  await client.leave(roomId);
  const ignored = client.getIgnoredUsers();
  if (!ignored.includes(inviterUserId)) {
    await client.setIgnoredUsers([...ignored, inviterUserId]);
  }
}
