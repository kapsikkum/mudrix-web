import type { MatrixClient } from 'matrix-js-sdk';
import { parentSpacesOf, roomStateMaybe } from '@/util/matrix';
import { canSendState } from '@/app/hooks/useCanSendState';
import { normalizeMimetype } from './manifest';
import {
  DEFAULT_SOUNDBOARD_ROOM_SETTINGS,
  SOUNDBOARD_DATA_TYPE,
  SOUNDBOARD_MAX_DURATION_MS,
  SOUNDBOARD_MAX_NAME_LENGTH,
  SOUNDBOARD_MAX_SIZE_BYTES,
  SOUNDBOARD_MAX_SOUNDS,
  SOUNDBOARD_SETTINGS_TYPE,
  SoundboardError,
  type SoundboardClip,
  type SoundboardRoomSettings,
  type SoundboardSound,
} from './types';

type AccountDataKey = Parameters<MatrixClient['setAccountData']>[0];
type ReadAccountDataKey = Parameters<MatrixClient['getAccountData']>[0];

function clamp01(n: unknown, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

/** Keeps only well-formed clips with an allowed type, size and length; never throws. */
export function parseBoard(raw: unknown): SoundboardSound[] {
  const list = (raw as { sounds?: unknown } | null | undefined)?.sounds;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: SoundboardSound[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const s = entry as Record<string, unknown>;
    const mimetype = normalizeMimetype(typeof s.mimetype === 'string' ? s.mimetype : '');
    if (typeof s.id !== 'string' || !s.id || seen.has(s.id)) continue;
    if (typeof s.name !== 'string' || !s.name) continue;
    if (typeof s.url !== 'string' || !s.url.startsWith('mxc://') || !mimetype) continue;
    const durationMs = typeof s.durationMs === 'number' ? s.durationMs : NaN;
    const size = typeof s.size === 'number' ? s.size : NaN;
    if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
    if (!Number.isFinite(size) || size < 0) continue;
    seen.add(s.id);
    out.push({
      id: s.id,
      name: s.name.slice(0, SOUNDBOARD_MAX_NAME_LENGTH),
      emoji: typeof s.emoji === 'string' && s.emoji ? s.emoji.slice(0, 16) : undefined,
      url: s.url,
      mimetype,
      durationMs: Math.min(durationMs, SOUNDBOARD_MAX_DURATION_MS),
      size: Math.min(size, SOUNDBOARD_MAX_SIZE_BYTES * 2),
      volume: clamp01(s.volume, 1),
    });
  }
  return out.slice(0, SOUNDBOARD_MAX_SOUNDS);
}

export function readPersonalBoard(client: MatrixClient | null | undefined): SoundboardSound[] {
  const event = client?.getAccountData(SOUNDBOARD_DATA_TYPE as ReadAccountDataKey);
  return parseBoard(event?.getContent());
}

export function readRoomBoard(
  client: MatrixClient | null | undefined,
  roomId: string
): SoundboardSound[] {
  const room = client?.getRoom(roomId);
  const content = roomStateMaybe(room)?.getStateEvents(SOUNDBOARD_DATA_TYPE, '')?.getContent();
  return parseBoard(content);
}

export async function writePersonalBoard(
  client: MatrixClient,
  sounds: SoundboardSound[]
): Promise<void> {
  try {
    await client.setAccountData(SOUNDBOARD_DATA_TYPE as AccountDataKey, { sounds } as never);
  } catch (err) {
    throw new SoundboardError('save', err instanceof Error ? err.message : undefined);
  }
}

export async function writeRoomBoard(
  client: MatrixClient,
  roomId: string,
  sounds: SoundboardSound[]
): Promise<void> {
  const room = client.getRoom(roomId);
  if (!canSendState(room, SOUNDBOARD_DATA_TYPE, client)) throw new SoundboardError('forbidden');
  try {
    await client.sendStateEvent(roomId, SOUNDBOARD_DATA_TYPE as never, { sounds } as never, '');
  } catch (err) {
    throw new SoundboardError('save', err instanceof Error ? err.message : undefined);
  }
}

/** Rooms whose boards apply in `roomId`: its parent spaces first, then the room itself. */
export function boardRoomIds(client: MatrixClient, roomId: string): string[] {
  const spaces = parentSpacesOf(client, roomId).map((s) => s.roomId);
  return [...spaces, roomId];
}

/** Every room/space board that applies in `roomId`, as clips (a space's clips are shared with its rooms). */
export function readRoomClips(
  client: MatrixClient | null | undefined,
  roomId: string
): SoundboardClip[] {
  if (!client) return [];
  const clips: SoundboardClip[] = [];
  for (const originRoomId of boardRoomIds(client, roomId)) {
    for (const sound of readRoomBoard(client, originRoomId)) {
      // The same id in a space and its room: the room's own clip wins (it comes last).
      const existing = clips.findIndex((c) => c.id === sound.id);
      if (existing >= 0) clips.splice(existing, 1);
      clips.push({ ...sound, source: 'room', originRoomId });
    }
  }
  return clips;
}

// ---- Per-room / per-space settings -------------------------------------------------------

function sanitizeSettings(raw: unknown): SoundboardRoomSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const enabled = typeof c.enabled === 'boolean' ? c.enabled : null;
  const level =
    typeof c.minPowerLevel === 'number' && Number.isFinite(c.minPowerLevel)
      ? c.minPowerLevel
      : null;
  if (enabled === null && level === null) return null;
  return {
    enabled: enabled ?? DEFAULT_SOUNDBOARD_ROOM_SETTINGS.enabled,
    minPowerLevel: level ?? DEFAULT_SOUNDBOARD_ROOM_SETTINGS.minPowerLevel,
  };
}

