import { useQuery } from '@tanstack/react-query';
import type { MatrixClient } from 'matrix-js-sdk';

export function useAvatarBlobUrl(
  mxcUrl: string | undefined | null,
  client: MatrixClient | null | undefined
) {
  return useQuery({
    queryKey: ['avatar-blob', mxcUrl],
    queryFn: async () => {
      if (!mxcUrl || !client) return null;
      const httpUrl = client.mxcUrlToHttp(mxcUrl, 64, 64, 'crop', false, true, true);
      if (!httpUrl) return null;
      const res = await fetch(httpUrl, {
        headers: { Authorization: `Bearer ${client.getAccessToken()}` },
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    enabled: !!mxcUrl && !!client,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 2,
    retryDelay: (attempt) => 500 * (attempt + 1),
  });
}
