import { useEffect, useState } from 'react';
import type { MatrixClient, Room } from 'matrix-js-sdk';
import { ClientEvent } from 'matrix-js-sdk';

export function useLiveRoom(
  client: MatrixClient | null | undefined,
  roomId: string | undefined
): Room | null {
  const [room, setRoom] = useState<Room | null>(() =>
    client && roomId ? (client.getRoom(roomId) ?? null) : null
  );

  useEffect(() => {
    if (!client || !roomId) {
      setRoom(null);
      return;
    }

    const check = () => {
      setRoom((prev) => {
        const next = client.getRoom(roomId) ?? null;
        return next === prev ? prev : next;
      });
    };

    check();

    client.on(ClientEvent.Sync, check);
    client.on(ClientEvent.Room, check);

    const t1 = window.setTimeout(check, 50);
    const t2 = window.setTimeout(check, 300);
    const t3 = window.setTimeout(check, 1200);

    return () => {
      client.off(ClientEvent.Sync, check);
      client.off(ClientEvent.Room, check);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [client, roomId]);

  return room;
}
