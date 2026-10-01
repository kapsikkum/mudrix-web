import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MatrixClient } from 'matrix-js-sdk';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';

export const PROFILE_BANNER_KEY = 'm.banner_url';
export const PROFILE_BANNER_UNSTABLE_KEY = 'chat.commet.profile_banner';

const BANNER_KEYS = [PROFILE_BANNER_KEY, PROFILE_BANNER_UNSTABLE_KEY] as const;

interface BannerState {
  mxc: string | null;
  canModify: boolean;
}

export function useUserBanner(client: MatrixClient | null, userId: string | null) {
  const qc = useQueryClient();

  const { data: banner } = useQuery<BannerState>({
    queryKey: ['profile-banner', userId],
    queryFn: async () => {
      if (!client || !userId) return { mxc: null, canModify: false };

      let mxc: string | null = null;
      try {
        const profile = (await client.getProfileInfo(userId)) as Record<string, unknown>;
        for (const key of BANNER_KEYS) {
          const val = profile?.[key];
          if (typeof val === 'string' && val) {
            mxc = val;
            break;
          }
        }
      } catch {
        mxc = null;
      }

      return { mxc, canModify: userId === client.getUserId() };
    },
    enabled: !!client && !!userId,
    staleTime: 60_000,
  });

  const invalidate = (uid: string) => {
    qc.invalidateQueries({ queryKey: ['profile-banner', uid] });
    qc.invalidateQueries({ queryKey: ['profile-banner-blob'] });
  };

  const { mutateAsync: saveBanner } = useMutation({
    mutationFn: async ({ file }: { userId: string; file: File }) => {
      if (!client) throw new Error('No client');
      const { content_uri: mxcUrl } = await client.uploadContent(file, {
        name: file.name,
      });
      await client.setProfileInfo(
        PROFILE_BANNER_KEY as 'avatar_url',
        {
          [PROFILE_BANNER_KEY]: mxcUrl,
        } as unknown as { avatar_url: string }
      );
    },
    onSuccess: (_d, { userId: uid }) => invalidate(uid),
  });

  const { mutateAsync: removeBanner } = useMutation({
    mutationFn: async ({ userId: _uid }: { userId: string }) => {
      if (!client) throw new Error('No client');
      await client.setProfileInfo(
        PROFILE_BANNER_KEY as 'avatar_url',
        {
          [PROFILE_BANNER_KEY]: '',
        } as unknown as { avatar_url: string }
      );
    },
    onSuccess: (_d, { userId: uid }) => invalidate(uid),
  });

  return { banner, saveBanner, removeBanner };
}

export function useUserBannerBlob(client: MatrixClient | null, mxc: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-banner-blob', mxc],
    queryFn: async () => {
      if (!mxc || !client) return null;
      const httpUrl = mxcUrlToHttp(client, mxc, 800, 260, 'scale', false, true, true);
      if (!httpUrl) return null;
      const res = await fetch(httpUrl, {
        headers: { Authorization: `Bearer ${client.getAccessToken()}` },
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    },
    enabled: !!mxc && !!client,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 2,
    retryDelay: (attempt) => 500 * (attempt + 1),
  });
}
