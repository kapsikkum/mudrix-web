import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { getMemberDisplayName, isDmRoom } from '@/util/matrix';
import { useLiveRoom } from '@/app/hooks/useLiveRoom';

const APP_NAME = 'WizardChat';

export function useDocumentTitle(): void {
  const location = useLocation();
  const client = getMatrixClientOrNull();

  const path = location.pathname;
  const roomMatch = path.match(/^\/(?:r|dm)\/(.+)/);
  const spaceMatch = path.match(/^\/space\/(.+)/);
  const roomId = roomMatch ? decodeURIComponent(roomMatch[1]) : null;
  const spaceId = spaceMatch ? decodeURIComponent(spaceMatch[1]) : null;
  const isDmRoute = path.startsWith('/dm/');

  const room = useLiveRoom(client, roomId ?? undefined);
  const space = useLiveRoom(client, spaceId ?? undefined);

  const [, setTick] = useState(0);
  const watched = room ?? space;
  useEffect(() => {
    if (!watched) return;
    const update = () => setTick((t) => t + 1);
    watched.on('RoomState.events' as Parameters<Room['on']>[0], update);
    return () => {
      watched.off('RoomState.events' as Parameters<Room['on']>[0], update);
    };
  }, [watched]);

  let context: string | null = null;
  if (roomId) {
    context = roomId;
    if (room) {
      const isDm = isDmRoute || (client ? isDmRoom(room, client) : false);
      const myId = client?.getUserId() ?? '';
      const partnerId = isDm ? room.getMembers().find((m) => m.userId !== myId)?.userId : undefined;
      if (partnerId && client) {
        context = getMemberDisplayName(partnerId, client, room.roomId);
      } else {
        context = room.name ?? roomId;
      }
    }
  } else if (spaceId) {
    context = space ? (space.name ?? spaceId) : spaceId;
  }

  useEffect(() => {
    document.title = context ? `${APP_NAME} | ${context}` : APP_NAME;
  }, [context]);

  useEffect(() => {
    return () => {
      document.title = APP_NAME;
    };
  }, []);
}
