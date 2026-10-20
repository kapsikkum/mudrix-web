import { useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';
import { RoomEvent } from 'matrix-js-sdk';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { favouriteRoomsAtom, lowPriorityRoomsAtom } from '@/app/store/atoms';

export const FAVOURITE_ROOM_TAG = 'm.favourite';

export const LOW_PRIORITY_ROOM_TAG = 'm.lowpriority';

export function roomIsFavourite(room: Room | null | undefined): boolean {
  return !!room?.tags?.[FAVOURITE_ROOM_TAG];
}

export function roomIsLowPriority(room: Room | null | undefined): boolean {
  return !!room?.tags?.[LOW_PRIORITY_ROOM_TAG];
}

export function useBindFavouriteRooms(client: MatrixClient | null | undefined): void {
  const setFavourites = useSetAtom(favouriteRoomsAtom);
  const setLowPriority = useSetAtom(lowPriorityRoomsAtom);
  const prevRef = useRef<ReadonlySet<string>>(new Set());
  const prevLowRef = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!client) return;

    const resync = () => {
      const ids = new Set<string>();
      const lowIds = new Set<string>();
      for (const room of client.getRooms()) {
        if (roomIsFavourite(room)) ids.add(room.roomId);
        // A favourite is never also shown as low priority.
        else if (roomIsLowPriority(room)) lowIds.add(room.roomId);
      }
      const prev = prevRef.current;
      if (prev.size !== ids.size || ![...ids].every((id) => prev.has(id))) {
        prevRef.current = ids;
        setFavourites(ids);
      }
      const prevLow = prevLowRef.current;
      if (prevLow.size !== lowIds.size || ![...lowIds].every((id) => prevLow.has(id))) {
        prevLowRef.current = lowIds;
        setLowPriority(lowIds);
      }
    };

    resync();
    client.on(RoomEvent.Tags, resync);
    client.on(RoomEvent.MyMembership, resync);
    client.on('sync' as Parameters<typeof client.on>[0], resync);

    return () => {
      client.off(RoomEvent.Tags, resync);
      client.off(RoomEvent.MyMembership, resync);
      client.off('sync' as Parameters<typeof client.on>[0], resync);
    };
  }, [client, setFavourites, setLowPriority]);
}
