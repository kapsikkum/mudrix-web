import { useEffect, useState } from 'react';
import { logger } from './log';
import { publicUrl } from '@/util/publicUrl';
import {
  SOUNDBOARD_MANIFEST_PATH,
  type BuiltInSoundManifestItem,
  type SoundboardClip,
  type SoundboardMimetype,
} from './types';

const BUILT_IN_DIR = 'assets/sounds/soundboard/';
/** After a failed load, wait this long before asking again (the manifest may simply not exist yet). */
const RETRY_AFTER_MS = 60_000;

/** Normalises the mimetypes browsers and servers use for the three formats we accept. */
export function normalizeMimetype(raw: string | undefined | null): SoundboardMimetype | null {
  const type = (raw ?? '').split(';')[0].trim().toLowerCase();
  if (type === 'audio/mpeg' || type === 'audio/mp3') return 'audio/mpeg';
  if (type === 'audio/ogg' || type === 'application/ogg') return 'audio/ogg';
  if (
    type === 'audio/wav' ||
    type === 'audio/x-wav' ||
    type === 'audio/wave' ||
    type === 'audio/vnd.wave'
  ) {
    return 'audio/wav';
  }
  return null;
}

function mimetypeFromFileName(file: string): SoundboardMimetype {
  const ext = file.split('.').pop()?.toLowerCase();
  if (ext === 'ogg' || ext === 'oga' || ext === 'opus') return 'audio/ogg';
  if (ext === 'wav') return 'audio/wav';
  return 'audio/mpeg';
}

function parseItem(raw: unknown): BuiltInSoundManifestItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const { id, name, file } = item;
  if (typeof id !== 'string' || !id || typeof name !== 'string' || !name) return null;
  // A bare file name only: the manifest must not point outside its own directory.
  if (typeof file !== 'string' || !file || /[\\/]|\.\./.test(file)) return null;
  return {
    id,
    name,
    file,
    emoji: typeof item.emoji === 'string' ? item.emoji : '',
    durationMs:
      typeof item.durationMs === 'number' && Number.isFinite(item.durationMs) ? item.durationMs : 0,
    license: typeof item.license === 'string' ? item.license : '',
    author: typeof item.author === 'string' ? item.author : '',
    sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : '',
  };
}

/** Accepts `[...]`, `{ items: [...] }` or `{ sounds: [...] }`. */
export function parseManifest(raw: unknown): BuiltInSoundManifestItem[] {
  let list: unknown = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    list = obj.items ?? obj.sounds;
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: BuiltInSoundManifestItem[] = [];
  for (const entry of list) {
    const item = parseItem(entry);
    if (item && !seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

export function builtInToClip(item: BuiltInSoundManifestItem): SoundboardClip {
  return {
    id: item.id,
    name: item.name,
    emoji: item.emoji || undefined,
    url: publicUrl(`${BUILT_IN_DIR}${item.file}`),
    mimetype: mimetypeFromFileName(item.file),
    durationMs: item.durationMs,
    size: 0,
    volume: 1,
    source: 'builtIn',
    license: item.license,
    author: item.author,
    sourceUrl: item.sourceUrl,
  };
}

let loaded: SoundboardClip[] | null = null;
let pending: Promise<SoundboardClip[]> | null = null;
let failedAt = 0;
const listeners = new Set<(clips: SoundboardClip[]) => void>();

/**
 * The bundled clips from manifest.json. Resolves to [] when the manifest is missing or broken
 * (the soundboard then simply has no built-in clips) and tries again after a minute.
 */
export function loadBuiltInSounds(): Promise<SoundboardClip[]> {
  if (loaded) return Promise.resolve(loaded);
  if (pending) return pending;
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return Promise.resolve([]);
  pending = fetch(publicUrl(SOUNDBOARD_MANIFEST_PATH))
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<unknown>;
    })
    .then((json) => {
      const clips = parseManifest(json).map(builtInToClip);
      loaded = clips;
      failedAt = 0;
      listeners.forEach((fn) => fn(clips));
      return clips;
    })
    .catch((err) => {
      failedAt = Date.now();
      logger.warn('[soundboard] could not load the built-in manifest', err);
      return [] as SoundboardClip[];
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Built-in clip by id, or null (also while the manifest has not loaded). */
export function getBuiltInSound(id: string): SoundboardClip | null {
  return loaded?.find((c) => c.id === id) ?? null;
}

const NONE: SoundboardClip[] = [];

/** The bundled clips, [] until the manifest loads (and for good if there is none). */
export function useBuiltInSounds(): SoundboardClip[] {
  const [clips, setClips] = useState<SoundboardClip[]>(loaded ?? NONE);
  useEffect(() => {
    let active = true;
    const update = (next: SoundboardClip[]) => {
      if (active) setClips(next);
    };
    listeners.add(update);
    loadBuiltInSounds().then(update);
    return () => {
      active = false;
      listeners.delete(update);
    };
  }, []);
  return clips;
}
