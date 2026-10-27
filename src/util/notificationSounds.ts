import { publicUrl } from '@/util/publicUrl';
export type NotificationSoundKind = 'message' | 'mention' | 'ring' | 'ringback' | 'callend';
export type VoiceSoundKind = 'mute' | 'unmute' | 'camera-on' | 'camera-off' | 'join' | 'leave';

/** Pack groups, in the order the picker lists them. */
export const SOUND_PACK_CATEGORIES = ['mudrix', 'clients'] as const;
export type SoundPackCategory = (typeof SOUND_PACK_CATEGORIES)[number];

export interface SoundPack {
  id: string;
  name: string;
  /** Where the pack is listed in the picker. */
  category: SoundPackCategory;
  /** Source client the sounds come from. */
  source: string;
  /** Map of sound kind to file name inside the pack directory; missing kinds fall back to message. */
  files: Partial<Record<NotificationSoundKind, string>> & { message: string };
  /** In-call sounds the pack replaces; any it leaves out use the app's own. */
  voice?: Partial<Record<VoiceSoundKind, string>>;
}

export type SoundKind = NotificationSoundKind | VoiceSoundKind;

export const SOUND_KINDS: readonly SoundKind[] = [
  'message',
  'mention',
  'ring',
  'ringback',
  'callend',
  'mute',
  'unmute',
  'camera-on',
  'camera-off',
  'join',
  'leave',
];

export const DEFAULT_SOUND_PACK = 'nes';

