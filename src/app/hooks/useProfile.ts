import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MatrixClient } from 'matrix-js-sdk';
import { formatUserId } from '@/util/matrix';

export interface ProfileData {
  displayName: string;
  avatarUrl: string | null;
  userId: string;
}

export function useProfile(client: MatrixClient) {
  const qc = useQueryClient();
  const userId = client.getUserId() ?? '';

  const { data: profile } = useQuery<ProfileData>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const user = client.getUser(userId);
      return {
        displayName: user?.displayName ?? formatUserId(userId),
        avatarUrl: user?.avatarUrl ?? null,
        userId,
      };
    },
    staleTime: 60_000,
  });

  const { mutateAsync: saveProfile } = useMutation({
    mutationFn: async ({
      displayName,
      avatarFile,
    }: {
      displayName?: string;
      avatarFile?: File;
    }) => {
      const ops: Promise<void>[] = [];
      if (displayName !== undefined) {
        ops.push(client.setDisplayName(displayName).then(() => {}));
      }
      if (avatarFile) {
        const { content_uri: mxcUrl } = await client.uploadContent(avatarFile, {
          name: avatarFile.name,
        });
        ops.push(client.setAvatarUrl(mxcUrl).then(() => {}));
      }
      await Promise.all(ops);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  const { mutateAsync: removeAvatar } = useMutation({
    mutationFn: async () => {
      await client.setAvatarUrl('');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  return { profile, saveProfile, removeAvatar };
}
