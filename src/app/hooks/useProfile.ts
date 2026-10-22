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
      if (user?.displayName !== undefined) {
        return { displayName: user.displayName, avatarUrl: user.avatarUrl ?? null, userId };
      }
      // Right after launch the SDK may not know our own user yet; ask the server instead of
      // caching the bare user id (which Save would then write back as the display name).
      try {
        const info = await client.getProfileInfo(userId);
        return {
          displayName: info.displayname ?? formatUserId(userId),
          avatarUrl: info.avatar_url ?? user?.avatarUrl ?? null,
          userId,
        };
      } catch {
        return { displayName: formatUserId(userId), avatarUrl: user?.avatarUrl ?? null, userId };
      }
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
