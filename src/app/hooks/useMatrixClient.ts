import { useAtomValue } from 'jotai';
import { clientReadyAtom } from '@/app/store/atoms';
import { getMatrixClient } from '@/client/initMatrix';
import type { MatrixClient } from 'matrix-js-sdk';

export function useMatrixClient(): MatrixClient {
  return getMatrixClient();
}

export function useClientReady(): boolean {
  return useAtomValue(clientReadyAtom);
}
