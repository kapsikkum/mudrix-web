import { useState, useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { roomSortAtom } from '@/app/store/atoms/settings';
import { syncStateAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { NotificationCountType } from 'matrix-js-sdk';
import type { Room } from 'matrix-js-sdk';
import { formatUserId, isSpace, isDmRoom } from '@/util/matrix';

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
  hasVoiceChannel: boolean;
  jitsiDomain: string | null;
}

export function useRooms(spaceId: string | null) {
  const client = getMatrixClientOrNull();
  const [roomSort] = useAtom(roomSortAtom);
  const syncState = useAtomValue(syncStateAtom);
  const loading = syncState !== 'PREPARED' && syncState !== 'SYNCING' && syncState !== 'CATCHUP';

  const getRooms = useCallback((): RoomEntry[] => {
    if (!client) return [];
    const rooms = client.getRooms();

    return rooms
      .filter((room) => {
        const membership = room.getMyMembership();
        if (!['join', 'invite'].includes(membership)) return false;
        if (isSpace(room)) return false;
        if (room.currentState.getStateEvents('m.room.tombstone', '')) return false;
        if (isDmRoom(room, client)) return false;

        if (spaceId) {
          const space = client.getRoom(spaceId);
          if (!space) return false;
          const childRoomIds = space.currentState
            .getStateEvents('m.space.child')
            .map((e) => e.getStateKey())
            .filter(Boolean) as string[];
          return childRoomIds.includes(room.roomId);
        }
        // Home: rooms not in any space.
        const allSpaces = rooms.filter(isSpace);
        return !allSpaces.some((sp) =>
          sp.currentState
            .getStateEvents('m.space.child')
            .some((e) => e.getStateKey() === room.roomId)
        );
      })
      .map((room) => {
        // Check for a voice channel widget
        const widgetEvents = room.currentState.events.get('m.room.widget');
        let hasVoiceChannel = false;
        let jitsiDomain: string | null = null;
        if (widgetEvents) {
          for (const [, ev] of widgetEvents) {
            const c = ev.getContent();
            if (c?.type === 'jitsi-voice-channel') {
              hasVoiceChannel = true;
              const fromData = (c.data as Record<string, string> | undefined)?.jitsiDomain ?? null;
              if (fromData) {
                jitsiDomain = fromData;
              } else {
                // Fall back to parsing the hostname out of the widget url
                try {
                  jitsiDomain = new URL(c.url as string).hostname || null;
                } catch {
                  jitsiDomain = null;
                }
              }
              break;
            }
          }
        }
        const isInvite = room.getMyMembership() === 'invite';

        // Extract who sent the invite — read the m.room.member state event for our own userId
        let inviterUserId: string | null = null;
        let inviterDisplayName: string | null = null;
        if (isInvite && client) {
          const myId = client.getUserId() ?? '';
          const memberEvent = room.currentState.getStateEvents('m.room.member', myId);
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
          hasVoiceChannel,
          jitsiDomain,
        };
      })
      .sort((a, b) => {
        if (a.isInvite && !b.isInvite) return -1;
        if (!a.isInvite && b.isInvite) return 1;

        const sort = spaceId ? roomSort : 'recentActivity';
        if (sort === 'recentActivity') {
          const aTs = a.room.getLastActiveTimestamp();
          const bTs = b.room.getLastActiveTimestamp();
          if (aTs !== bTs) return bTs - aTs;
        }

        return a.name.localeCompare(b.name);
      });
  }, [client, spaceId, roomSort]);

  const [rooms, setRooms] = useState<RoomEntry[]>(getRooms);

  // Stable refresh: always reads the latest getRooms via ref so useMatrixEvent
  // listeners don't need to be re-registered on every render.
  const getRoomsRef = useRef(getRooms);
  getRoomsRef.current = getRooms;
  const refresh = useCallback(() => setRooms(getRoomsRef.current()), []);

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'Room.timeline', refresh);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'RoomState.events', refresh);
  useMatrixEvent(client, 'Room.receipt', refresh);
  useMatrixEvent(client, 'Room.UnreadNotifications', refresh);
  useMatrixEvent(client, 'sync', refresh);

  // Re-run when spaceId or roomSort changes
  useEffect(() => {
    setRooms(getRoomsRef.current());
  }, [spaceId, roomSort]);

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

  const getSpaces = useCallback((): SpacesData => {
    if (!client) return { spaces: [], homeHasNotif: false, dmsHasNotif: false };
    const allRooms = client.getRooms();

    const spaceRooms = allRooms.filter(
      (r) => r.isSpaceRoom() && ['join', 'invite'].includes(r.getMyMembership())
    );

    const spaces: SpaceEntry[] = spaceRooms.map((space) => {
      const childRoomIds = space.currentState
        .getStateEvents('m.space.child')
        .map((e) => e.getStateKey())
        .filter(Boolean) as string[];

      let unreadCount = 0;
      let hasNotif = false;
      for (const childId of childRoomIds) {
        const child = client.getRoom(childId);
        if (!child || child.isSpaceRoom() || isDmRoom(child, client)) continue;
        if (child.currentState.getStateEvents('m.room.tombstone', '')) continue;
        unreadCount += child.getUnreadNotificationCount() ?? 0;
        if (unreadCount > 0) {
          hasNotif = true;
        }
      }

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

    const isTombstoned = (room: Room) => !!room.currentState.getStateEvents('m.room.tombstone', '');

    // Home: rooms not in any space, not DMs
    const homeRooms = allRooms.filter((room) => {
      const membership = room.getMyMembership();
      if (!['join', 'invite'].includes(membership)) return false;
      if (room.isSpaceRoom() || isDmRoom(room, client)) return false;
      if (isTombstoned(room)) return false;
      return !spaceRooms.some((sp) =>
        sp.currentState.getStateEvents('m.space.child').some((e) => e.getStateKey() === room.roomId)
      );
    });
    const homeHasNotif = homeRooms.some((r) => (r.getUnreadNotificationCount() ?? 0) > 0);

    // DMs
    const dmRooms = allRooms.filter(
      (room) =>
        ['join', 'invite'].includes(room.getMyMembership()) &&
        !room.isSpaceRoom() &&
        isDmRoom(room, client) &&
        !isTombstoned(room)
    );
    const dmsHasNotif = dmRooms.some((r) => (r.getUnreadNotificationCount() ?? 0) > 0);

    return { spaces, homeHasNotif, dmsHasNotif };
  }, [client]);

  const [data, setData] = useState<SpacesData>(getSpaces);

  const refresh = useCallback(() => setData(getSpaces()), [getSpaces]);

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'RoomState.events', refresh);
  useMatrixEvent(client, 'Room.receipt', refresh);
  useMatrixEvent(client, 'Room.UnreadNotifications', refresh);
  useMatrixEvent(client, 'sync', refresh);

  return data;
}
