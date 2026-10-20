/**
 * Mudrix-only profile fields: custom status, accent colour, avatar decoration, profile effect
 * and badges. They live in the user's extended profile (MSC4133) under `chat.mudrix.*` keys;
 * other clients ignore them. Pure helpers: every value read from a profile is untrusted, so
 * ids are mapped onto the built-in whitelists below and anything unknown is dropped. Nothing
 * here produces a URL, HTML or style string from remote data.
 */

import type { MatrixClient } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/clientHolder';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';

export const PROFILE_STATUS_KEY = 'chat.mudrix.status';
export const PROFILE_ACCENT_KEY = 'chat.mudrix.accent';
export const PROFILE_AVATAR_DECORATION_KEY = 'chat.mudrix.avatar_decoration';
export const PROFILE_EFFECT_KEY = 'chat.mudrix.profile_effect';
export const PROFILE_BADGES_KEY = 'chat.mudrix.badges';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;

// --- Custom status ---------------------------------------------------------------------------

export type StatusMode = 'idle' | 'dnd';

export interface ProfileStatus {
  /** A single emoji, or '' */
  emoji: string;
  text: string;
  /** Overrides the presence dot colour on Mudrix clients; null leaves presence alone. */
  mode: StatusMode | null;
  /** Epoch ms after which Mudrix clients treat the status as cleared; null = never. */
  expiresAt: number | null;
}

export type StatusClearAfter = 'never' | '1h' | '4h' | 'today';

/** Expiry timestamp for a "clear after" choice, relative to `now`. */
export function statusExpiryFor(option: StatusClearAfter, now: number = Date.now()): number | null {
  if (option === '1h') return now + 3_600_000;
  if (option === '4h') return now + 4 * 3_600_000;
  if (option === 'today') {
    const end = new Date(now);
    end.setHours(24, 0, 0, 0);
    return end.getTime();
  }
  return null;
}

export function isStatusExpired(
  status: ProfileStatus | null | undefined,
  now: number = Date.now()
) {
  return !!status && status.expiresAt !== null && status.expiresAt <= now;
}

export const MAX_STATUS_TEXT_CHARS = 80;
const MAX_STATUS_EMOJI_UNITS = 32;

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string }>;
}

function firstGrapheme(text: string): string {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: object) => SegmenterLike })
    .Segmenter;
  if (Seg) {
    for (const part of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) {
      return part.segment;
    }
    return '';
  }
  return Array.from(text)[0] ?? '';
}

/** Keeps the first grapheme of `text` if it contains an emoji, otherwise ''. */
export function sanitizeStatusEmoji(text: string): string {
  const trimmed = text.replace(CONTROL_CHARS, '').trim();
  if (!trimmed) return '';
  const g = firstGrapheme(trimmed);
  if (!g || g.length > MAX_STATUS_EMOJI_UNITS || !EMOJI_RE.test(g)) return '';
  return g;
}

export function sanitizeStatusText(text: string): string {
  return Array.from(text.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, MAX_STATUS_TEXT_CHARS)
    .join('');
}

export function parseStatusValue(value: unknown): ProfileStatus | null {
  if (!isRecord(value)) return null;
  const emoji = typeof value.emoji === 'string' ? sanitizeStatusEmoji(value.emoji) : '';
  const text = typeof value.text === 'string' ? sanitizeStatusText(value.text) : '';
  const mode = value.mode === 'idle' || value.mode === 'dnd' ? value.mode : null;
  if (!emoji && !text && !mode) return null;
  const expires = value.expires;
  const expiresAt =
    typeof expires === 'number' && Number.isFinite(expires) && expires > 0 ? expires : null;
  return { emoji, text, mode, expiresAt };
}

/** The value we write, or null to clear the field. */
export function statusToValue(
  status: ProfileStatus | null
): { emoji?: string; text?: string; mode?: StatusMode; expires?: number } | null {
  if (!status) return null;
  const emoji = sanitizeStatusEmoji(status.emoji);
  const text = sanitizeStatusText(status.text);
  if (!emoji && !text && !status.mode) return null;
  return {
    ...(emoji ? { emoji } : {}),
    ...(text ? { text } : {}),
    ...(status.mode ? { mode: status.mode } : {}),
    ...(status.expiresAt ? { expires: status.expiresAt } : {}),
  };
}

export function statusEquals(a: ProfileStatus | null, b: ProfileStatus | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.emoji === b.emoji && a.text === b.text && a.mode === b.mode && a.expiresAt === b.expiresAt
  );
}

export type DotPresence = 'online' | 'unavailable' | 'offline' | 'dnd';

/**
 * Presence dot colour once the custom status mode is applied. Offline always wins (a user who
 * is not around is not "do not disturb"); with no presence data an explicit mode still shows.
 */
export function effectiveDotPresence(
  presence: 'online' | 'unavailable' | 'offline' | undefined,
  mode: StatusMode | null | undefined
): DotPresence | undefined {
  if (presence === 'offline') return 'offline';
  if (mode === 'dnd') return 'dnd';
  if (mode === 'idle') return 'unavailable';
  return presence;
}

// --- Accent colour ---------------------------------------------------------------------------

export const ACCENT_PRESETS = [
  '#5865f2',
  '#3b82f6',
  '#14b8a6',
  '#22c55e',
  '#eab308',
  '#f97316',
  '#ef4444',
  '#ec4899',
  '#a855f7',
  '#64748b',
] as const;

