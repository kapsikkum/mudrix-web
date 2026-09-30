import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomState } from '@/util/matrix';
import { EventType, type Room } from 'matrix-js-sdk';

export interface SpaceRoomEntry {
  room: Room | null;
  roomId: string;
  name: string;
  avatarMxc: string | null;
  topic: string | null;
  memberCount: number;
  isJoined: boolean;
  isInvite: boolean;
  isKnocking: boolean;
  joinRule?: string;
  viaServers: string[];
  isSuggested?: boolean;
}

export interface SpaceSection {
  spaceId: string | null;
  spaceName: string;
  spaceAvatarMxc: string | null;
  categoryKey: string;
  isJoined: boolean;
  isInvite: boolean;
  isSuggested?: boolean;
  viaServers: string[];
  memberCount?: number;
  rooms: SpaceRoomEntry[];
  roomsLoaded: boolean;
}

export interface RoomSummary {
  room_id: string;
  name?: string;
  avatar_url?: string;
  topic?: string;
  num_joined_members: number;
  join_rule?: string;
  room_type?: string;
  suggested?: boolean;
  via?: string[];
  children_state?: { state_key?: string; content?: { suggested?: boolean; via?: string[] } }[];
}

function summaryIsSpace(s: RoomSummary | undefined): boolean {
  return s?.room_type === 'm.space';
}

function sortRoomEntries(entries: SpaceRoomEntry[]): SpaceRoomEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isInvite && !b.isInvite) return -1;
    if (!a.isInvite && b.isInvite) return 1;
    if (a.isJoined && !b.isJoined) return -1;
    if (!a.isJoined && b.isJoined) return 1;
    return a.name.localeCompare(b.name);
  });
}

function buildRoomEntryFromSummary(
  childId: string,
  viaServers: string[],
  summaryMap: Map<string, RoomSummary>,
  client: NonNullable<ReturnType<typeof getMatrixClientOrNull>>,
  unknownLabel: string,
  isSuggested?: boolean
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
        isSuggested,
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
        isSuggested,
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
        isSuggested,
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
          isSuggested,
        };
      }
    }

    return null;
  }

  const summary = summaryMap.get(childId);
  if (!summary) return null;

  const joinRule = summary.join_rule;
  if (
    joinRule !== 'public' &&
    joinRule !== 'knock' &&
    joinRule !== 'restricted' &&
    joinRule !== 'knock_restricted'
  ) {
    return null;
  }

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
    isSuggested: isSuggested ?? summary.suggested,
  };
}

// Bounded page size and auto-advance cap, mirroring Cinny's hierarchy level
// fetch. Keeps a large space from turning into an unbounded paginated walk.
const HIERARCHY_PAGE_LIMIT = 100;
const HIERARCHY_MAX_AUTO_PAGES = 50;

export function splitHierarchyLevel(
  parentId: string,
  summaryMap: Map<string, RoomSummary>,
  client: NonNullable<ReturnType<typeof getMatrixClientOrNull>>,
  unknownLabel: string
): { rooms: SpaceRoomEntry[]; subSpaces: SpaceSection[] } {
  const rooms: SpaceRoomEntry[] = [];
  const subSpaces: SpaceSection[] = [];

  const orderedIds: string[] = (() => {
    const rels = summaryMap.get(parentId)?.children_state ?? [];
    const keys = rels.map((r) => r.state_key).filter((k): k is string => !!k);
    if (keys.length > 0) return keys;
    return [...summaryMap.keys()].filter((id) => id !== parentId);
  })();

  for (const childId of orderedIds) {
    if (childId === parentId) continue;
    const summ = summaryMap.get(childId);
    const localRoom = client.getRoom(childId);
    const isSubSpace =
      localRoom?.isSpaceRoom() === true || (summ != null ? summaryIsSpace(summ) : false);

    if (isSubSpace) {
      const membership = localRoom?.getMyMembership() ?? 'leave';
      const rel = summaryMap.get(parentId)?.children_state?.find((r) => r.state_key === childId);
      subSpaces.push({
        spaceId: childId,
        spaceName: localRoom?.name ?? summ?.name ?? unknownLabel,
        spaceAvatarMxc: localRoom?.getMxcAvatarUrl?.() ?? summ?.avatar_url ?? null,
        categoryKey: `${parentId}::${childId}`,
        isJoined: membership === 'join',
        isInvite: membership === 'invite',
        isSuggested: rel?.content?.suggested === true || summ?.suggested,
        viaServers: rel?.content?.via ?? summ?.via ?? [],
        memberCount: summ?.num_joined_members ?? localRoom?.getJoinedMemberCount?.() ?? 0,
        rooms: [],
        roomsLoaded: false,
      });
      continue;
    }

    if (!summ) continue;
    const entry = buildRoomEntryFromSummary(
      childId,
      summ.via ?? [],
      summaryMap,
      client,
      unknownLabel,
      summ.suggested
    );
    if (entry) rooms.push(entry);
  }

  return { rooms: sortRoomEntries(rooms), subSpaces };
}

