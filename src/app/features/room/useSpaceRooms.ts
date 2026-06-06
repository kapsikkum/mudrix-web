import { useState, useCallback, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { roomsUpdatedAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useRooms } from './useRooms';
import { EventType } from 'matrix-js-sdk';
import type { Room } from 'matrix-js-sdk';

export interface SpaceRoomEntry {
  room: Room | null;
  roomId: string;
  name: string;
  avatarMxc: string | null;
  topic: string | null;
  memberCount: number;
  isJoined: boolean;
  isInvite: boolean;
  viaServers: string[];
}

interface HierarchyRoomData {
  room_id: string;
  name?: string;
  avatar_url?: string;
  topic?: string;
  num_joined_members: number;
  join_rule?: string;
}

function isRoomJoinableViaSpace(room: Room, spaceId: string): boolean {
  const ruleEvent = room.currentState.getStateEvents(EventType.RoomJoinRules, '');
  const content = ruleEvent?.getContent() as
    | { join_rule?: string; allow?: { room_id: string; type: string }[] }
    | undefined;
  if (!content) return false;
  const joinRule = content.join_rule;
  if (joinRule === 'public') return true;
  if (joinRule === 'knock') return true;
  if (joinRule === 'restricted' && content.allow) {
    return content.allow.some((a) => a.type === 'm.room_membership' && a.room_id === spaceId);
  }
  return false;
}

export function useSpaceRooms(spaceId: string, unknownLabel = 'Unknown'): SpaceRoomEntry[] {
  const client = getMatrixClientOrNull();
  const joinedRooms = useRooms(spaceId);
  const [forceUpdate] = useAtom(roomsUpdatedAtom);
  const hierarchyRef = useRef<Map<string, HierarchyRoomData>>(new Map());

  const build = useCallback((): SpaceRoomEntry[] => {
    if (!client) return [];
    const space = client.getRoom(spaceId);
    if (!space) return [];

    const joinedMap = new Map(joinedRooms.map((r) => [r.roomId, r]));
    const childEvents = space.currentState.getStateEvents('m.space.child');

    const seen = new Set<string>();
    const entries: SpaceRoomEntry[] = [];

    for (const ev of childEvents) {
      const childId = ev.getStateKey();
      if (!childId || seen.has(childId)) continue;
      seen.add(childId);

      const content = ev.getContent() ?? {};
      const viaServers = (content.via as string[]) ?? [];

      const room = client.getRoom(childId);
      const joined = joinedMap.get(childId);

      if (joined) {
        const topicEv = joined.room.currentState.getStateEvents('m.room.topic', '');
        entries.push({
          room: joined.room,
          roomId: joined.roomId,
          name: joined.name,
          avatarMxc: joined.avatarMxc,
          topic: (topicEv?.getContent()?.topic as string | undefined) ?? null,
          memberCount: joined.room.getJoinedMembers().length,
          isJoined: true,
          isInvite: joined.isInvite,
          viaServers,
        });
      } else if (room && isRoomJoinableViaSpace(room, spaceId)) {
        entries.push({
          room,
          roomId: childId,
          name: room.name ?? unknownLabel,
          avatarMxc: room.getMxcAvatarUrl?.() ?? null,
          topic: null,
          memberCount: 0,
          isJoined: false,
          isInvite: false,
          viaServers,
        });
      } else if (hierarchyRef.current.has(childId)) {
        const hRoom = hierarchyRef.current.get(childId)!;
        const joinRule = hRoom.join_rule;
        if (joinRule === 'public' || joinRule === 'knock' || joinRule === 'restricted') {
          entries.push({
            room: null,
            roomId: childId,
            name: hRoom.name ?? unknownLabel,
            avatarMxc: hRoom.avatar_url ?? null,
            topic: hRoom.topic ?? null,
            memberCount: hRoom.num_joined_members,
            isJoined: false,
            isInvite: false,
            viaServers,
          });
        }
      }
    }

    return entries;
  }, [client, spaceId, joinedRooms, unknownLabel]);

  const [entries, setEntries] = useState<SpaceRoomEntry[]>(build);

  const buildRef = useRef(build);
  buildRef.current = build;
  const refresh = useCallback(() => setEntries(buildRef.current()), []);

  const fetchHierarchy = useCallback(async () => {
    if (!client) return;
    try {
      const hierarchy = await client.getRoomHierarchy(spaceId);
      const map = new Map<string, HierarchyRoomData>();
      for (const room of hierarchy.rooms) {
        map.set(room.room_id, room as HierarchyRoomData);
      }
      hierarchyRef.current = map;
    } catch {
      hierarchyRef.current = new Map();
    }
    setEntries(buildRef.current());
  }, [client, spaceId]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'RoomState.events', refresh);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'sync', refresh);

  useEffect(() => {
    setEntries(buildRef.current());
  }, [spaceId, forceUpdate, joinedRooms]);

  return entries;
}