/** The room's own `io.github.kapsikkum.mudrix.soundboard.settings`, or null when it never set one. */
export function readExplicitRoomSoundboardSettings(
  client: MatrixClient | null | undefined,
  roomId: string
): SoundboardRoomSettings | null {
  const room = client?.getRoom(roomId);
  return sanitizeSettings(
    roomStateMaybe(room)?.getStateEvents(SOUNDBOARD_SETTINGS_TYPE, '')?.getContent()
  );
}

export async function writeRoomSoundboardSettings(
  client: MatrixClient,
  roomId: string,
  settings: SoundboardRoomSettings
): Promise<void> {
  await client.sendStateEvent(
    roomId,
    SOUNDBOARD_SETTINGS_TYPE as never,
    { enabled: settings.enabled, minPowerLevel: settings.minPowerLevel } as never,
    ''
  );
}

export type SoundboardAccess = 'ok' | 'room-disabled' | 'forbidden';

function powerLevelOf(client: MatrixClient, roomId: string, userId: string): number | null {
  const level = client.getRoom(roomId)?.getMember(userId)?.powerLevel;
  return typeof level === 'number' ? level : null;
}

/**
 * Whether `userId` may play soundboard clips in the call in `roomId`: the room and every space it
 * is in must have the soundboard enabled (a setting that was never made counts as enabled), and the
 * person needs the highest "who can play" level among them. Levels are checked against the person's
 * power level in the room that set them (falling back to their level in the call room).
 */
export function evaluateSoundboardAccess(
  client: MatrixClient,
  roomId: string,
  userId: string
): SoundboardAccess {
  const roomLevel = powerLevelOf(client, roomId, userId) ?? 0;
  let verdict: SoundboardAccess = 'ok';
  for (const id of boardRoomIds(client, roomId)) {
    const settings = readExplicitRoomSoundboardSettings(client, id);
    if (!settings) continue;
    if (!settings.enabled) return 'room-disabled';
    const level = id === roomId ? roomLevel : (powerLevelOf(client, id, userId) ?? roomLevel);
    if (level < settings.minPowerLevel) verdict = 'forbidden';
  }
  return verdict;
}
