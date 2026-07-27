import { useState, useMemo, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { NotificationCountType } from 'matrix-js-sdk';
import type { Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import { isDmRoom, roomState, getLastMessageTimestamp, formatUserId } from '@/util/matrix';
import { VOICE_STATE_TYPE } from '@/app/hooks/voice/types';
import { spaceRoomOrderAtom } from '@/app/store/atoms/rooms';
import { applyCustomOrder } from '@/app/util/applyCustomOrder';
import type { RoomEntry } from './useRooms';

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
}

export interface HierarchyRoomItem {
  kind: 'room';
  roomId: string;
  parentSpaceId: string;
  categoryKey: string;
  entry: RoomEntry;
}

export type HierarchyItem = HierarchySpaceItem | HierarchyRoomItem;

function buildRoomEntry(room: Room, client: ReturnType<typeof getMatrixClientOrNull>): RoomEntry {
  const widgetEvents = roomState(room).events.get('m.room.widget');
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
    hasVoiceChannel,
    jitsiDomain,
    sortTimestamp: getLastMessageTimestamp(room),
  };
}

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

export function useSpaceHierarchy(spaceId: string | null): HierarchyItem[] {
  const client = getMatrixClientOrNull();
  const spaceRoomOrder = useAtomValue(spaceRoomOrderAtom);

  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 200);

  const items = useMemo((): HierarchyItem[] => {
    if (!client || !spaceId) return [];
    const space = client.getRoom(spaceId);
    if (!space) return [];

    const joinedOrInvited = new Set(['join', 'invite']);
    const result: HierarchyItem[] = [];
    const childEvents = roomState(space).getStateEvents('m.space.child');
    const directRooms: Room[] = [];
    const subSpaces: Room[] = [];
    const subSpaceInvites: Room[] = [];

    for (const ev of childEvents) {
      const childId = ev.getStateKey();
      if (!childId) continue;
      const child = client.getRoom(childId);
      if (!child) continue;
      const membership = child.getMyMembership();
      if (!joinedOrInvited.has(membership)) continue;
      if (roomState(child).getStateEvents('m.room.tombstone', '')) continue;

      if (child.isSpaceRoom()) {
        if (membership === 'invite') {
          subSpaceInvites.push(child);
        } else {
          subSpaces.push(child);
        }
      } else {
        if (isDmRoom(child, client)) continue;
        directRooms.push(child);
      }
    }

    // Track all room IDs emitted so far to prevent duplicates.
    // Sub-space rooms take priority; direct root rooms that are also
    // sub-space children are dropped to avoid React key collisions.
    const emittedRoomIds = new Set<string>();

    // Collect sub-space rooms first so we know which IDs to skip from directRooms.
    const subSpaceSections: Array<{ header: HierarchySpaceItem; rooms: HierarchyRoomItem[] }> = [];

    for (const subSpace of subSpaces) {
      const subSpaceId = subSpace.roomId;
      const catKey = `${spaceId}::${subSpaceId}`;
      const subChildEvents = roomState(subSpace).getStateEvents('m.space.child');
      const subRooms: Room[] = [];

      for (const ev of subChildEvents) {
        const childId = ev.getStateKey();
        if (!childId) continue;
        const evContent = ev.getContent() as Record<string, unknown>;
        if (!evContent || !Array.isArray(evContent['via'])) continue;
        const child = client.getRoom(childId);
        if (!child) continue;
        const membership = child.getMyMembership();
        if (!joinedOrInvited.has(membership)) continue;
        if (child.isSpaceRoom()) continue;
        if (isDmRoom(child, client)) continue;
        if (roomState(child).getStateEvents('m.room.tombstone', '')) continue;
        subRooms.push(child);
        emittedRoomIds.add(child.roomId);
      }

      if (subRooms.length === 0) continue;

      const baseSortedSubRooms = [...subRooms].sort((a, b) => {
        const aInvite = a.getMyMembership() === 'invite';
        const bInvite = b.getMyMembership() === 'invite';
        if (aInvite && !bInvite) return -1;
        if (!aInvite && bInvite) return 1;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });
      const subOrder = spaceRoomOrder[subSpaceId];
      const sortedSubRooms =
        subOrder && subOrder.length > 0
          ? applyCustomOrder(baseSortedSubRooms, subOrder, (r) => r.roomId)
          : baseSortedSubRooms;

      const subUnread = aggregateSpaceUnread(subSpaceId, client);
      subSpaceSections.push({
        header: {
          kind: 'space',
          roomId: subSpaceId,
          categoryKey: catKey,
          name: subSpace.name ?? subSpaceId,
          avatarMxc: subSpace.getMxcAvatarUrl?.() ?? null,
          unreadCount: subUnread.unreadCount,
          hasNotif: subUnread.hasNotif,
          isInvite: false,
          isRoot: false,
        },
        rooms: sortedSubRooms.map((room) => ({
          kind: 'room' as const,
          roomId: room.roomId,
          parentSpaceId: subSpaceId,
          categoryKey: catKey,
          entry: buildRoomEntry(room, client),
        })),
      });
    }

    // Root "Rooms" section — skip rooms already claimed by a sub-space
    const rootCategoryKey = `${spaceId}::${spaceId}`;
    const filteredDirectRooms = directRooms.filter((r) => !emittedRoomIds.has(r.roomId));
    const baseSortedDirectRooms = [...filteredDirectRooms].sort((a, b) => {
      const aInvite = a.getMyMembership() === 'invite';
      const bInvite = b.getMyMembership() === 'invite';
      if (aInvite && !bInvite) return -1;
      if (!aInvite && bInvite) return 1;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
    const rootOrder = spaceRoomOrder[spaceId];
    const sortedDirectRooms =
      rootOrder && rootOrder.length > 0
        ? applyCustomOrder(baseSortedDirectRooms, rootOrder, (r) => r.roomId)
        : baseSortedDirectRooms;

    if (sortedDirectRooms.length > 0) {
      const rootUnread = aggregateSpaceUnread(spaceId, client);
      result.push({
        kind: 'space',
        roomId: spaceId,
        categoryKey: rootCategoryKey,
        name: space.name ?? spaceId,
        avatarMxc: space.getMxcAvatarUrl?.() ?? null,
        unreadCount: rootUnread.unreadCount,
        hasNotif: rootUnread.hasNotif,
        isInvite: false,
        isRoot: true,
      });
      for (const room of sortedDirectRooms) {
        result.push({
          kind: 'room',
          roomId: room.roomId,
          parentSpaceId: spaceId,
          categoryKey: rootCategoryKey,
          entry: buildRoomEntry(room, client),
        });
      }
    }

    // Then emit sub-space sections
    for (const section of subSpaceSections) {
      result.push(section.header);
      for (const room of section.rooms) {
        result.push(room);
      }
    }

    for (const subSpace of subSpaceInvites) {
      const subSpaceId = subSpace.roomId;
      const catKey = `${spaceId}::${subSpaceId}`;
      result.push({
        kind: 'space',
        roomId: subSpaceId,
        categoryKey: catKey,
        name: subSpace.name ?? subSpaceId,
        avatarMxc: subSpace.getMxcAvatarUrl?.() ?? null,
        unreadCount: 0,
        hasNotif: true,
        isInvite: true,
        isRoot: false,
      });
    }

    return result;
  }, [client, spaceId, spaceRoomOrder, revision]);

  const handleStateEvent = useCallback(
    (event: { getType?: () => string }) => {
      if (event?.getType?.() === VOICE_STATE_TYPE) return;
      bump();
    },
    [bump]
  );

  const handleTimelineEvent = useCallback(
    (event: { getType?: () => string }) => {
      if (event?.getType?.() === VOICE_STATE_TYPE) return;
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
