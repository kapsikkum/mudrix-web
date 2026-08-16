import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { getNotifLevelSync, setNotifLevel } from '@/app/hooks/useNotifications';
import type { NotifLevel } from '@/app/hooks/useNotifications';
import { roomNotifLevelAtom } from '@/app/store/atoms/notifications';

export function useRoomNotifLevel(roomId: string) {
  const levels = useAtomValue(roomNotifLevelAtom);
  const setLevels = useSetAtom(roomNotifLevelAtom);
  const client = getMatrixClientOrNull();

  const level: NotifLevel = levels[roomId] ?? (client ? getNotifLevelSync(client, roomId) : 'all');

  const setLevel = useCallback(
    async (newLevel: NotifLevel) => {
      if (!client) return;
      const prevLevel = levels[roomId] ?? getNotifLevelSync(client, roomId);
      setLevels((prev) => ({ ...prev, [roomId]: newLevel }));
      try {
        await setNotifLevel(client, roomId, newLevel);
      } catch {
        setLevels((prev) => ({ ...prev, [roomId]: prevLevel }));
      }
    },
    [client, roomId, levels, setLevels]
  );

  return { level, setLevel };
}
