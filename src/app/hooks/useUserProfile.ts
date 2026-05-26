import { useMemo } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { formatUserId } from '@/util/matrix';

export interface UserProfileData {
  displayName: string;
  avatarMxc: string | null;
  powerLevel: number;
  homeserver: string;
  userId: string;
}

export function useUserProfile(
  client: MatrixClient | null,
  userId: string | null,
  roomId?: string | null
): UserProfileData | null {
  return useMemo(() => {
    if (!client || !userId) return null;

    let displayName = formatUserId(userId);
    let avatarMxc: string | null = null;
    let powerLevel = 0;

    if (roomId) {
      const room = client.getRoom(roomId);
      const member = room?.getMember(userId);
      if (member) {
        displayName = member.name ?? displayName;
        avatarMxc = member.getMxcAvatarUrl() ?? null;
        powerLevel = member.powerLevel;
      }
    }

    if (!avatarMxc) {
      const user = client.getUser(userId);
      if (user) {
        displayName = user.displayName ?? displayName;
        avatarMxc = user.avatarUrl ?? null;
      }
    }

    const homeserver = userId.includes(':') ? userId.split(':')[1] : '';

    return { displayName, avatarMxc, powerLevel, homeserver, userId };
  }, [client, userId, roomId]);
}
