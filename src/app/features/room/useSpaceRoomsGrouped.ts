import { useState, useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { roomSortAtom } from '@/app/store/atoms/settings';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomState } from '@/util/matrix';
import type { SpaceRoomEntry } from './useSpaceRooms';

export interface SpaceSection {
  spaceId: string | null;
  spaceName: string;
  spaceAvatarMxc: string | null;
  categoryKey: string;
  isJoined: boolean;
  isInvite: boolean;
  viaServers: string[];
  rooms: SpaceRoomEntry[];
  roomsLoaded: boolean;
}

interface RoomSummary {
  room_id: string;
  name?: string;
  avatar_url?: string;
  topic?: string;
  num_joined_members: number;
  join_rule?: string;
  room_type?: string;
}

function summaryIsSpace(s: RoomSummary): boolean {
  return s.room_type === 'm.space';
}

function sortRoomEntries(entries: SpaceRoomEntry[], roomSort: string): SpaceRoomEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isInvite && !b.isInvite) return -1;
    if (!a.isInvite && b.isInvite) return 1;
    if (a.isJoined && !b.isJoined) return -1;
    if (!a.isJoined && b.isJoined) return 1;
    if (roomSort === 'recentActivity') {
      const aTs = a.room?.getLastActiveTimestamp() ?? 0;
      const bTs = b.room?.getLastActiveTimestamp() ?? 0;
      if (aTs !== bTs) return bTs - aTs;
    }
    return a.name.localeCompare(b.name);
  });
}

export function buildRoomEntryFromSummary(
  childId: string,
  viaServers: string[],
  summaryMap: Map<string, RoomSummary>,
  client: NonNullable<ReturnType<typeof getMatrixClientOrNull>>,
  unknownLabel: string
): SpaceRoomEntry | null {
  const room = client.getRoom(childId);

  if (room) {
    const membership = room.getMyMembership();
    if (membership === 'leave' || membership === 'ban') return null;
    if (roomState(room).getStateEvents('m.room.tombstone', '')) return null;

    const topicEv = roomState(room).getStateEvents('m.room.topic', '');
    const topic = (topicEv?.getContent()?.topic as string | undefined) ?? null;

    if (membership === 'join' || membership === 'invite') {
      return {
        room,
        roomId: childId,
        name: room.name ?? unknownLabel,
        avatarMxc: room.getMxcAvatarUrl?.() ?? null,
        topic,
        memberCount: room.getJoinedMembers().length,
        isJoined: membership === 'join',
        isInvite: membership === 'invite',
        isKnocking: false,
        viaServers,
      };
    }

    if (membership === 'knock') {
      return {
        room,
        roomId: childId,
        name: room.name ?? unknownLabel,
        avatarMxc: room.getMxcAvatarUrl?.() ?? null,
        topic: null,
        memberCount: 0,
        isJoined: false,
        isInvite: false,
        isKnocking: true,
        viaServers,
      };
    }

    const ruleEv = roomState(room).getStateEvents('m.room.join_rules', '');
    const ruleContent = ruleEv?.getContent() as
      | { join_rule?: string; allow?: { room_id: string; type: string }[] }
      | undefined;
    const joinRule = ruleContent?.join_rule;

    if (joinRule === 'public' || joinRule === 'knock') {
      return {
        room,
        roomId: childId,
        name: room.name ?? unknownLabel,
        avatarMxc: room.getMxcAvatarUrl?.() ?? null,
        topic,
        memberCount: 0,
        isJoined: false,
        isInvite: false,
        isKnocking: false,
        joinRule,
        viaServers,
      };
    }

    if (joinRule === 'restricted' || joinRule === 'knock_restricted') {
      const allowed = ruleContent?.allow ?? [];
      const myId = client.getUserId() ?? '';
      const accessible = allowed.some((a) => {
        if (a.type !== 'm.room_membership') return false;
        const allowRoom = client.getRoom(a.room_id);
        return allowRoom?.getMember(myId)?.membership === 'join';
      });
      if (accessible) {
        return {
          room,
          roomId: childId,
          name: room.name ?? unknownLabel,
          avatarMxc: room.getMxcAvatarUrl?.() ?? null,
          topic,
          memberCount: 0,
          isJoined: false,
          isInvite: false,
          isKnocking: false,
          joinRule,
          viaServers,
        };
      }
    }

    return null;
  }

  const summary = summaryMap.get(childId);
  if (!summary) return null;

  const joinRule = summary.join_rule;
  if (joinRule !== 'public' && joinRule !== 'knock' && joinRule !== 'restricted') return null;

  return {
    room: null,
    roomId: childId,
    name: summary.name ?? unknownLabel,
    avatarMxc: summary.avatar_url ?? null,
    topic: summary.topic ?? null,
    memberCount: summary.num_joined_members,
    isJoined: false,
    isInvite: false,
    isKnocking: false,
    joinRule,
    viaServers,
  };
}

async function fetchRootLevel(
  spaceId: string,
  client: NonNullable<ReturnType<typeof getMatrixClientOrNull>>
): Promise<Map<string, RoomSummary>> {
  const map = new Map<string, RoomSummary>();
  let from: string | undefined = undefined;

  for (let page = 0; page < 10; page++) {
    try {
      const result = await client.getRoomHierarchy(spaceId, 100, 1, false, from);
      for (const r of result.rooms) {
        map.set(r.room_id, r as RoomSummary);
      }
      if (!result.next_batch) break;
      from = result.next_batch;
    } catch {
      break;
    }
  }

  return map;
}

