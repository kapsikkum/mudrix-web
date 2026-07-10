import { useState, useCallback, useEffect, useRef } from 'react';
import { NotificationCountType } from 'matrix-js-sdk';
import type { Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { isDmRoom, roomState, getLastMessageTimestamp, formatUserId } from '@/util/matrix';
import { VOICE_STATE_TYPE } from '@/app/hooks/voice/types';
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

  const build = useCallback((): HierarchyItem[] => {
    if (!client || !spaceId) return [];
    const space = client.getRoom(spaceId);
    if (!space) return [];

    const joinedOrInvited = new Set(['join', 'invite']);
    const items: HierarchyItem[] = [];
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

    const rootCategoryKey = `${spaceId}::${spaceId}`;
    const sortedDirectRooms = [...directRooms].sort((a, b) => {
      const aInvite = a.getMyMembership() === 'invite';
      const bInvite = b.getMyMembership() === 'invite';
      if (aInvite && !bInvite) return -1;
      if (!aInvite && bInvite) return 1;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

    if (sortedDirectRooms.length > 0) {
      const rootUnread = aggregateSpaceUnread(spaceId, client);
      items.push({
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
        items.push({
          kind: 'room',
          roomId: room.roomId,
          parentSpaceId: spaceId,
          categoryKey: rootCategoryKey,
          entry: buildRoomEntry(room, client),
        });
      }
    }

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
      }

      if (subRooms.length === 0) continue;

      const sortedSubRooms = [...subRooms].sort((a, b) => {
        const aInvite = a.getMyMembership() === 'invite';
        const bInvite = b.getMyMembership() === 'invite';
        if (aInvite && !bInvite) return -1;
        if (!aInvite && bInvite) return 1;
        return (a.name ?? '').localeCompare(b.name ?? '');
      });

      const subUnread = aggregateSpaceUnread(subSpaceId, client);
      items.push({
        kind: 'space',
        roomId: subSpaceId,
        categoryKey: catKey,
        name: subSpace.name ?? subSpaceId,
        avatarMxc: subSpace.getMxcAvatarUrl?.() ?? null,
        unreadCount: subUnread.unreadCount,
        hasNotif: subUnread.hasNotif,
        isInvite: false,
        isRoot: false,
      });

      for (const room of sortedSubRooms) {
        items.push({
          kind: 'room',
          roomId: room.roomId,
          parentSpaceId: subSpaceId,
          categoryKey: catKey,
          entry: buildRoomEntry(room, client),
        });
      }
    }

    for (const subSpace of subSpaceInvites) {
      const subSpaceId = subSpace.roomId;
      const catKey = `${spaceId}::${subSpaceId}`;
      items.push({
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

    return items;
  }, [client, spaceId]);

  const [items, setItems] = useState<HierarchyItem[]>(build);

  const buildRef = useRef(build);
  buildRef.current = build;
  const refresh = useCallback(() => setItems(buildRef.current()), []);

  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttledRefresh = useCallback(() => {
    if (throttleRef.current !== null) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
      setItems(buildRef.current());
    }, 200);
  }, []);
  useEffect(
    () => () => {
      if (throttleRef.current !== null) clearTimeout(throttleRef.current);
    },
    []
  );

  const handleStateEvent = useCallback(
    (event: { getType?: () => string }) => {
      if (event?.getType?.() === VOICE_STATE_TYPE) return;
      refresh();
    },
    [refresh]
  );

  const handleTimelineEvent = useCallback(
    (event: { getType?: () => string }) => {
      if (event?.getType?.() === VOICE_STATE_TYPE) return;
      throttledRefresh();
    },
    [throttledRefresh]
  );

  useMatrixEvent(client, 'Room', refresh);
  useMatrixEvent(client, 'Room.timeline', handleTimelineEvent);
  useMatrixEvent(client, 'Room.myMembership', refresh);
  useMatrixEvent(client, 'RoomState.events', handleStateEvent);
  useMatrixEvent(client, 'Room.receipt', throttledRefresh);
  useMatrixEvent(client, 'Room.UnreadNotifications', throttledRefresh);
  useMatrixEvent(client, 'sync', refresh);

  useEffect(() => {
    setItems(buildRef.current());
  }, [spaceId]);

  return items;
}
