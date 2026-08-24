import type { MatrixClient } from 'matrix-js-sdk';
import { findLastReceiptableEvent, sendUnthreadedReadReceipt } from './markAsRead';
import {
  EyeIcon,
  StackIcon,
  PushPinIcon,
  UserPlusIcon,
  GearIcon,
  SignOutIcon,
  XCircleIcon,
  PlusIcon,
  ChatCircleIcon,
  SpeakerHighIcon,
} from '@phosphor-icons/react';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import type { SpaceEntry } from '@/app/features/room';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import type { Preferences } from '@/app/store/atoms/settings';
import { getErrorMessage } from '@/util/error';
import { roomState, isDmRoom } from '@/util/matrix';

function hasJoinedUnreadRooms(client: MatrixClient | null, roomIds: string[]): boolean {
  if (!client) return false;
  return roomIds.some((id) => {
    const room = client.getRoom(id);
    return (
      room && room.getMyMembership() === 'join' && (room.getUnreadNotificationCount() ?? 0) > 0
    );
  });
}

function spaceHasJoinedUnread(client: MatrixClient | null, spaceId: string): boolean {
  if (!client) return false;
  const visit = (roomId: string, visited = new Set<string>()): boolean => {
    if (visited.has(roomId)) return false;
    visited.add(roomId);
    const room = client.getRoom(roomId);
    if (!room) return false;
    if (room.isSpaceRoom()) {
      return roomState(room)
        .getStateEvents('m.space.child')
        .some((ev) => {
          const childId = ev.getStateKey();
          return childId ? visit(childId, visited) : false;
        });
    }
    if (room.getMyMembership() !== 'join') return false;
    return (room.getUnreadNotificationCount() ?? 0) > 0;
  };
  return visit(spaceId);
}

export interface ViewMenuDeps {
  t: TFunction;
  client: MatrixClient | null;
  prefs: Preferences;
  onNewDm?: () => void;
  onCreateRoom?: () => void;
  onCreateVoiceRoom?: () => void;
}

export function buildHomeMenu(deps: ViewMenuDeps): ContextMenuItem[] {
  const { t, client, prefs, onCreateRoom, onCreateVoiceRoom } = deps;
  const homeIds = getHomeRoomIds(client);
  const items: ContextMenuItem[] = [];
  if (onCreateRoom) {
    items.push({
      label: t('room.addRoom'),
      icon: <PlusIcon size={14} />,
      onClick: onCreateRoom,
    });
  }
  if (onCreateVoiceRoom) {
    items.push({
      label: t('room.addVoiceRoom'),
      icon: <SpeakerHighIcon size={14} />,
      onClick: onCreateVoiceRoom,
    });
  }
  if (onCreateRoom || onCreateVoiceRoom) {
    items.push({ divider: true, label: '', onClick: () => {} });
  }
  items.push({
    label: t('room.markAsRead'),
    icon: <EyeIcon size={14} />,
    disabled: !hasJoinedUnreadRooms(client, homeIds),
    onClick: () => markRoomsAsRead(client, prefs, homeIds),
  });
  return items;
}

export function buildDmsMenu(deps: ViewMenuDeps): ContextMenuItem[] {
  const { t, client, prefs, onNewDm } = deps;
  const dmIds = getDmRoomIds(client);
  const items: ContextMenuItem[] = [];
  if (onNewDm) {
    items.push({
      label: t('room.dm.newDm'),
      icon: <ChatCircleIcon size={14} />,
      onClick: onNewDm,
    });
    items.push({ divider: true, label: '', onClick: () => {} });
  }
  items.push({
    label: t('room.markAsRead'),
    icon: <EyeIcon size={14} />,
    disabled: !hasJoinedUnreadRooms(client, dmIds),
    onClick: () => markRoomsAsRead(client, prefs, dmIds),
  });
  return items;
}

export interface SpaceMenuDeps {
  t: TFunction;
  navigate: NavigateFunction;
  roomActions: {
    client: MatrixClient | null;
    inviteToRoom: (state: { roomId: string; name: string; isSpace: boolean }) => void;
    leaveSpace: (roomId: string, name: string) => void;
  };
  toast: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    success: (msg: string) => void;
  };
  pinnedSubSpaces: Set<string>;
  setPinnedSubSpacesArr: (fn: (prev: string[]) => string[]) => void;
  setSpaceSettings: (roomId: string) => void;
  markSpaceAsRead: (spaceId: string) => void;
}

