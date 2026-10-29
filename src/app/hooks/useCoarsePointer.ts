import { useMediaQuery } from './useMediaQuery';

const COARSE_QUERY = '(pointer: coarse)';

export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_QUERY);
}
