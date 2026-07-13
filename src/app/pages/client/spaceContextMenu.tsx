import { ReceiptType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  EyeIcon,
  StackIcon,
  PushPinIcon,
  UserPlusIcon,
  GearIcon,
  SignOutIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import type { SpaceEntry } from '@/app/features/room';
import type { ContextMenuItem } from '@/app/features/contextMenu/contextMenuAtom';
import type { Preferences } from '@/app/store/atoms/settings';
import { getErrorMessage } from '@/util/error';
import { roomState } from '@/util/matrix';

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
    disabled: space.unreadCount === 0 && !space.hasNotif,
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

export function markSpaceAsRead(
  client: MatrixClient | null,
  prefs: Preferences,
  spaceId: string
): void {
  if (!client) return;
  const receiptType = prefs.sendReadReceipts ? ReceiptType.Read : ReceiptType.ReadPrivate;
  const markRoom = (roomId: string, visited = new Set<string>()) => {
    if (visited.has(roomId)) return;
    visited.add(roomId);
    const room = client.getRoom(roomId);
    if (!room) return;
    if (room.isSpaceRoom()) {
      for (const ev of roomState(room).getStateEvents('m.space.child')) {
        const childId = ev.getStateKey();
        if (childId) markRoom(childId, visited);
      }
    } else if (room.getMyMembership() === 'join') {
      const events = room.getLiveTimeline().getEvents();
      const lastEvent = [...events].reverse().find((e) => !e.isRedacted?.());
      if (!lastEvent) return;
      const eventId = lastEvent.getId();
      if (!eventId) return;
      client.sendReadReceipt(lastEvent, receiptType).catch(() => {});
      client.setRoomReadMarkers(roomId, eventId).catch(() => {});
    }
  };
  markRoom(spaceId);
}