export function buildSpaceMenu(space: SpaceEntry, deps: SpaceMenuDeps): ContextMenuItem[] {
  const {
    t,
    navigate,
    roomActions,
    toast,
    pinnedSubSpaces,
    setPinnedSubSpacesArr,
    setSpaceSettings,
    markSpaceAsRead,
  } = deps;

  if (space.isInvite) {
    return [
      {
        label: t('invite.declineInvite'),
        icon: <XCircleIcon size={14} />,
        danger: true,
        onClick: async () => {
          const client = roomActions.client;
          if (!client) return;
          try {
            await client.leave(space.roomId);
            toast.info(t('invite.declined', { name: space.name }));
          } catch (err) {
            toast.error(t('invite.declineFailed', { error: getErrorMessage(err) }));
          }
        },
      },
    ];
  }

  const items: ContextMenuItem[] = [];
  items.push({
    label: t('room.markAsRead'),
    icon: <EyeIcon size={14} />,
    disabled: !spaceHasJoinedUnread(roomActions.client, space.roomId),
    onClick: () => markSpaceAsRead(space.roomId),
  });
  items.push({ divider: true, label: '', onClick: () => {} });
  items.push({
    label: t('room.space.overview'),
    icon: <StackIcon size={14} />,
    onClick: () =>
      navigate(`/space/${encodeURIComponent(space.roomId)}`, {
        state: { sidebarView: 'space', currentSpaceId: space.roomId },
      }),
  });
  if (pinnedSubSpaces.has(space.roomId)) {
    items.push({
      label: t('room.space.unpinFromSidebar'),
      icon: <PushPinIcon size={14} weight="fill" />,
      onClick: () => setPinnedSubSpacesArr((prev) => prev.filter((id) => id !== space.roomId)),
    });
    items.push({ divider: true, label: '', onClick: () => {} });
  }
  items.push(
    {
      label: t('common.invite'),
      icon: <UserPlusIcon size={14} />,
      onClick: () =>
        roomActions.inviteToRoom({ roomId: space.roomId, name: space.name, isSpace: true }),
    },
    {
      label: t('common.settings'),
      icon: <GearIcon size={14} />,
      onClick: () => setSpaceSettings(space.roomId),
    },
    {
      divider: true,
      label: '',
      onClick: () => {},
    },
    {
      label: t('room.space.leave'),
      icon: <SignOutIcon size={14} />,
      danger: true,
      onClick: () => roomActions.leaveSpace(space.roomId, space.name),
    }
  );
  return items;
}

function markRoomAsRead(client: MatrixClient, prefs: Preferences, roomId: string): void {
  const room = client.getRoom(roomId);
  if (!room) return;
  if (room.getMyMembership() !== 'join') return;
  const lastEvent = findLastReceiptableEvent(room);
  if (!lastEvent) return;
  const eventId = lastEvent.getId();
  if (!eventId) return;
  sendUnthreadedReadReceipt(client, lastEvent, prefs);
  client.setRoomReadMarkers(roomId, eventId).catch(() => {});
}

export function markSpaceAsRead(
  client: MatrixClient | null,
  prefs: Preferences,
  spaceId: string
): void {
  if (!client) return;
  const visit = (roomId: string, visited = new Set<string>()) => {
    if (visited.has(roomId)) return;
    visited.add(roomId);
    const room = client.getRoom(roomId);
    if (!room) return;
    if (room.isSpaceRoom()) {
      for (const ev of roomState(room).getStateEvents('m.space.child')) {
        const childId = ev.getStateKey();
        if (childId) visit(childId, visited);
      }
    } else {
      markRoomAsRead(client, prefs, roomId);
    }
  };
  visit(spaceId);
}

export function markRoomsAsRead(
  client: MatrixClient | null,
  prefs: Preferences,
  roomIds: string[]
): void {
  if (!client) return;
  for (const roomId of roomIds) {
    markRoomAsRead(client, prefs, roomId);
  }
}

export function getHomeRoomIds(client: MatrixClient | null): string[] {
  if (!client) return [];
  const allRooms = client.getRooms();
  const spaceRooms = allRooms.filter(
    (r) => r.isSpaceRoom() && ['join', 'invite'].includes(r.getMyMembership())
  );
  const isTombstoned = (room: (typeof allRooms)[number]) =>
    !!roomState(room).getStateEvents('m.room.tombstone', '');
  return allRooms
    .filter((room) => {
      const membership = room.getMyMembership();
      if (!['join', 'invite'].includes(membership)) return false;
      if (room.isSpaceRoom() || isDmRoom(room, client)) return false;
      if (isTombstoned(room)) return false;
      return !spaceRooms.some((sp) =>
        roomState(sp)
          .getStateEvents('m.space.child')
          .some((e) => e.getStateKey() === room.roomId)
      );
    })
    .map((r) => r.roomId);
}

export function getDmRoomIds(client: MatrixClient | null): string[] {
  if (!client) return [];
  const allRooms = client.getRooms();
  const isTombstoned = (room: (typeof allRooms)[number]) =>
    !!roomState(room).getStateEvents('m.room.tombstone', '');
  return allRooms
    .filter(
      (room) =>
        ['join', 'invite'].includes(room.getMyMembership()) &&
        !room.isSpaceRoom() &&
        isDmRoom(room, client) &&
        !isTombstoned(room)
    )
    .map((r) => r.roomId);
}
