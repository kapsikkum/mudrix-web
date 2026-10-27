import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
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
  PROFILE_ACCENT_KEY,
  PROFILE_AVATAR_DECORATION_KEY,
  PROFILE_EFFECT_KEY,
  PROFILE_NAMEPLATE_KEY,
  PROFILE_FRAME_KEY,
  PROFILE_IS_MUDRIX_USER_KEY,
  PROFILE_STATUS_KEY,
  normalizeHex,
  parseAvatarDecoration,
  parseProfileEffect,
  parseNameplate,
  parseProfileFrame,
  isStatusExpired,
  statusToValue,
  type AvatarDecorationId,
  type ProfileEffectId,
  type NameplateId,
  type ProfileFrameId,
  type ProfileStatus,
} from '@/util/profileCosmetics';
import {
  ACTIVITY_EMOJI,
  PROFILE_ACTIVITY_KEY,
  activityToValue,
  isActivityExpired,
  type ProfileActivity,
} from '@/util/profileActivity';
import { useSyncReady } from '@/app/hooks/useSync';

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
      } catch (err) {
        // Private (403) or unknown (404) profiles are legitimately empty. Anything else
        // (network, 401 right after sign-in, 5xx) must not be cached as "no profile".
        const status = httpStatusOf(err);
        if (status === 403 || status === 404) return EMPTY_PROFILE_FIELDS;
        throw err;
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
 * Keeps every cached extended profile (status, banner, decoration, badge) in step app-wide: a
 * member/profile/presence change for a user refetches that user's profile in all mounted views
 * at once, and the first completed sync refetches anything fetched before the client was ready.
 */
export function useProfileLiveSync(client: MatrixClient | null): void {
  const qc = useQueryClient();
  const syncReady = useSyncReady();

  useEffect(() => {
    if (syncReady) void qc.invalidateQueries({ queryKey: [EXTENDED_PROFILE_KEY] });
  }, [qc, syncReady]);

  useEffect(() => {
    if (!client) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const refresh = (userId: string | undefined) => {
      if (!userId || timers.has(userId)) return;
      timers.set(
        userId,
        setTimeout(() => {
          timers.delete(userId);
          void qc.invalidateQueries({ queryKey: [EXTENDED_PROFILE_KEY, userId], exact: true });
        }, 1000)
      );
    };
    const onUser = (_event: unknown, user: { userId: string }) => refresh(user?.userId);
    const onMemberEvent = (event: { getType(): string; getStateKey(): string | undefined }) => {
      if (event.getType() === 'm.room.member') refresh(event.getStateKey());
    };
    const onMember = (_event: unknown, member: { userId: string }) => refresh(member?.userId);
    const on = client.on.bind(client) as (e: string, cb: (...a: never[]) => void) => void;
    const off = client.off.bind(client) as (e: string, cb: (...a: never[]) => void) => void;
    on('User.avatarUrl', onUser as never);
    on('User.displayName', onUser as never);
    on('User.presence', onUser as never);
    on('RoomMember.name', onMember as never);
    on('RoomState.events', onMemberEvent as never);
    return () => {
      off('User.avatarUrl', onUser as never);
      off('User.displayName', onUser as never);
      off('User.presence', onUser as never);
      off('RoomMember.name', onMember as never);
      off('RoomState.events', onMemberEvent as never);
      timers.forEach((t) => clearTimeout(t));
    };
  }, [client, qc]);
}

/** "Playing X" / "Listening to X by Y" in the viewer's language. */
export function activityText(t: TFunction, activity: ProfileActivity): string {
  if (activity.type === 'playing') return t('profile.activity.playing', { name: activity.name });
  return activity.details
    ? t('profile.activity.listeningBy', { title: activity.name, artist: activity.details })
    : t('profile.activity.listening', { title: activity.name });
}

/** Re-renders the caller at `expiresAt`: a profile fetch that returns identical data would not. */
function useRerenderAt(expiresAt: number): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(expiresAt)) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), Math.min(delay, MAX_TIMEOUT_MS));
    return () => window.clearTimeout(id);
  }, [expiresAt, tick]);
  return tick;
}

/**
 * The status if it hasn't expired, else null. Re-renders the caller at the moment it expires
 * (profile fetches that return identical data wouldn't otherwise).
 */
