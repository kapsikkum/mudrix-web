import { useMemo, useCallback, useState } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import { isDmRoom, roomState } from '@/util/matrix';
import { buildRoomEntry, type RoomEntry } from './useRooms';
import { resolveSpaceChildren, useSpaceHierarchyMap } from '@/app/features/space/spaceHierarchy';

export interface HierarchySpaceItem {
  kind: 'space';
  roomId: string;
  categoryKey: string;
  name: string;
  avatarMxc: string | null;
  unreadCount: number;
  hasNotif: boolean;
  isInvite: boolean;
  isRoot: boolean;
  depth: number;
}

export interface HierarchyRoomItem {
  kind: 'room';
  roomId: string;
  parentSpaceId: string;
  categoryKey: string;
  entry: RoomEntry;
  depth: number;
}

export type HierarchyItem = HierarchySpaceItem | HierarchyRoomItem;

function aggregateSpaceUnread(
  spaceId: string,
  client: NonNullable<ReturnType<typeof getMatrixClientOrNull>>,
  visited = new Set<string>()
): { unreadCount: number; hasNotif: boolean } {
  if (visited.has(spaceId)) return { unreadCount: 0, hasNotif: false };
  visited.add(spaceId);
  const space = client.getRoom(spaceId);
  if (!space) return { unreadCount: 0, hasNotif: false };

  let unreadCount = 0;
  let hasNotif = false;

  for (const ev of roomState(space).getStateEvents('m.space.child')) {
    const childId = ev.getStateKey();
    if (!childId) continue;
    const child = client.getRoom(childId);
    if (!child) continue;

    // Descend into local sub-spaces too, so nested sections aggregate unread.
    if (child.isSpaceRoom()) {
      const sub = aggregateSpaceUnread(childId, client, visited);
      unreadCount += sub.unreadCount;
      if (sub.hasNotif) hasNotif = true;
    } else {
      if (isDmRoom(child, client)) continue;
      if (roomState(child).getStateEvents('m.room.tombstone', '')) continue;
      const count = child.getUnreadNotificationCount() ?? 0;
      unreadCount += count;
      if (count > 0) hasNotif = true;
      if (child.getMyMembership() === 'invite') hasNotif = true;
    }
  }

  return { unreadCount, hasNotif };
}

interface SubspaceNode {
  header: HierarchySpaceItem;
  rooms: HierarchyRoomItem[];
  spaces: SubspaceNode[];
}

interface BuiltSubtree {
  rooms: HierarchyRoomItem[];
  spaces: SubspaceNode[];
  claimed: Set<string>;
  activeChain: boolean;
}

