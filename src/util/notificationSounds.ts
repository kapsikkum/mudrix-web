import { publicUrl } from '@/util/publicUrl';
export type NotificationSoundKind = 'message' | 'mention' | 'ring' | 'ringback' | 'callend';

export interface SoundPack {
  id: string;
  name: string;
  /** Source client the sounds come from. */
  source: string;
  /** Map of sound kind to file name inside the pack directory; missing kinds fall back to message. */
  files: Partial<Record<NotificationSoundKind, string>> & { message: string };
}

export const DEFAULT_SOUND_PACK = 'wizardchat';

export const SOUND_PACKS: readonly SoundPack[] = [
  {
    id: 'wizardchat',
    name: 'WizardChat',
    source: 'WizardChat',
    files: { message: 'message.mp3' },
  },
  {
    id: 'element',
    name: 'Element',
    source: 'Element Web',
    files: {
      message: 'message.mp3',
      ring: 'ring.mp3',
      ringback: 'ringback.mp3',
      callend: 'callend.mp3',
    },
  },
  {
    id: 'cinny',
    name: 'Cinny',
    source: 'Cinny',
    files: { message: 'message.ogg', mention: 'mention.ogg' },
  },
  {
    id: 'fluffychat',
    name: 'FluffyChat',
    source: 'FluffyChat',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.mp3',
      callend: 'callend.mp3',
    },
  },
  {
    id: 'commet',
    name: 'Commet',
    source: 'Commet',
    files: { message: 'message.ogg', callend: 'callend.ogg' },
  },
  {
    id: 'lightning',
    name: 'Lightning',
    source: 'Lightning',
    files: { message: 'message.wav', mention: 'mention.wav' },
  },
];

export interface NotificationSoundSettings {
  /** Pack id used for ordinary messages. */
  pack: string;
  /** Pack id used for mentions and DMs; empty string means "same as pack". */
  mentionPack: string;
  /** 0-100 */
  volume: number;
}

export function getSoundPack(id: string | undefined): SoundPack {
  return SOUND_PACKS.find((p) => p.id === id) ?? SOUND_PACKS[0];
}

export function getSoundUrl(
  packId: string | undefined,
  kind: NotificationSoundKind = 'message'
): string {
  const pack = getSoundPack(packId);
  const file = pack.files[kind] ?? pack.files.message;
  return publicUrl(`assets/sounds/packs/${pack.id}/${file}`);
}

/**
 * URL of a call sound (ring / ringback / callend) for a pack. Unlike {@link getSoundUrl} this never
 * falls back to the message sound (it would be a bad ringtone): when the selected pack doesn't ship
 * the file, the default pack's file is used, and null is returned if neither has it.
 */
export function getCallSoundUrl(
  packId: string | undefined,
  kind: Extract<NotificationSoundKind, 'ring' | 'ringback' | 'callend'>
): string | null {
  const pack = getSoundPack(packId);
  const file = pack.files[kind];
  if (file) return publicUrl(`assets/sounds/packs/${pack.id}/${file}`);
  const fallback = getSoundPack(DEFAULT_SOUND_PACK);
  const fallbackFile = fallback.files[kind];
  return fallbackFile ? publicUrl(`assets/sounds/packs/${fallback.id}/${fallbackFile}`) : null;
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 1;
  return Math.min(100, Math.max(0, volume)) / 100;
}

let current: HTMLAudioElement | null = null;

/** Play a sound from a pack. Autoplay policy rejections are swallowed. */
export function playPackSound(
  packId: string | undefined,
  kind: NotificationSoundKind,
  volume: number
): void {
  try {
    current?.pause();
    const audio = new Audio(getSoundUrl(packId, kind));
    audio.volume = clampVolume(volume);
    current = audio;
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Play a call sound once (e.g. call end). Uses its own audio element so it is not cut off by
 * message sounds. Returns false when no file exists for the kind.
 */
export function playCallSound(
  packId: string | undefined,
  kind: 'ring' | 'ringback' | 'callend',
  volume: number
): boolean {
  const url = getCallSoundUrl(packId, kind);
  if (!url) return false;
  try {
    const audio = new Audio(url);
    audio.volume = clampVolume(volume);
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
  return true;
}

/**
 * Loop a call sound (ring / ringback) until the returned stop function is called.
 * Returns null when no file exists for the kind. Autoplay rejections are swallowed.
 */
export function startCallSoundLoop(
  packId: string | undefined,
  kind: 'ring' | 'ringback',
  volume: number
): (() => void) | null {
  const url = getCallSoundUrl(packId, kind);
  if (!url) return null;
  let audio: HTMLAudioElement | null = null;
  try {
    audio = new Audio(url);
    audio.loop = true;
    audio.volume = clampVolume(volume);
    audio.play().catch(() => {});
  } catch {
    audio = null;
  }
  return () => {
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio = null;
  };
}

/** Preview a pack's sound (used by the settings UI). */
export function previewSoundPack(
  packId: string,
  volume: number,
  kind: NotificationSoundKind = 'message'
): void {
  playPackSound(packId, kind, volume);
}

/** Play the notification sound for an incoming message, honouring mention/DM override. */
export function playNotificationSoundFor(
  settings: NotificationSoundSettings,
  priority: boolean
): void {
  const pack = priority && settings.mentionPack ? settings.mentionPack : settings.pack;
  playPackSound(pack, priority ? 'mention' : 'message', settings.volume);
}
