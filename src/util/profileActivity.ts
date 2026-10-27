/**
 * What someone is playing or listening to (`chat.mudrix.activity` in the extended profile).
 *
 * The desktop app detects it and, only when the user has switched sharing on, writes it. It
 * carries an expiry that the app keeps pushing forward while the activity lasts, so a crash or
 * a closed laptop clears it by itself within minutes.
 */

export const PROFILE_ACTIVITY_KEY = 'chat.mudrix.activity';

export type ActivityType = 'playing' | 'listening';

export interface ProfileActivity {
  type: ActivityType;
  /** The game, or the track title. */
  name: string;
  /** The artist, for a track. */
  details: string;
  /** Epoch ms when it started, 0 when unknown. */
  startedAt: number;
  /** Epoch ms after which it counts as over. */
  expiresAt: number;
}

/** How long a written activity stays valid, and how often the desktop app renews it. */
export const ACTIVITY_TTL_MS = 12 * 60_000;
export const ACTIVITY_RENEW_MS = 5 * 60_000;

const MAX_NAME_CHARS = 80;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;

export function sanitizeActivityText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return Array.from(text.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, MAX_NAME_CHARS)
    .join('');
}

export function parseActivityValue(value: unknown): ProfileActivity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const type = v.type === 'playing' || v.type === 'listening' ? v.type : null;
  const name = sanitizeActivityText(v.name);
  if (!type || !name) return null;
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
  const expiresAt = num(v.expires);
  // No expiry means a client that doesn't follow the rule above; show nothing rather than forever.
  if (!expiresAt) return null;
  return {
    type,
    name,
    details: sanitizeActivityText(v.details),
    startedAt: num(v.started),
    expiresAt,
  };
}

/** The value we write, or null to clear the field. */
export function activityToValue(
  activity: ProfileActivity | null
): {
  type: ActivityType;
  name: string;
  details?: string;
  started?: number;
  expires: number;
} | null {
  if (!activity) return null;
  const name = sanitizeActivityText(activity.name);
  if (!name) return null;
  const details = sanitizeActivityText(activity.details);
  return {
    type: activity.type,
    name,
    ...(details ? { details } : {}),
    ...(activity.startedAt ? { started: activity.startedAt } : {}),
    expires: activity.expiresAt,
  };
}

export function isActivityExpired(
  activity: ProfileActivity | null | undefined,
  now: number = Date.now()
): boolean {
  return !!activity && activity.expiresAt <= now;
}

export function activityEquals(a: ProfileActivity | null, b: ProfileActivity | null): boolean {
  if (!a || !b) return a === b;
  return a.type === b.type && a.name === b.name && a.details === b.details;
}

export const ACTIVITY_EMOJI: Record<ActivityType, string> = {
  playing: '🎮',
  listening: '🎧',
};
