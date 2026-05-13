import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAtom } from 'jotai';
import { currentRoomIdAtom, currentSpaceIdAtom, roomsUpdatedAtom } from '@/app/store/atoms';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { EventType, NotificationCountType } from 'matrix-js-sdk';
import type { Room } from 'matrix-js-sdk';

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

function isSpace(room: Room): boolean {
  return room.isSpaceRoom();
}

function isDm(room: Room, dmRooms: Set<string>): boolean {
  return dmRooms.has(room.roomId) || !!room.getDMInviter();
}

function buildDmSet(client: ReturnType<typeof getMatrixClientOrNull>): Set<string> {
  const set = new Set<string>();
  if (!client) return set;
  try {
    const dmData = client.getAccountData(EventType.Direct)?.getContent<Record<string, string[]>>();
    if (dmData) {
      Object.values(dmData)
        .flat()
        .forEach((id) => set.add(id));
    }
  } catch {
    /* ignore */
  }
  return set;
}

export function useRooms(spaceId: string | null) {
  const client = getMatrixClientOrNull();
  const [forceUpdate] = useAtom(roomsUpdatedAtom);

  // Memoize dmSet so its identity is stable across renders;
  // recomputes only when client reference or forceUpdate counter changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dmSet = useMemo(() => buildDmSet(client), [client, forceUpdate]);

  const getRooms = useCallback((): RoomEntry[] => {
    if (!client) return [];
    const rooms = client.getRooms();

    return rooms
      .filter((room) => {
        const membership = room.getMyMembership();
        if (!['join', 'invite'].includes(membership)) return false;
        if (isSpace(room)) return false;
        if (isDm(room, dmSet)) return false;

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
              inviterDisplayName =
                inviterUser?.displayName ?? senderId.split(':')[0].substring(1) ?? null;
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
        return a.name.localeCompare(b.name);
      });
  }, [client, spaceId, dmSet]);

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

  // Run when spaceId or forceUpdate changes (stable deps — no loop risk)
  useEffect(() => {
    setRooms(getRoomsRef.current());
  }, [spaceId, forceUpdate]);

  return rooms;
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
    const dmSet = buildDmSet(client);

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
        if (!child || child.isSpaceRoom() || isDm(child, dmSet)) continue;
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

    // Home: rooms not in any space, not DMs
    const homeRooms = allRooms.filter((room) => {
      const membership = room.getMyMembership();
      if (!['join', 'invite'].includes(membership)) return false;
      if (room.isSpaceRoom() || isDm(room, dmSet)) return false;
      return !spaceRooms.some((sp) =>
        sp.currentState
          .getStateEvents('m.space.child')
          .some((e) => e.getStateKey() === room.roomId)
      );
    });
    const homeHasNotif = homeRooms.some(
      (r) => (r.getUnreadNotificationCount() ?? 0) > 0
    );

    // DMs
    const dmRooms = allRooms.filter(
      (room) =>
        ['join', 'invite'].includes(room.getMyMembership()) &&
        !room.isSpaceRoom() &&
        isDm(room, dmSet)
    );
    const dmsHasNotif = dmRooms.some(
      (r) => (r.getUnreadNotificationCount() ?? 0) > 0
    );

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

export function useCurrentRoom() {
  return useAtom(currentRoomIdAtom);
}

export function useCurrentSpace() {
  return useAtom(currentSpaceIdAtom);
}