export { fetchRootLevel as fetchSpaceHierarchyLevel };

export function useSpaceRoomsGrouped(
  spaceId: string,
  unknownLabel = 'Unknown'
): { sections: SpaceSection[]; loading: boolean } {
  const client = getMatrixClientOrNull();
  const [roomSort] = useAtom(roomSortAtom);

  const rootSummaryRef = useRef<Map<string, RoomSummary>>(new Map());
  const fetchTokenRef = useRef(0);

  const build = useCallback((): SpaceSection[] => {
    if (!client) return [];
    const space = client.getRoom(spaceId);
    if (!space) return [];

    const rootSummary = rootSummaryRef.current;
    const stateChildEvents = roomState(space).getStateEvents('m.space.child');
    const seenRoot = new Set<string>();
    const directRooms: SpaceRoomEntry[] = [];
    const subSpaceSections: SpaceSection[] = [];

    for (const ev of stateChildEvents) {
      const childId = ev.getStateKey();
      if (!childId || seenRoot.has(childId)) continue;
      seenRoot.add(childId);

      const content = ev.getContent() as Record<string, unknown>;
      if (!content || !Array.isArray(content['via'])) continue;
      const viaServers = content['via'] as string[];

      const localRoom = client.getRoom(childId);
      const rootSumm = rootSummary.get(childId);
      const isSpaceChild =
        localRoom?.isSpaceRoom() === true || (rootSumm != null ? summaryIsSpace(rootSumm) : false);

      if (isSpaceChild) {
        const membership = localRoom?.getMyMembership() ?? 'leave';
        const isJoined = membership === 'join';
        const isInvite = membership === 'invite';

        subSpaceSections.push({
          spaceId: childId,
          spaceName: localRoom?.name ?? rootSumm?.name ?? unknownLabel,
          spaceAvatarMxc: localRoom?.getMxcAvatarUrl?.() ?? rootSumm?.avatar_url ?? null,
          categoryKey: `${spaceId}::${childId}`,
          isJoined,
          isInvite,
          viaServers,
          rooms: [],
          roomsLoaded: false,
        });
      } else {
        const entry = buildRoomEntryFromSummary(
          childId,
          viaServers,
          rootSummary,
          client,
          unknownLabel
        );
        if (entry) directRooms.push(entry);
      }
    }

    for (const [summId, summ] of rootSummary) {
      if (seenRoot.has(summId) || summId === spaceId) continue;
      if (summaryIsSpace(summ)) {
        const localRoom = client.getRoom(summId);
        const membership = localRoom?.getMyMembership() ?? 'leave';
        subSpaceSections.push({
          spaceId: summId,
          spaceName: localRoom?.name ?? summ.name ?? unknownLabel,
          spaceAvatarMxc: localRoom?.getMxcAvatarUrl?.() ?? summ.avatar_url ?? null,
          categoryKey: `${spaceId}::${summId}`,
          isJoined: membership === 'join',
          isInvite: membership === 'invite',
          viaServers: [],
          rooms: [],
          roomsLoaded: false,
        });
        continue;
      }
      const localR = client.getRoom(summId);
      if (localR && (localR.getMyMembership() === 'leave' || localR.getMyMembership() === 'ban'))
        continue;
      const entry = buildRoomEntryFromSummary(summId, [], rootSummary, client, unknownLabel);
      if (entry) directRooms.push(entry);
    }

    return [
      {
        spaceId: null,
        spaceName: space.name ?? spaceId,
        spaceAvatarMxc: space.getMxcAvatarUrl?.() ?? null,
        categoryKey: `${spaceId}::root`,
        isJoined: true,
        isInvite: false,
        viaServers: [],
        rooms: sortRoomEntries(directRooms, roomSort),
        roomsLoaded: true,
      },
      ...subSpaceSections,
    ];
  }, [client, spaceId, unknownLabel, roomSort]);

  const [sections, setSections] = useState<SpaceSection[]>(build);
  const [loading, setLoading] = useState(true);

  const buildRef = useRef(build);
  buildRef.current = build;
  const refresh = useCallback(() => setSections(buildRef.current()), []);

  const fetchRoot = useCallback(async () => {
    if (!client) return;
    const token = fetchTokenRef.current;

    try {
      const rootMap = await fetchRootLevel(spaceId, client);
      if (fetchTokenRef.current !== token) return;
      rootSummaryRef.current = rootMap;
      setSections(buildRef.current());
    } catch {
      // ignore — local state still renders
    } finally {
      if (fetchTokenRef.current === token) setLoading(false);
    }
  }, [client, spaceId]);

  useEffect(() => {
    fetchTokenRef.current += 1;
    rootSummaryRef.current = new Map();
    setLoading(true);
    setSections(buildRef.current());
    fetchRoot();
  }, [spaceId, fetchRoot]);

  const membershipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefetch = useCallback(() => {
    if (membershipTimerRef.current) clearTimeout(membershipTimerRef.current);
    membershipTimerRef.current = setTimeout(() => {
      membershipTimerRef.current = null;
      fetchRoot();
    }, 500);
  }, [fetchRoot]);

  useEffect(
    () => () => {
      if (membershipTimerRef.current) clearTimeout(membershipTimerRef.current);
    },
    []
  );

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'RoomState.events', refresh);
  useMatrixEvent(client, 'Room.myMembership', debouncedRefetch);
  useMatrixEvent(client, 'sync', refresh);

  useEffect(() => {
    setSections(buildRef.current());
  }, [roomSort]);

  return { sections, loading };
}
