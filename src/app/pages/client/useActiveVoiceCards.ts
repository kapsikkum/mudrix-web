import { useMemo } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { useDms } from '@/app/hooks/useDms';
import { useCallMemberships } from '@/app/features/calls/useCallMemberships';
import { useRoomEntries } from '@/app/features/roomSwitcher/roomEntries';
import { findParentSpaceId, formatUserId } from '@/util/matrix';

export interface ActiveVoicePerson {
  userId: string;
  name: string;
  avatarMxc: string | null;
  known: boolean;
}

export interface ActiveVoiceCard {
  roomId: string;
  roomName: string;
  spaceName: string | null;
  people: ActiveVoicePerson[];
  knownCount: number;
  includesMe: boolean;
}

export interface UseActiveVoiceCardsOptions {
  onlyWithKnown?: boolean;
}

export function useActiveVoiceCards(
  client: MatrixClient | null | undefined,
  options?: UseActiveVoiceCardsOptions
): ActiveVoiceCard[] {
  const safeClient = client ?? null;
  const dms = useDms(safeClient);
  const entries = useRoomEntries();
  const myId = client?.getUserId();

  const knownIds = useMemo(() => new Set(dms.map((dm) => dm.partnerId)), [dms]);
  const voiceRoomIds = useMemo(
    () => entries.filter((e) => e.kind === 'room' && e.isVoice).map((e) => e.roomId),
    [entries]
  );
  const memberships = useCallMemberships(safeClient, voiceRoomIds);

  return useMemo((): ActiveVoiceCard[] => {
    if (!client) return [];
    const list: ActiveVoiceCard[] = [];
    for (const [roomId, members] of memberships) {
      const room = client.getRoom(roomId);
      if (!room) continue;
      const userIds = [...new Set(members.map((m) => m.userId))];
      if (userIds.length === 0) continue;
      const people = userIds
        .map((userId) => {
          const member = room.getMember(userId);
          return {
            userId,
            name: member?.name ?? formatUserId(userId),
            avatarMxc: member?.getMxcAvatarUrl() ?? null,
            known: userId !== myId && knownIds.has(userId),
          };
        })
        .sort((a, b) => Number(b.known) - Number(a.known));
      const knownCount = people.filter((p) => p.known).length;
      if (options?.onlyWithKnown && knownCount === 0) continue;
      const parentId = findParentSpaceId(roomId, client);
      list.push({
        roomId,
        roomName: room.name,
        spaceName: parentId ? (client.getRoom(parentId)?.name ?? null) : null,
        people,
        knownCount,
        includesMe: !!myId && userIds.includes(myId),
      });
    }
    return list.sort((a, b) => b.knownCount - a.knownCount || b.people.length - a.people.length);
  }, [memberships, client, knownIds, myId, options?.onlyWithKnown]);
}