export function useSpaceHierarchy(spaceId: string | null): HierarchyItem[] {
  const client = getMatrixClientOrNull();
  const { map: serverMap } = useSpaceHierarchyMap(spaceId);

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 200);

  const items = useMemo((): HierarchyItem[] => {
    void revision;
    if (!client || !spaceId) return [];

    const joinedOrInvited = new Set(['join', 'invite']);

    const isSpace = (id: string): boolean => {
      const summ = serverMap.get(id);
      if (summ?.room_type === 'm.space') return true;
      return client.getRoom(id)?.isSpaceRoom() === true;
    };

    const childIds = (nodeId: string): string[] =>
      resolveSpaceChildren(nodeId, client, serverMap).map((c) => c.roomId);

    const makeRoom = (
      roomId: string,
      parentSpaceId: string,
      catKey: string,
      depth: number
    ): HierarchyRoomItem => {
      const room = client.getRoom(roomId)!;
      return {
        kind: 'room',
        roomId,
        parentSpaceId,
        categoryKey: catKey,
        entry: buildRoomEntry(room, client),
        depth,
      };
    };

    const buildTree = (
      nodeId: string,
      depth: number,
      catPrefix: string,
      ancestorsJoined: boolean
    ): BuiltSubtree => {
      const children = childIds(nodeId);
      const nodeLocal = client.getRoom(nodeId);
      const activeChain = ancestorsJoined && nodeLocal?.getMyMembership() === 'join';

      const childSubtrees: Array<{ id: string; catKey: string; sub: BuiltSubtree }> = [];
      const claimed = new Set<string>();
      for (const childId of children) {
        if (!isSpace(childId)) continue;
        const sub = buildTree(childId, depth + 1, `${catPrefix}::${childId}`, activeChain);
        for (const id of sub.claimed) claimed.add(id);
        childSubtrees.push({ id: childId, catKey: `${catPrefix}::${childId}`, sub });
      }

      const spaces: SubspaceNode[] = [];
      for (const { id, catKey, sub } of childSubtrees) {
        const local = client.getRoom(id);
        const membership = local?.getMyMembership() ?? 'leave';
        const isInvite = membership === 'invite';
        const hasContent = sub.rooms.length > 0 || sub.spaces.length > 0;
        if (!isInvite && !(sub.activeChain && hasContent)) continue;
        const summ = serverMap.get(id);
        const unread = aggregateSpaceUnread(id, client);
        spaces.push({
          header: {
            kind: 'space',
            roomId: id,
            categoryKey: catKey,
            name: local?.name ?? summ?.name ?? id,
            avatarMxc: local?.getMxcAvatarUrl?.() ?? summ?.avatar_url ?? null,
            unreadCount: unread.unreadCount,
            hasNotif: unread.hasNotif,
            isInvite,
            isRoot: false,
            depth: depth + 1,
          },
          rooms: sub.activeChain ? sub.rooms : [],
          spaces: sub.spaces,
        });
      }

      const rooms: HierarchyRoomItem[] = [];
      for (const childId of children) {
        if (isSpace(childId)) continue;
        if (claimed.has(childId)) continue;
        const local = client.getRoom(childId);
        if (!local) continue;
        const membership = local.getMyMembership();
        if (!joinedOrInvited.has(membership)) continue;
        if (roomState(local).getStateEvents('m.room.tombstone', '')) continue;
        if (isDmRoom(local, client)) continue;
        if (!activeChain) continue;
        claimed.add(childId);
        rooms.push(makeRoom(childId, nodeId, catPrefix, depth + 1));
      }

      return { rooms, spaces, claimed, activeChain };
    };

    const rootCategoryKey = `${spaceId}::${spaceId}`;
    const tree = buildTree(spaceId, 0, rootCategoryKey, true);

    const sortRooms = (rooms: HierarchyRoomItem[]): HierarchyRoomItem[] => {
      return [...rooms].sort((a, b) => {
        const aInvite = a.entry.isInvite;
        const bInvite = b.entry.isInvite;
        if (aInvite && !bInvite) return -1;
        if (!aInvite && bInvite) return 1;
        return (a.entry.name ?? '').localeCompare(b.entry.name ?? '');
      });
    };

    const sortSubRooms = (sections: SubspaceNode[]): void => {
      for (const section of sections) {
        section.rooms = sortRooms(section.rooms);
        sortSubRooms(section.spaces);
      }
    };

    tree.rooms = sortRooms(tree.rooms);
    sortSubRooms(tree.spaces);

    const result: HierarchyItem[] = [];

    const emitSpaces = (sections: SubspaceNode[]) => {
      for (const section of sections) {
        result.push(section.header);
        for (const room of section.rooms) result.push(room);
        emitSpaces(section.spaces);
      }
    };

    if (tree.rooms.length > 0) {
      const rootUnread = aggregateSpaceUnread(spaceId, client);
      result.push({
        kind: 'space',
        roomId: spaceId,
        categoryKey: rootCategoryKey,
        name: client.getRoom(spaceId)?.name ?? spaceId,
        avatarMxc: client.getRoom(spaceId)?.getMxcAvatarUrl?.() ?? null,
        unreadCount: rootUnread.unreadCount,
        hasNotif: rootUnread.hasNotif,
        isInvite: false,
        isRoot: true,
        depth: 0,
      });
      for (const room of tree.rooms) result.push(room);
    }

    emitSpaces(tree.spaces);

    return result;
  }, [client, spaceId, serverMap, revision]);

  const handleStateEvent = useCallback(
    (_event: { getType?: () => string }) => {
      bump();
    },
    [bump]
  );

  const handleTimelineEvent = useCallback(
    (_event: { getType?: () => string }) => {
      throttledBump();
    },
    [throttledBump]
  );

  useMatrixEvent(client, 'Room', bump);
  useMatrixEvent(client, 'Room.timeline', handleTimelineEvent);
  useMatrixEvent(client, 'Room.myMembership', bump);
  useMatrixEvent(client, 'RoomState.events', handleStateEvent);
  useMatrixEvent(client, 'Room.receipt', throttledBump);
  useMatrixEvent(client, 'Room.UnreadNotifications', throttledBump);
  useMatrixEvent(client, 'sync', bump);

  return items;
}
