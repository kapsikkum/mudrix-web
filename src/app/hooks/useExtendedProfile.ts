import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  BANNER_KEYS,
  BIO_KEYS,
  PRONOUN_KEYS,
  PROFILE_TZ_KEY,
  EMPTY_PROFILE_FIELDS,
  bioToValue,
  parseExtendedProfile,
  pronounsToValue,
  sanitizeBio,
  type ExtendedProfileFields,
} from '@/util/profileFields';
import {
  MAX_BADGES,
  PROFILE_ACCENT_KEY,
  PROFILE_AVATAR_DECORATION_KEY,
  PROFILE_BADGES_KEY,
  PROFILE_EFFECT_KEY,
  PROFILE_STATUS_KEY,
  normalizeHex,
  parseAvatarDecoration,
  parseBadges,
  parseProfileEffect,
  isStatusExpired,
  statusToValue,
  type AvatarDecorationId,
  type BadgeId,
  type ProfileEffectId,
  type ProfileStatus,
} from '@/util/profileCosmetics';

export const EXTENDED_PROFILE_KEY = 'extended-profile';

/**
 * Whether the homeserver implements MSC4133 extended profiles. Feature-detected from
 * /versions (v1.16+, `uk.tcpip.msc4133` or `uk.tcpip.msc4133.stable`). The SDK picks the
 * stable /_matrix/client/v3/profile/... paths or the unstable
 * /_matrix/client/unstable/uk.tcpip.msc4133/profile/... ones accordingly.
 */
export function useExtendedProfileSupport(client: MatrixClient | null) {
  const { data, isLoading } = useQuery<boolean>({
    queryKey: ['extended-profile-support', client?.getUserId()],
    queryFn: async () => {
      if (!client) return false;
      try {
        return await client.doesServerSupportExtendedProfiles();
      } catch {
        return false;
      }
    },
    enabled: !!client,
    staleTime: 10 * 60_000,
  });
  return { supported: data ?? false, loading: isLoading };
}

// Lists mount many rows at once; cap how many profile requests run at the same time.
const MAX_CONCURRENT_PROFILE_FETCHES = 4;
let activeProfileFetches = 0;
const profileFetchQueue: Array<() => void> = [];

async function withProfileFetchSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (activeProfileFetches >= MAX_CONCURRENT_PROFILE_FETCHES) {
    // The finishing request hands its slot straight to us, so the count stays accurate.
    await new Promise<void>((resolve) => {
      profileFetchQueue.push(resolve);
    });
  } else {
    activeProfileFetches += 1;
  }
  try {
    return await fn();
  } finally {
    const next = profileFetchQueue.shift();
    if (next) next();
    else activeProfileFetches -= 1;
  }
}

async function fetchRawProfile(
  client: MatrixClient,
  userId: string
): Promise<Record<string, unknown>> {
  if (await client.doesServerSupportExtendedProfiles().catch(() => false)) {
    return client.getExtendedProfile(userId);
  }
  // Without MSC4133 some servers still return unknown keys from the plain profile endpoint.
  return client.getProfileInfo(userId) as Promise<Record<string, unknown>>;
}

/**
 * A user's extended profile fields (bio, pronouns, timezone, banner). Missing fields and
 * 403/404 (private or unknown profile) resolve to empty fields rather than an error.
 */
export function useExtendedProfile(
  client: MatrixClient | null,
  userId: string | null,
  options?: { refetchInterval?: number }
) {
  return useQuery<ExtendedProfileFields>({
    queryKey: [EXTENDED_PROFILE_KEY, userId],
    queryFn: async () => {
      if (!client || !userId) return EMPTY_PROFILE_FIELDS;
      try {
        return parseExtendedProfile(
          await withProfileFetchSlot(() => fetchRawProfile(client, userId))
        );
      } catch {
        return EMPTY_PROFILE_FIELDS;
      }
    },
    enabled: !!client && !!userId,
    staleTime: 60_000,
    // Profile fields have no push; callers that keep a list open poll. TanStack Query pauses
    // interval refetches while the tab is hidden.
    refetchInterval: options?.refetchInterval ?? false,
  });
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * The status if it hasn't expired, else null. Re-renders the caller at the moment it expires
 * (profile fetches that return identical data wouldn't otherwise).
 */
export function useActiveStatus(status: ProfileStatus | null | undefined): ProfileStatus | null {
  const [, setTick] = useState(0);
  const expiresAt = status?.expiresAt ?? null;
  useEffect(() => {
    if (expiresAt === null) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), Math.min(delay, MAX_TIMEOUT_MS));
    return () => window.clearTimeout(id);
  }, [expiresAt]);
  if (!status || isStatusExpired(status)) return null;
  return status;
}

