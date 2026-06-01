import { useMemo } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { formatUserId } from '@/util/matrix';

export interface UserProfileData {
  displayName: string;
  avatarMxc: string | null;
  powerLevel: number;
  homeserver: string;
  userId: string;
  canModify: boolean;
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
    let canModify = false;

    if (roomId) {
      const room = client.getRoom(roomId);
      const member = room?.getMember(userId);
      if (member) {
        displayName = member.name ?? displayName;
        avatarMxc = member.getMxcAvatarUrl() ?? null;
        powerLevel = member.powerLevel;
      }
      const myMember = room?.getMember(client.getUserId() ?? '');
      canModify = (myMember?.powerLevel ?? 0) >= 100;
    }

    if (!avatarMxc) {
      const user = client.getUser(userId);
      if (user) {
        displayName = user.displayName ?? displayName;
        avatarMxc = user.avatarUrl ?? null;
      }
    }

    const homeserver = userId.includes(':') ? userId.split(':')[1] : '';

    return { displayName, avatarMxc, powerLevel, homeserver, userId, canModify };
  }, [client, userId, roomId]);
}