async function fetchRootLevel(
  spaceId: string,
  client: NonNullable<ReturnType<typeof getMatrixClientOrNull>>,
  maxDepth = 1,
  pageCap = HIERARCHY_MAX_AUTO_PAGES
): Promise<Map<string, RoomSummary>> {
  const map = new Map<string, RoomSummary>();
  let from: string | undefined = undefined;
  let lastError: unknown;
  let page = 0;

  for (; page < pageCap; page++) {
    try {
      const result = await client.getRoomHierarchy(
        spaceId,
        HIERARCHY_PAGE_LIMIT,
        maxDepth,
        false,
        from
      );
      for (const r of result.rooms) {
        map.set(r.room_id, r as RoomSummary);
      }
      // Propagate suggested flag and via servers from each space node's
      // children_state to child entries
      for (const r of result.rooms) {
        const children = (
          r as {
            children_state?: {
              state_key?: string;
              content?: { suggested?: boolean; via?: string[] };
            }[];
          }
        ).children_state;
        if (!children) continue;
        for (const rel of children) {
          if (!rel.state_key) continue;
          const child = map.get(rel.state_key);
          if (!child) continue;
          if (rel.content?.suggested) {
            map.set(rel.state_key, { ...child, suggested: true });
          }
          if (rel.content?.via?.length) {
            const cur = map.get(rel.state_key)!;
            map.set(rel.state_key, { ...cur, via: rel.content.via });
          }
        }
      }
      if (!result.next_batch) break;
      from = result.next_batch;
    } catch (err) {
      lastError = err;
      break;
    }
  }

  if (lastError) {
    if (map.size === 0) throw lastError;
    console.warn('[space-hierarchy] response truncated', from, lastError);
  } else if (page >= pageCap) {
    console.warn('[space-hierarchy] hit page cap', pageCap, map.size, 'rooms');
  }

  return map;
}

export { fetchRootLevel as fetchSpaceHierarchyLevel };