export function useActiveStatus(status: ProfileStatus | null | undefined): ProfileStatus | null {
  const tick = useRerenderAt(status?.expiresAt ?? Infinity);
  // `tick` makes an expired status drop out even though the input is the same.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => (status && !isStatusExpired(status) ? status : null), [status, tick]);
}

/**
 * One line for places with room for only one: the custom status first, then what they are
 * playing or listening to ("In a meeting · Playing Hades"). Null when there is neither.
 */
export function useStatusLine(
  status: ProfileStatus | null | undefined,
  activities: ProfileActivity[] | null | undefined
): ProfileStatus | null {
  const { t } = useTranslation();
  const live = useActiveStatus(status);
  const playing = useLiveActivities(activities);
  return useMemo(() => {
    const parts = [live?.text ?? '', ...playing.map((a) => activityText(t, a))].filter(Boolean);
    const emoji = live?.emoji || (playing[0] ? ACTIVITY_EMOJI[playing[0].type] : '');
    if (!live && parts.length === 0) return null;
    return {
      emoji,
      text: parts.join(' · '),
      mode: live?.mode ?? null,
      expiresAt: live?.expiresAt ?? playing[0]?.expiresAt ?? null,
    };
  }, [live, playing, t]);
}

/**
 * What the person is playing and listening to right now, shown next to their status rather than
 * instead of it. Each drops out when its expiry passes (the desktop app keeps renewing it).
 */
export function useLiveActivities(
  activities: ProfileActivity[] | null | undefined
): ProfileActivity[] {
  const now = Date.now();
  const nextExpiry = Math.min(
    ...(activities ?? []).filter((a) => !isActivityExpired(a, now)).map((a) => a.expiresAt),
    Infinity
  );
  const tick = useRerenderAt(nextExpiry);
  return useMemo(
    () => (activities ?? []).filter((a) => !isActivityExpired(a)),
    // `tick` makes an expired activity drop out even though the input is the same.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activities, tick]
  );
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
  /** What the desktop app sees the user playing and listening to. */
  activities?: ProfileActivity[];
  accent?: string | null;
  avatarDecoration?: AvatarDecorationId | null;
  profileEffect?: ProfileEffectId | null;
  nameplate?: NameplateId | null;
  profileFrame?: ProfileFrameId | null;
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
      if (update.activities !== undefined) {
        jobs.push(writeField(client, [PROFILE_ACTIVITY_KEY], activityToValue(update.activities)));
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
      if (update.nameplate !== undefined) {
        jobs.push(writeField(client, [PROFILE_NAMEPLATE_KEY], parseNameplate(update.nameplate)));
      }
      if (update.profileFrame !== undefined) {
        jobs.push(writeField(client, [PROFILE_FRAME_KEY], parseProfileFrame(update.profileFrame)));
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

/**
 * Sets `chat.mudrix.is_user = true` on the signed-in account's own extended profile, once per
 * account, so other Mudrix clients can show a real "Mudrix user" badge for them. Unlike the
 * cosmetic fields above this is never user-editable and never cleared - it's just a standing
 * fact ("this account has used Mudrix"), not a preference.
 */
export function useEnsureMudrixUserFlag(client: MatrixClient | null): void {
  const syncReady = useSyncReady();
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!client || !syncReady) return;
    const userId = client.getUserId();
    if (!userId || attemptedRef.current === userId) return;

    const storageKey = `mudrix.userFlagSet.${userId}`;
    if (localStorage.getItem(storageKey) === '1') return;
    attemptedRef.current = userId;

    let cancelled = false;
    void (async () => {
      // A missing key 404s - that just means it isn't set yet, not a failure.
      let current: unknown = null;
      try {
        current = await client.getExtendedProfileProperty(userId, PROFILE_IS_MUDRIX_USER_KEY);
      } catch {
        current = null;
      }
      if (current === true) {
        localStorage.setItem(storageKey, '1');
        return;
      }
      if (cancelled) return;
      try {
        await client.setExtendedProfileProperty(PROFILE_IS_MUDRIX_USER_KEY, true);
        localStorage.setItem(storageKey, '1');
      } catch {
        // Not critical - retried on next launch.
        attemptedRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, syncReady]);
}
