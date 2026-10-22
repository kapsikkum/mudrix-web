import { useEffect, useMemo, useState } from 'react';
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

interface FetchedProfile {
  displayName?: string;
  avatarUrl?: string;
}

// Profiles fetched from the homeserver, for users the sync did not describe (sliding sync does
// not populate User objects the way classic sync's presence and own-profile handling does).
const fetchedProfiles = new Map<string, FetchedProfile | null>();

export function useUserProfile(
  client: MatrixClient | null,
  userId: string | null,
  roomId?: string | null
): UserProfileData | null {
  const [revision, setRevision] = useState(0);

  // Member and user profile changes (avatar, display name) re-derive the profile live.
  useEffect(() => {
    if (!client || !userId) return;
    const bump = (...args: unknown[]) => {
      const subject = args.find(
        (a): a is { userId?: string; getStateKey?: () => string | undefined } =>
          !!a && typeof a === 'object'
      );
      const affected = subject?.userId ?? subject?.getStateKey?.();
      if (affected === undefined || affected === userId) setRevision((n) => n + 1);
    };
    const on = client.on.bind(client) as (e: string, cb: (...a: never[]) => void) => void;
    const off = client.off.bind(client) as (e: string, cb: (...a: never[]) => void) => void;
    const events = ['User.avatarUrl', 'User.displayName', 'RoomMember.name', 'RoomState.events'];
    events.forEach((e) => on(e, bump as never));
    return () => events.forEach((e) => off(e, bump as never));
  }, [client, userId]);

  useEffect(() => {
    if (!client || !userId || fetchedProfiles.has(userId)) return;
    const user = client.getUser(userId);
    if (user?.displayName && user.avatarUrl) return;
    fetchedProfiles.set(userId, null);
    client
      .getProfileInfo(userId)
      .then((info) => {
        fetchedProfiles.set(userId, { displayName: info.displayname, avatarUrl: info.avatar_url });
        setRevision((n) => n + 1);
      })
      .catch(() => fetchedProfiles.delete(userId));
  }, [client, userId]);

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
      const fetched = fetchedProfiles.get(userId);
      if (fetched) {
        if (!user?.displayName && fetched.displayName) displayName = fetched.displayName;
        avatarMxc = avatarMxc ?? fetched.avatarUrl ?? null;
      }
    }

    const homeserver = userId.includes(':') ? userId.split(':')[1] : '';

    return { displayName, avatarMxc, powerLevel, homeserver, userId, canModify };
  }, [client, userId, roomId, revision]);
}