export function useSpaceRoomsGrouped(spaceId: string, unknownLabel = 'Unknown') {
  const client = getMatrixClientOrNull();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['space-hierarchy', spaceId],
    queryFn: () => {
      if (!client) throw new Error('no client');
      // Depth 1 only. Sub-space children are fetched on expand via
      // fetchSpaceHierarchyLevel, matching Cinny's per-level model.
      return fetchRootLevel(spaceId, client, 1);
    },
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    enabled: !!client && !!spaceId,
  });

  const rootSummaryRef = useRef<Map<string, RoomSummary>>(new Map());
  rootSummaryRef.current = query.data ?? new Map();

  const build = useCallback((): SpaceSection[] => {
    if (!client) return [];
    const space = client.getRoom(spaceId);
    const rootSummary = rootSummaryRef.current;
    const spaceSummary = rootSummary.get(spaceId);
    if (!space && !spaceSummary) return [];

    const stateChildEvents = space ? roomState(space).getStateEvents('m.space.child') : [];
    const seenRoot = new Set<string>();
    const addedRoomIds = new Set<string>();
    const directRoomEntries: SpaceRoomEntry[] = [];
    const subSpaceSections: SpaceSection[] = [];

    // Collect every room that sits under ANY nested sub-space in the server
    const subSpaceRoomIds = new Set<string>();
    const claimUnder = (nodeId: string) => {
      const summ = rootSummary.get(nodeId);
      for (const rel of summ?.children_state ?? []) {
        if (!rel.state_key) continue;
        const childSumm = rootSummary.get(rel.state_key);
        if (childSumm && summaryIsSpace(childSumm)) {
          claimUnder(rel.state_key);
        } else {
          subSpaceRoomIds.add(rel.state_key);
        }
      }
    };
    for (const rel of rootSummary.get(spaceId)?.children_state ?? []) {
      if (!rel.state_key) continue;
      const childSumm = rootSummary.get(rel.state_key);
      if (childSumm && summaryIsSpace(childSumm)) claimUnder(rel.state_key);
    }

    for (const ev of stateChildEvents) {
      const childId = ev.getStateKey();
      if (!childId || seenRoot.has(childId)) continue;
      seenRoot.add(childId);

      const content = ev.getContent() as Record<string, unknown>;
      if (!content || !Array.isArray(content['via'])) continue;
      const viaServers = content['via'] as string[];
      const isSuggested = content['suggested'] === true;

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
          isSuggested: isSuggested || rootSumm?.suggested,
          viaServers,
          memberCount: rootSumm?.num_joined_members ?? localRoom?.getJoinedMemberCount?.() ?? 0,
          rooms: [],
          roomsLoaded: false,
        });
      } else {
        // Skip rooms that belong to a sub-space — they must not appear in the root section
        if (subSpaceRoomIds.has(childId)) continue;
        addedRoomIds.add(childId);
        const entry = buildRoomEntryFromSummary(
          childId,
          viaServers,
          rootSummary,
          client,
          unknownLabel,
          isSuggested || rootSumm?.suggested
        );
        if (entry) directRoomEntries.push(entry);
      }
    }

    const rootChildren = new Set<string>();
    for (const rel of rootSummary.get(spaceId)?.children_state ?? []) {
      if (rel.state_key) rootChildren.add(rel.state_key);
    }
    const isDirectChild = (id: string): boolean =>
      rootChildren.size === 0 ? true : rootChildren.has(id);

    // Discover sub-spaces found only in the server hierarchy fetch
    for (const [summId, summ] of rootSummary) {
      if (seenRoot.has(summId) || summId === spaceId) continue;
      if (!summaryIsSpace(summ)) continue;
      const localRoom = client.getRoom(summId);
      const membership = localRoom?.getMyMembership() ?? 'leave';
      subSpaceSections.push({
        spaceId: summId,
        spaceName: localRoom?.name ?? summ.name ?? unknownLabel,
        spaceAvatarMxc: localRoom?.getMxcAvatarUrl?.() ?? summ.avatar_url ?? null,
        categoryKey: `${spaceId}::${summId}`,
        isJoined: membership === 'join',
        isInvite: membership === 'invite',
        isSuggested: summ.suggested,
        viaServers: summ.via ?? [],
        memberCount: summ.num_joined_members ?? 0,
        rooms: [],
        roomsLoaded: false,
      });
    }

    for (const [summId, summ] of rootSummary) {
      if (summId === spaceId) continue;
      if (!isDirectChild(summId)) continue;
      if (summaryIsSpace(summ)) continue;
      if (subSpaceRoomIds.has(summId)) continue;
      if (addedRoomIds.has(summId)) continue;
      if (client.getRoom(summId)) continue;
      const entry = buildRoomEntryFromSummary(
        summId,
        summ.via ?? [],
        rootSummary,
        client,
        unknownLabel,
        summ.suggested
      );
      if (entry) directRoomEntries.push(entry);
    }

    return [
      {
        spaceId: null,
        spaceName: space?.name ?? spaceSummary?.name ?? spaceId,
        spaceAvatarMxc: space?.getMxcAvatarUrl?.() ?? spaceSummary?.avatar_url ?? null,
        categoryKey: `${spaceId}::root`,
        isJoined: space !== null,
        isInvite: false,
        viaServers: [],
        memberCount:
          rootSummary.get(spaceId)?.num_joined_members ?? space?.getJoinedMemberCount?.() ?? 0,
        rooms: sortRoomEntries(directRoomEntries),
        roomsLoaded: true,
      },
      ...subSpaceSections,
    ];
  }, [client, spaceId, unknownLabel]);

  const [sections, setSections] = useState<SpaceSection[]>(build);

  const buildRef = useRef(build);
  buildRef.current = build;
  const refresh = useCallback(() => setSections(buildRef.current()), []);

  useEffect(() => {
    setSections(buildRef.current());
  }, [spaceId]);

  useEffect(() => {
    if (query.data) {
      setSections(buildRef.current());
    }
  }, [query.data]);

  const refetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefetch = useCallback(() => {
    if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    refetchTimeoutRef.current = setTimeout(() => {
      refetchTimeoutRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['space-hierarchy', spaceId] });
    }, 500);
  }, [queryClient, spaceId]);

  useEffect(
    () => () => {
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    },
    []
  );

  const handleSpaceChildChange = useCallback(
    (
      event: { getType?: () => string },
      _state: unknown,
      _prev: unknown,
      room: { roomId?: string }
    ) => {
      if (event?.getType?.() !== EventType.SpaceChild) return;
      if (room?.roomId !== spaceId) return;
      debouncedRefetch();
    },
    [debouncedRefetch, spaceId]
  );

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'RoomState.events', refresh);
  useMatrixEvent(client, 'RoomState.events', handleSpaceChildChange);
  useMatrixEvent(client, 'Room.myMembership', debouncedRefetch);
  useMatrixEvent(client, 'sync', refresh);

  return {
    sections,
    isLoading: query.isLoading,
    error:
      query.error instanceof Error
        ? query.error
        : query.error
          ? new Error(String(query.error))
          : null,
    spaceSummary: rootSummaryRef.current.get(spaceId),
  };
}
