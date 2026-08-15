import { useState, useMemo, useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { roomSortAtom } from '@/app/store/atoms/settings';
import { syncStateAtom } from '@/app/store/atoms';
import { pinnedSubSpacesAtom } from '@/app/store/atoms/rooms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import { NotificationCountType } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import {
  formatUserId,
  getLastMessageTimestamp,
  isSpace,
  isDmRoom,
  isVoiceRoom,
  roomState,
} from '@/util/matrix';

export interface RoomEntry {
  room: Room;
  roomId: string;
  name: string;
  avatarMxc: string | null;
  unreadCount: number;
  hasNotif: boolean;
  isInvite: boolean;
  inviterUserId: string | null;
  inviterDisplayName: string | null;
  hasVoiceRoom: boolean;
  sortTimestamp: number;
}

export function useRooms(spaceId: string | null) {
  const client = getMatrixClientOrNull();
  const [roomSort] = useAtom(roomSortAtom);
  const syncState = useAtomValue(syncStateAtom);
  const loading = syncState !== 'PREPARED' && syncState !== 'SYNCING' && syncState !== 'CATCHUP';

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 200);

  const rooms = useMemo((): RoomEntry[] => {
    if (!client) return [];
    const rooms = client.getRooms();
    const joinedOrInvited = new Set(['join', 'invite']);

    // Pre-compute child room IDs for the target space
    let childRoomIdSet: Set<string> | null = null;
    if (spaceId) {
      const space = client.getRoom(spaceId);
      if (space) {
        childRoomIdSet = new Set(
          roomState(space)
            .getStateEvents('m.space.child')
            .map((e) => e.getStateKey())
            .filter(Boolean) as string[]
        );
      }
    }

    return rooms
      .filter((room) => {
        const membership = room.getMyMembership();
        if (!joinedOrInvited.has(membership)) return false;
        if (isSpace(room)) return false;
        if (roomState(room).getStateEvents('m.room.tombstone', '')) return false;
        if (isDmRoom(room, client)) return false;

        if (spaceId) {
          return childRoomIdSet?.has(room.roomId) ?? false;
        }
        // Home: rooms not in any space.
        const allSpaces = rooms.filter(isSpace);
        return !allSpaces.some((sp) =>
          roomState(sp)
            .getStateEvents('m.space.child')
            .some((e) => e.getStateKey() === room.roomId)
        );
      })
      .map((room) => {
        // Check for a voice room
        const hasVoiceRoom = isVoiceRoom(room);
        const isInvite = room.getMyMembership() === 'invite';

        // Extract who sent the invite — read the m.room.member state event for our own userId
        let inviterUserId: string | null = null;
        let inviterDisplayName: string | null = null;
        if (isInvite && client) {
          const myId = client.getUserId() ?? '';
          const memberEvent = roomState(room).getStateEvents('m.room.member', myId);
          const ev = Array.isArray(memberEvent) ? memberEvent[0] : memberEvent;
          if (ev) {
            const senderId = ev.getSender() ?? null;
            inviterUserId = senderId;
            if (senderId) {
              const inviterUser = client.getUser(senderId);
              inviterDisplayName = inviterUser?.displayName ?? formatUserId(senderId) ?? null;
            }
          }
        }

        return {
          room,
          roomId: room.roomId,
          name: room.name ?? room.roomId,
          avatarMxc: room.getMxcAvatarUrl?.() ?? null,
          unreadCount: room.getUnreadNotificationCount() ?? 0,
          hasNotif: (room.getUnreadNotificationCount(NotificationCountType.Highlight) ?? 0) > 0,
          isInvite,
          inviterUserId,
          inviterDisplayName,
          hasVoiceRoom,
          sortTimestamp: getLastMessageTimestamp(room),
        };
      })
      .sort((a, b) => {
        if (a.isInvite && !b.isInvite) return -1;
        if (!a.isInvite && b.isInvite) return 1;

        const sort = spaceId ? roomSort : 'recentActivity';
        if (sort === 'recentActivity') {
          if (a.sortTimestamp !== b.sortTimestamp) return b.sortTimestamp - a.sortTimestamp;
        }

        return a.name.localeCompare(b.name);
      });
  }, [client, spaceId, roomSort, revision]);

  const handleStateEvent = useCallback(
    (_event: MatrixEvent) => {
      bump();
    },
    [bump]
  );

  const handleTimelineEvent = useCallback(
    (_event: MatrixEvent) => {
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

  return { rooms, loading };
}

export interface SpaceEntry {
  room: Room;
  roomId: string;
  name: string;
  avatarMxc: string | null;
  unreadCount: number;
  hasNotif: boolean;
  isInvite: boolean;
}

export interface SpacesData {
  spaces: SpaceEntry[];
  homeHasNotif: boolean;
  dmsHasNotif: boolean;
}

export function useSpaces() {
  const client = getMatrixClientOrNull();
  const pinnedSubSpacesArr = useAtomValue(pinnedSubSpacesAtom);

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 200);

  const data = useMemo((): SpacesData => {
    const pinnedSubSpaces = new Set(pinnedSubSpacesArr);
    if (!client) return { spaces: [], homeHasNotif: false, dmsHasNotif: false };
    const allRooms = client.getRooms();

    const spaceRooms = allRooms.filter(
      (r) => r.isSpaceRoom() && ['join', 'invite'].includes(r.getMyMembership())
    );

    const childSpaceIds = new Set<string>();
    for (const sp of spaceRooms) {
      for (const ev of roomState(sp).getStateEvents('m.space.child')) {
        const childId = ev.getStateKey();
        if (!childId) continue;
        const childRoom = client.getRoom(childId);
        if (childRoom?.isSpaceRoom()) childSpaceIds.add(childId);
      }
    }

    const aggregateUnread = (
      spaceId: string,
      visited = new Set<string>()
    ): { unreadCount: number; hasNotif: boolean } => {
      if (visited.has(spaceId)) return { unreadCount: 0, hasNotif: false };
      visited.add(spaceId);
      const space = client.getRoom(spaceId);
      if (!space) return { unreadCount: 0, hasNotif: false };
      const childEvents = roomState(space).getStateEvents('m.space.child');
      let unreadCount = 0;
      let hasNotif = false;
      for (const ev of childEvents) {
        const childId = ev.getStateKey();
        if (!childId) continue;
        const child = client.getRoom(childId);
        if (!child) continue;
        if (child.isSpaceRoom()) {
          const sub = aggregateUnread(childId, visited);
          unreadCount += sub.unreadCount;
          if (sub.hasNotif) hasNotif = true;
        } else {
          if (isDmRoom(child, client)) continue;
          if (roomState(child).getStateEvents('m.room.tombstone', '')) continue;
          unreadCount += child.getUnreadNotificationCount() ?? 0;
          if ((child.getUnreadNotificationCount() ?? 0) > 0) hasNotif = true;
          if (child.getMyMembership() === 'invite') hasNotif = true;
        }
      }
      return { unreadCount, hasNotif };
    };

    const spaces: SpaceEntry[] = spaceRooms
      .filter((space) => !childSpaceIds.has(space.roomId) || pinnedSubSpaces.has(space.roomId))
      .map((space) => {
        const { unreadCount, hasNotif } = aggregateUnread(space.roomId);
        return {
          room: space,
          roomId: space.roomId,
          name: space.name ?? space.roomId,
          avatarMxc: space.getMxcAvatarUrl?.() ?? null,
          unreadCount,
          hasNotif,
          isInvite: space.getMyMembership() === 'invite',
        };
      });

    const isTombstoned = (room: Room) => !!roomState(room).getStateEvents('m.room.tombstone', '');

    // Home: rooms not in any space, not DMs
    const homeRooms = allRooms.filter((room) => {
      const membership = room.getMyMembership();
      if (!['join', 'invite'].includes(membership)) return false;
      if (room.isSpaceRoom() || isDmRoom(room, client)) return false;
      if (isTombstoned(room)) return false;
      return !spaceRooms.some((sp) =>
        roomState(sp)
          .getStateEvents('m.space.child')
          .some((e) => e.getStateKey() === room.roomId)
      );
    });
    const homeHasNotif = homeRooms.some(
      (r) => (r.getUnreadNotificationCount() ?? 0) > 0 || r.getMyMembership() === 'invite'
    );

    // DMs
    const dmRooms = allRooms.filter(
      (room) =>
        ['join', 'invite'].includes(room.getMyMembership()) &&
        !room.isSpaceRoom() &&
        isDmRoom(room, client) &&
        !isTombstoned(room)
    );
    const dmsHasNotif = dmRooms.some(
      (r) => (r.getUnreadNotificationCount() ?? 0) > 0 || r.getMyMembership() === 'invite'
    );

    return { spaces, homeHasNotif, dmsHasNotif };
  }, [client, pinnedSubSpacesArr, revision]);

  useMatrixEvent(client, 'Room', bump);
  useMatrixEvent(client, 'Room.myMembership', bump);
  useMatrixEvent(client, 'RoomState.events', bump);
  useMatrixEvent(client, 'Room.receipt', throttledBump);
  useMatrixEvent(client, 'Room.UnreadNotifications', throttledBump);
  useMatrixEvent(client, 'sync', bump);

  return data;
}