/** `#rgb`/`#rrggbb` (hash optional) -> lowercase `#rrggbb`, or null when not a hex colour. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  return `#${hex}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white, whichever reads better on a solid `hex` background (WCAG contrast). */
export function readableTextColor(hex: string): '#ffffff' | '#111827' {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#111827') ? '#ffffff' : '#111827';
}

/** Blend `hex` towards black (amount < 0) or white (amount > 0). */
export function shadeHex(hex: string, amount: number): string {
  const target = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (target - r) * k, g + (target - g) * k, b + (target - b) * k);
}

/** Header gradient for the profile card when the user has an accent and no banner. */
export function accentGradient(hex: string): string {
  return `linear-gradient(135deg, ${shadeHex(hex, 0.12)}, ${shadeHex(hex, -0.4)})`;
}

// --- Whitelisted cosmetics -------------------------------------------------------------------

export const BUILTIN_DECORATION_IDS = [
  'ring',
  'thorns',
  'sparkle',
  'flame',
  'pixel-hearts',
  'stars',
  'halo',
  'cat-ears',
  'bunny-ears',
  'crown',
  'leaf-wreath',
  'neon-ring',
  'glitch-ring',
  'snowflake-ring',
  'cherry-blossoms',
  'angel-wings',
  'devil-horns',
] as const;

export const AVATAR_DECORATION_IDS = BUILTIN_DECORATION_IDS;
export type AvatarDecorationId = string;

const VALID_DECORATION_SET: Set<string> = new Set<string>(AVATAR_DECORATION_IDS);

export const BUILTIN_PROFILE_EFFECT_IDS = ['falling-stars', 'hearts', 'snow', 'sparkles'] as const;
export type BuiltinProfileEffectId = (typeof BUILTIN_PROFILE_EFFECT_IDS)[number];

export const PROFILE_EFFECT_IDS = BUILTIN_PROFILE_EFFECT_IDS;
export type ProfileEffectId = string;

const VALID_PROFILE_EFFECT_SET: Set<string> = new Set<string>(PROFILE_EFFECT_IDS);

export const BADGE_IDS = [
  'early-adopter',
  'developer',
  'supporter',
  'verified-homeserver',
] as const;
export type BadgeId = (typeof BADGE_IDS)[number];
export const MAX_BADGES = 3;

export function parseAvatarDecoration(value: unknown): AvatarDecorationId | null {
  if (typeof value !== 'string') return null;
  if (VALID_DECORATION_SET.has(value)) {
    return value as AvatarDecorationId;
  }
  if (value.startsWith('mxc://')) {
    return value as AvatarDecorationId;
  }
  return null;
}

export function parseProfileEffect(value: unknown): ProfileEffectId | null {
  if (typeof value !== 'string') return null;
  if (VALID_PROFILE_EFFECT_SET.has(value)) {
    return value as ProfileEffectId;
  }
  if (value.startsWith('mxc://')) {
    return value as ProfileEffectId;
  }
  return null;
}

export function profileEffectThumbnailSrc(
  id: ProfileEffectId,
  client?: MatrixClient | null
): string {
  if (id.startsWith('mxc://')) {
    const c = client ?? getMatrixClientOrNull();
    return c ? mxcUrlToHttp(c, id, 96, 96, 'crop') : '';
  }
  // Built-in effects (falling-stars, hearts, snow, sparkles) are canvas-rendered and have no
  // static thumbnail image.
  return '';
}

/** Known badge ids only, deduplicated, in the order given, capped at MAX_BADGES. */
export function parseBadges(value: unknown): BadgeId[] {
  if (!Array.isArray(value)) return [];
  const out: BadgeId[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !(BADGE_IDS as readonly string[]).includes(entry)) continue;
    if (!out.includes(entry as BadgeId)) out.push(entry as BadgeId);
    if (out.length >= MAX_BADGES) break;
  }
  return out;
}

/** Asset path or Matrix mxc URL for a decoration id. */
export function avatarDecorationSrc(
  id: AvatarDecorationId,
  options?: { client?: MatrixClient | null }
): string {
  if (id.startsWith('mxc://')) {
    const c = options?.client ?? getMatrixClientOrNull();
    if (!c) return '';
    return mxcUrlToHttp(c, id);
  }
  return `/assets/decorations/${id}.svg`;
}

export interface MudrixCosmetics {
  status: ProfileStatus | null;
  accent: string | null;
  avatarDecoration: AvatarDecorationId | null;
  profileEffect: ProfileEffectId | null;
  badges: BadgeId[];
}

export const EMPTY_COSMETICS: MudrixCosmetics = {
  status: null,
  accent: null,
  avatarDecoration: null,
  profileEffect: null,
  badges: [],
};

export function parseCosmetics(raw: Record<string, unknown>): MudrixCosmetics {
  return {
    status: parseStatusValue(raw[PROFILE_STATUS_KEY]),
    accent: normalizeHex(raw[PROFILE_ACCENT_KEY]),
    avatarDecoration: parseAvatarDecoration(raw[PROFILE_AVATAR_DECORATION_KEY]),
    profileEffect: parseProfileEffect(raw[PROFILE_EFFECT_KEY]),
    badges: parseBadges(raw[PROFILE_BADGES_KEY]),
  };
}
