import { useQuery } from '@tanstack/react-query';
import type { IPreviewUrlResponse } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';

export function useLinkPreview(
  client: MatrixClient | null,
  url: string | null,
  isEncrypted: boolean
): { data: IPreviewUrlResponse | undefined; isLoading: boolean } {
  const enabled = !!client && !!url && !isEncrypted;

  const { data, isLoading } = useQuery<IPreviewUrlResponse>({
    queryKey: ['linkPreview', url],
    queryFn: () => client!.getUrlPreview(url!, Date.now()),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  // Never expose cached data for encrypted rooms
  return { data: enabled ? data : undefined, isLoading: enabled ? isLoading : false };
}
