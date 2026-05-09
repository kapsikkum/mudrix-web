import { useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { syncStateAtom, type SyncState } from '@/app/store/atoms';
import { useMatrixEvent } from './useMatrixEvent';
import type { MatrixClient } from 'matrix-js-sdk';

export function useSyncListener(client: MatrixClient | null) {
  const setSyncState = useSetAtom(syncStateAtom);

  const handleSync = useCallback(
    (state: string) => {
      setSyncState(state as SyncState);
    },
    [setSyncState]
  );

  useMatrixEvent(client, 'sync', handleSync);
}

export function useSyncReady(): boolean {
  const state = useAtomValue(syncStateAtom);
  return state === 'PREPARED' || state === 'SYNCING' || state === 'CATCHUP';
}