export const SOUND_PACKS: readonly SoundPack[] = [
  {
    id: 'bloop',
    name: 'Bloop',
    category: 'mudrix',
    source: '2A03 triangle and pulses, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
  {
    id: 'glass',
    name: 'Glass',
    category: 'mudrix',
    source: 'YM2612 FM with SN76489 and 2A03 layers, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    category: 'mudrix',
    source: 'SN76489, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
  {
    id: 'wizardchat',
    name: 'WizardChat',
    category: 'clients',
    source: 'WizardChat',
    files: { message: 'message.mp3' },
  },
  {
    id: 'element',
    name: 'Element',
    category: 'clients',
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
    category: 'clients',
    source: 'Cinny',
    files: { message: 'message.ogg', mention: 'mention.ogg' },
  },
  {
    id: 'fluffychat',
    name: 'FluffyChat',
    category: 'clients',
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
    category: 'clients',
    source: 'Commet',
    files: { message: 'message.ogg', callend: 'callend.ogg' },
  },
  {
    id: 'lightning',
    name: 'Lightning',
    category: 'clients',
    source: 'Lightning',
    files: { message: 'message.wav', mention: 'mention.wav' },
  },
  {
    id: 'megadrive',
    name: 'Slap',
    category: 'mudrix',
    source: 'YM2612 FM, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
  {
    id: 'nes',
    name: 'Overworld',
    category: 'mudrix',
    source: '2A03, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
  {
    id: 'megadrive2',
    name: 'Velvet',
    category: 'mudrix',
    source: 'YM2612 FM and SN76489, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
  {
    id: 'nes2',
    name: 'Shuffle',
    category: 'mudrix',
    source: '2A03 with DPCM, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
  {
    id: 'sms',
    name: 'Chirp',
    category: 'mudrix',
    source: 'SN76489, made for Mudrix',
    files: {
      message: 'message.mp3',
      mention: 'mention.mp3',
      ring: 'ring.wav',
      ringback: 'ringback.wav',
      callend: 'callend.mp3',
    },
    voice: {
      mute: 'mute.mp3',
      unmute: 'unmute.mp3',
      'camera-on': 'camera-on.mp3',
      'camera-off': 'camera-off.mp3',
      join: 'join.mp3',
      leave: 'leave.mp3',
    },
  },
];

export interface NotificationSoundSettings {
  /** Pack id used for ordinary messages. */
  pack: string;
  /** Per-sound pack id or 'off'; a missing kind follows `pack`. */
  overrides: Partial<Record<SoundKind, string>>;
  /** 0-100 */
  volume: number;
}

/** The packs as picker options, grouped under `groupLabel(category)` in category order. */
export function soundPackOptions(
  groupLabel: (category: SoundPackCategory) => string
): { value: string; label: string; group: string }[] {
  return SOUND_PACK_CATEGORIES.flatMap((category) =>
    SOUND_PACKS.filter((p) => p.category === category).map((p) => ({
      value: p.id,
      label: p.name,
      group: groupLabel(category),
    }))
  );
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

/** URL of a pack's own in-call sound, or null when the pack does not replace it. */
export function getPackVoiceSoundUrl(
  packId: string | undefined,
  kind: VoiceSoundKind
): string | null {
  const pack = getSoundPack(packId);
  const file = pack.voice?.[kind];
  return file ? publicUrl(`assets/sounds/packs/${pack.id}/${file}`) : null;
}

/** The app's own in-call sounds, used when a pack does not replace them. */
export const BUILTIN_VOICE_SOUNDS: Record<VoiceSoundKind, string> = {
  mute: publicUrl('assets/sounds/mute.mp3'),
  unmute: publicUrl('assets/sounds/unmute.mp3'),
  'camera-on': publicUrl('assets/sounds/camera-on.mp3'),
  'camera-off': publicUrl('assets/sounds/camera-off.mp3'),
  join: publicUrl('assets/sounds/join.wav'),
  leave: publicUrl('assets/sounds/leave.wav'),
};

/**
 * Pack that should play for a sound: its override if set, else the main pack. null means the
 * sound is off. Voice kinds resolving to a pack without its own file fall back to the built-in
 * sound at playback (see playVoiceSound).
 */
export function resolveSoundPack(
  kind: SoundKind,
  mainPack: string,
  overrides: Partial<Record<SoundKind, string>>
): string | null {
  const chosen = overrides[kind];
  if (chosen === 'off') return null;
  return chosen || mainPack;
}

let outputDeviceId = '';
type SinkTarget = { setSinkId?: (id: string) => Promise<void> };

/** Send an audio element to the chosen output device. Never throws. */
export function routeToOutput(audio: HTMLAudioElement): void {
  if (!outputDeviceId) return;
  try {
    (audio as unknown as SinkTarget).setSinkId?.(outputDeviceId)?.catch(() => {});
  } catch {
    // unsupported
  }
}

/** Route all app sounds to an output device; '' is the system default. */
export function setSoundOutputDevice(deviceId: string): void {
  outputDeviceId = deviceId;
  if (loopContext) applyContextSink(loopContext);
}

function applyContextSink(ctx: AudioContext): void {
  try {
    (ctx as unknown as SinkTarget).setSinkId?.(outputDeviceId)?.catch(() => {});
  } catch {
    // unsupported
  }
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
    routeToOutput(audio);
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
    routeToOutput(audio);
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
  const ctx = getLoopContext();
  if (!ctx) return startElementLoop(url, volume);

  // Web Audio rather than <audio loop>: an element pauses for a moment every time it wraps
  // round, and a buffer source loops on the exact sample.
  let stopped = false;
  let source: AudioBufferSourceNode | null = null;
  let fallbackStop: (() => void) | null = null;
  const gain = ctx.createGain();
  gain.gain.value = clampVolume(volume);
  gain.connect(ctx.destination);
  ctx.resume().catch(() => {});
  loadLoopBuffer(ctx, url).then(
    (buffer) => {
      if (stopped) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
    },
    () => {
      if (!stopped) fallbackStop = startElementLoop(url, volume);
    }
  );
  return () => {
    stopped = true;
    try {
      source?.stop();
    } catch {
      // never started
    }
    source?.disconnect();
    gain.disconnect();
    fallbackStop?.();
  };
}

let loopContext: AudioContext | null = null;
const loopBuffers = new Map<string, Promise<AudioBuffer>>();

function getLoopContext(): AudioContext | null {
  if (loopContext) return loopContext;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    loopContext = new Ctor();
  } catch {
    return null;
  }
  if (outputDeviceId) applyContextSink(loopContext);
  return loopContext;
}

function loadLoopBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let pending = loopBuffers.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data));
    // A failed load is not remembered, so the next ring tries again.
    pending.catch(() => loopBuffers.delete(url));
    loopBuffers.set(url, pending);
  }
  return pending;
}

function startElementLoop(url: string, volume: number): () => void {
  let audio: HTMLAudioElement | null = null;
  try {
    audio = new Audio(url);
    audio.loop = true;
    audio.volume = clampVolume(volume);
    routeToOutput(audio);
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

/** Play any sound kind once (settings UI). Ring and ringback play a single pass, not a loop. */
export function previewSound(kind: SoundKind, packId: string, volume: number): void {
  if (kind === 'ring' || kind === 'ringback' || kind === 'callend') {
    playCallSound(packId, kind, volume);
    return;
  }
  if (kind === 'message' || kind === 'mention') {
    playPackSound(packId, kind, volume);
    return;
  }
  try {
    const audio = new Audio(getPackVoiceSoundUrl(packId, kind) ?? BUILTIN_VOICE_SOUNDS[kind]);
    audio.volume = clampVolume(volume);
    routeToOutput(audio);
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Name of the bundled Android sound (res/raw) for a message notification, or "silent". The mobile
 * app plays notification sounds natively, so it needs to be told which pack the user chose.
 */
export function nativeSoundName(
  settings: NotificationSoundSettings,
  soundsEnabled: boolean,
  priority: boolean
): string {
  if (!soundsEnabled) return 'silent';
  const packId = resolveSoundPack(
    priority ? 'mention' : 'message',
    settings.pack,
    settings.overrides
  );
  if (!packId) return 'silent';
  const pack = getSoundPack(packId);
  const kind = priority && pack.files.mention ? 'mention' : 'message';
  return `snd_${pack.id}_${kind}`;
}

/** Play the notification sound for an incoming message, honouring per-sound overrides. */
export function playNotificationSoundFor(
  settings: NotificationSoundSettings,
  priority: boolean
): void {
  const kind = priority ? 'mention' : 'message';
  const pack = resolveSoundPack(kind, settings.pack, settings.overrides);
  if (pack) playPackSound(pack, kind, settings.volume);
}