function httpStatusOf(err: unknown): number | undefined {
  const e = err as { httpStatus?: number; errcode?: string };
  if (e?.httpStatus) return e.httpStatus;
  return e?.errcode === 'M_NOT_FOUND' ? 404 : undefined;
}

/**
 * Write or delete one logical field under all of its key names (stable + unstable) so other
 * clients that only know one of them interoperate. Succeeds when at least one write lands.
 */
async function writeField(
  client: MatrixClient,
  keys: readonly string[],
  value: unknown | null
): Promise<void> {
  const results = await Promise.allSettled(
    keys.map((key) =>
      value === null
        ? client.deleteExtendedProfileProperty(key)
        : client.setExtendedProfileProperty(key, value)
    )
  );
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failures.length === 0) return;
  // Deleting a key that was never set is not a failure.
  const real = value === null ? failures.filter((f) => httpStatusOf(f.reason) !== 404) : failures;
  if (real.length === 0 || real.length < results.length) return;
  throw real[0].reason;
}

export interface ExtendedProfileUpdate {
  /** Pass '' to clear. Undefined leaves the field alone. */
  bio?: string;
  pronouns?: string[];
  /** IANA zone. Pass null to clear. */
  timezone?: string | null;
  /** Mudrix-only fields below (`chat.mudrix.*`). Pass null to clear. */
  status?: ProfileStatus | null;
  accent?: string | null;
  avatarDecoration?: AvatarDecorationId | null;
  profileEffect?: ProfileEffectId | null;
  badges?: BadgeId[];
}

export function useExtendedProfileMutations(client: MatrixClient | null) {
  const qc = useQueryClient();
  const userId = client?.getUserId() ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: [EXTENDED_PROFILE_KEY, userId] });

  const { mutateAsync: saveFields, isPending: savingFields } = useMutation({
    mutationFn: async (update: ExtendedProfileUpdate) => {
      if (!client) throw new Error('No client');
      const jobs: Promise<void>[] = [];
      if (update.bio !== undefined) {
        const bio = sanitizeBio(update.bio);
        jobs.push(writeField(client, BIO_KEYS, bio ? bioToValue(bio) : null));
      }
      if (update.pronouns !== undefined) {
        jobs.push(
          writeField(
            client,
            PRONOUN_KEYS,
            update.pronouns.length ? pronounsToValue(update.pronouns) : null
          )
        );
      }
      if (update.timezone !== undefined) {
        jobs.push(writeField(client, [PROFILE_TZ_KEY], update.timezone || null));
      }
      if (update.status !== undefined) {
        jobs.push(writeField(client, [PROFILE_STATUS_KEY], statusToValue(update.status)));
      }
      if (update.accent !== undefined) {
        jobs.push(writeField(client, [PROFILE_ACCENT_KEY], normalizeHex(update.accent)));
      }
      if (update.avatarDecoration !== undefined) {
        jobs.push(
          writeField(
            client,
            [PROFILE_AVATAR_DECORATION_KEY],
            parseAvatarDecoration(update.avatarDecoration)
          )
        );
      }
      if (update.profileEffect !== undefined) {
        jobs.push(
          writeField(client, [PROFILE_EFFECT_KEY], parseProfileEffect(update.profileEffect))
        );
      }
      if (update.badges !== undefined) {
        const badges = parseBadges(update.badges).slice(0, MAX_BADGES);
        jobs.push(writeField(client, [PROFILE_BADGES_KEY], badges.length ? badges : null));
      }
      const settled = await Promise.allSettled(jobs);
      const failed = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason;
    },
    onSettled: invalidate,
  });

  const { mutateAsync: saveBannerFile, isPending: savingBanner } = useMutation({
    mutationFn: async (file: File) => {
      if (!client) throw new Error('No client');
      const { content_uri: mxc } = await client.uploadContent(file, { name: file.name });
      await writeField(client, BANNER_KEYS, mxc);
    },
    onSettled: invalidate,
  });

  const { mutateAsync: removeBannerField, isPending: removingBanner } = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client');
      await writeField(client, BANNER_KEYS, null);
    },
    onSettled: invalidate,
  });

  return {
    saveFields,
    saveBannerFile,
    removeBannerField,
    busy: savingFields || savingBanner || removingBanner,
  };
}
