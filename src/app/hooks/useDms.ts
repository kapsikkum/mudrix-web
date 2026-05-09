import { useState, useCallback } from 'react';
import { EventType, NotificationCountType } from 'matrix-js-sdk';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

export interface DmEntry {
  room: Room;
  roomId: string;
  partnerId: string;
  partnerName: string;
  partnerAvatarMxc: string | null;
  unreadCount: number;
  hasNotif: boolean;
}

function buildDmEntries(client: MatrixClient): DmEntry[] {
  const dmData = client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();

  if (!dmData) return [];

  const entries: DmEntry[] = [];
  const seen = new Set<string>();

  for (const [userId, roomIds] of Object.entries(dmData)) {
    for (const roomId of roomIds) {
      if (seen.has(roomId)) continue;
      const room = client.getRoom(roomId);
      if (!room) continue;
      const membership = room.getMyMembership();
      if (!['join', 'invite'].includes(membership)) continue;
      seen.add(roomId);

      const member = room.getMember(userId);
      const partnerName = member?.name ?? userId.split(':')[0].substring(1);
      const partnerAvatarMxc = member?.getMxcAvatarUrl() ?? null;

      entries.push({
        room,
        roomId,
        partnerId: userId,
        partnerName,
        partnerAvatarMxc,
        unreadCount: room.getUnreadNotificationCount() ?? 0,
        hasNotif: (room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0) > 0,
      });
    }
  }

  // Also include rooms where the local user got a DM invite
  for (const room of client.getRooms()) {
    if (seen.has(room.roomId)) continue;
    const inviter = room.getDMInviter?.();
    if (!inviter) continue;
    seen.add(room.roomId);
    const member = room.getMember(inviter);
    const partnerName = member?.name ?? inviter.split(':')[0].substring(1);
    entries.push({
      room,
      roomId: room.roomId,
      partnerId: inviter,
      partnerName,
      partnerAvatarMxc: member?.getMxcAvatarUrl() ?? null,
      unreadCount: room.getUnreadNotificationCount() ?? 0,
      hasNotif: false,
    });
  }

  return entries.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
}

export function useDms(client: MatrixClient | null) {
  const [dms, setDms] = useState<DmEntry[]>(() => (client ? buildDmEntries(client) : []));

  const refresh = useCallback(() => {
    if (client) setDms(buildDmEntries(client));
  }, [client]);

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'accountData', refresh);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'Room.receipt', refresh);
  useMatrixEvent(client, 'Room.UnreadNotifications', refresh);
  useMatrixEvent(client, 'sync', refresh);

  return dms;
}

export async function startDm(client: MatrixClient, userId: string): Promise<string> {
  // Check for existing DM room
  const dmData = client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();

  if (dmData?.[userId]) {
    for (const roomId of dmData[userId]) {
      const room = client.getRoom(roomId);
      if (room && room.getMyMembership() === 'join') return roomId;
    }
  }

  const result = await client.createRoom({
    is_direct: true,
    invite: [userId],
    preset: 'trusted_private_chat' as Parameters<typeof client.createRoom>[0]['preset'],
    visibility: 'private' as Parameters<typeof client.createRoom>[0]['visibility'],
    initial_state: [
      {
        type: 'm.room.encryption',
        state_key: '',
        content: { algorithm: 'm.megolm.v1.aes-sha2' },
      },
    ],
  });

  const roomId = result.room_id;

  // Update m.direct account data
  const existing = dmData ?? {};
  const existingRooms = existing[userId] ?? [];
  await client.setAccountData(EventType.Direct, {
    ...existing,
    [userId]: [...existingRooms, roomId],
  });

  return roomId;
}
