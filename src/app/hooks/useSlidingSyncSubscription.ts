import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { currentRoomIdAtom } from '@/app/store/atoms';
import { subscribeToRoom } from '@/client/slidingSync';

/** With sliding sync, the viewed room needs a full subscription (all state, a deeper timeline). */
export function useSlidingSyncSubscription(): void {
  const roomId = useAtomValue(currentRoomIdAtom);
  useEffect(() => {
    subscribeToRoom(roomId);
    return () => subscribeToRoom(null);
  }, [roomId]);
}
