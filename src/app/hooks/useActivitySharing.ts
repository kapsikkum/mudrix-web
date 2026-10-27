import { useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  hiddenActivitiesAtom,
  presenceOverrideAtom,
  shareActivityAtom,
  shareActivityGamesAtom,
  shareActivityMusicAtom,
} from '@/app/store/atoms';
import {
  getDesktopActivity,
  isTauriDesktop,
  onDesktopActivity,
  setDesktopActivityDetection,
  type DesktopActivity,
} from '@/util/desktop';
import { ACTIVITY_RENEW_MS, ACTIVITY_TTL_MS, type ProfileActivity } from '@/util/profileActivity';
import {
  useExtendedProfileMutations,
  useExtendedProfileSupport,
} from '@/app/hooks/useExtendedProfile';
import { useSyncReady } from '@/app/hooks/useSync';

/** A game or track has to stay for this long before it is published (alt-tabbing, skipping). */
const SETTLE_MS = 4000;
/** Profile writes are at least this far apart, however fast the activity changes. */
const MIN_WRITE_GAP_MS = 15_000;

/** The activity the desktop app currently sees on this computer, for showing in Settings. */
export function useDetectedActivity(): DesktopActivity | null {
  const [activity, setActivity] = useState<DesktopActivity | null>(null);
  useEffect(() => {
    if (!isTauriDesktop()) return undefined;
    let alive = true;
    void getDesktopActivity().then((a) => alive && setActivity(a));
    const off = onDesktopActivity((a) => alive && setActivity(a));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return activity;
}

export function isActivityHidden(name: string, hidden: readonly string[]): boolean {
  const key = name.trim().toLowerCase();
  return hidden.some((h) => h === key);
}

/**
 * Publishes what this computer is playing or listening to on the signed-in user's profile
 * (desktop app only, and only once the user has switched it on in Settings, Privacy).
 *
 * Turning it off stops the scan in the desktop app and clears what was published. While an
 * activity lasts it is rewritten every few minutes with a fresh expiry, so a closed app or a
 * crash drops it from other people's view by itself. Invisible presence shares nothing.
 */
export function useActivitySharing(client: MatrixClient | null): void {
  const share = useAtomValue(shareActivityAtom);
  const games = useAtomValue(shareActivityGamesAtom);
  const music = useAtomValue(shareActivityMusicAtom);
  const hidden = useAtomValue(hiddenActivitiesAtom);
  const presenceOverride = useAtomValue(presenceOverrideAtom);
  const syncReady = useSyncReady();
  const { supported } = useExtendedProfileSupport(client);
  const { saveFields } = useExtendedProfileMutations(client);

  const invisible = presenceOverride === 'offline';
  const active =
    isTauriDesktop() &&
    !!client &&
    syncReady &&
    supported &&
    share &&
    (games || music) &&
    !invisible;

  const saveRef = useRef(saveFields);
  saveRef.current = saveFields;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const hiddenKey = hidden.join('|');

  useEffect(() => {
    if (!active) return undefined;
    let disposed = false;
    // What the scan sees, and what the profile currently says.
    let seen: DesktopActivity | null = null;
    let published: ProfileActivity | null = null;
    let lastWrite = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const wanted = (): DesktopActivity | null =>
      seen && !isActivityHidden(seen.name, hiddenRef.current) ? seen : null;

    const write = async (next: ProfileActivity | null) => {
      lastWrite = Date.now();
      try {
        await saveRef.current({ activity: next });
        published = next;
      } catch {
        // Offline or the server said no; the next renewal tries again.
      }
    };

    const reconcile = () => {
      if (disposed) return;
      const want = wanted();
      const now = Date.now();
      if (!want && !published) return;
      if (now - lastWrite < MIN_WRITE_GAP_MS) {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(reconcile, MIN_WRITE_GAP_MS - (now - lastWrite));
        return;
      }
      void write(
        want
          ? {
              type: want.kind === 'game' ? 'playing' : 'listening',
              name: want.name,
              details: want.details,
              startedAt: want.startedAt,
              expiresAt: now + ACTIVITY_TTL_MS,
            }
          : null
      );
    };

    const onChange = (next: DesktopActivity | null) => {
      seen = next;
      clearTimeout(settleTimer);
      // Going from something to nothing is not delayed: the game closed, the profile should say so.
      settleTimer = setTimeout(reconcile, next ? SETTLE_MS : 0);
    };

    void setDesktopActivityDetection(games, music).then(() => {
      if (disposed) return;
      void getDesktopActivity().then((a) => {
        if (!disposed && seen === null) onChange(a);
      });
    });
    const off = onDesktopActivity(onChange);
    const renew = setInterval(() => {
      if (published && wanted()) {
        lastWrite = 0;
        reconcile();
      }
    }, ACTIVITY_RENEW_MS);

    return () => {
      disposed = true;
      off();
      clearTimeout(settleTimer);
      clearInterval(renew);
      void setDesktopActivityDetection(false, false);
      // Switched off (or signed out, or went invisible): take it off the profile too.
      if (published) void saveRef.current({ activity: null }).catch(() => {});
    };
    // A game added to the hidden list is taken off the profile at once: the effect restarts.
  }, [active, games, music, hiddenKey]);
}
