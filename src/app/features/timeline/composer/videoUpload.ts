import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import {
  serverUploadLimitAtom,
  videoUploadHeightAtom,
  videoUploadMinSizeAtom,
  videoUploadModeAtom,
  videoUploadTargetAtom,
  type VideoUploadMode,
} from '@/app/store/atoms';
import {
  planCompression,
  type CompressTarget,
  type FixedHeight,
  type VideoMeta,
  type VideoQuality,
} from '@/util/videoCompress';

const MB = 1024 * 1024;
/** Share of the server's limit a smart upload aims for, so a little overshoot still goes through. */
const SERVER_LIMIT_SHARE = 0.95;

export interface VideoUploadPrefs {
  mode: VideoUploadMode;
  height: FixedHeight;
  /** Largest size a smart upload aims for, before the server's limit is applied. */
  targetBytes: number;
  /** Videos smaller than this are never re-encoded. */
  minBytes: number;
}

export function useVideoUploadPrefs(): VideoUploadPrefs {
  const mode = useAtomValue(videoUploadModeAtom);
  const height = useAtomValue(videoUploadHeightAtom);
  const target = useAtomValue(videoUploadTargetAtom);
  const minSize = useAtomValue(videoUploadMinSizeAtom);
  return useMemo(
    () => ({
      mode,
      height: Number(height) as FixedHeight,
      targetBytes: target === 'server' ? Infinity : Number(target) * MB,
      minBytes: Number(minSize) * MB,
    }),
    [mode, height, target, minSize]
  );
}

/** The size a smart upload aims for: what the settings ask, but never beyond what the server takes. */
export function smartMaxBytes(prefs: VideoUploadPrefs, maxUploadBytes: number): number {
  return Math.floor(Math.min(prefs.targetBytes, maxUploadBytes * SERVER_LIMIT_SHARE));
}

/**
 * What a video is sent as when the user hasn't picked for it: untouched, unless the settings ask for
 * big videos to be shrunk or the server wouldn't take it otherwise.
 */
export function defaultVideoQuality(
  prefs: VideoUploadPrefs,
  size: number,
  maxUploadBytes: number,
  canCompress: boolean
): VideoQuality {
  if (!canCompress) return 'original';
  if (size > maxUploadBytes) return prefs.mode === 'fixed' ? prefs.height : 'smart';
  if (prefs.mode === 'original' || size < prefs.minBytes) return 'original';
  return prefs.mode === 'fixed' ? prefs.height : 'smart';
}

export function qualityTarget(
  quality: VideoQuality,
  prefs: VideoUploadPrefs,
  maxUploadBytes: number
): CompressTarget | undefined {
  if (quality === 'original') return undefined;
  if (quality === 'smart') return { kind: 'smart', maxBytes: smartMaxBytes(prefs, maxUploadBytes) };
  return { kind: 'fixed', height: quality };
}

const OFFERED_HEIGHTS: FixedHeight[] = [720, 480];
/** An option is only offered if it comes out at most this share of the original (the encoder wants 15% saved). */
const MIN_SAVING_RATIO = 0.85;

export interface VideoChoice {
  quality: VideoQuality;
  /** Expected size when sent this way; null while the video's own details aren't known yet. */
  size: number | null;
}

/**
 * What one video can be sent as, each with its expected size. Original is always first. Sizes the
 * video already fits in, or resolutions at or above its own, are left out as they'd change nothing.
 */
export function videoChoices(
  meta: VideoMeta | null,
  fileSize: number,
  prefs: VideoUploadPrefs,
  maxUploadBytes: number
): VideoChoice[] {
  const choices: VideoChoice[] = [{ quality: 'original', size: fileSize }];
  const heights = new Set<FixedHeight>(OFFERED_HEIGHTS);
  if (prefs.mode === 'fixed') heights.add(prefs.height);
  const qualities: VideoQuality[] = ['smart', ...[...heights].sort((a, b) => b - a)];
  for (const quality of qualities) {
    const target = qualityTarget(quality, prefs, maxUploadBytes);
    if (!target) continue;
    if (!meta) {
      choices.push({ quality, size: null });
      continue;
    }
    const plan = planCompression(meta, target);
    // The encoder keeps the original when it wouldn't be clearly smaller, so don't offer what saves nothing.
    if (plan && plan.estimatedBytes <= fileSize * MIN_SAVING_RATIO) {
      choices.push({ quality, size: plan.estimatedBytes });
    }
  }
  return choices;
}

/** What the tray shows and the send uses for one video: the user's pick, else the default. */
export function useEffectiveVideoQuality(
  override: VideoQuality | undefined,
  size: number,
  canCompress: boolean
): VideoQuality {
  const prefs = useVideoUploadPrefs();
  const maxUploadBytes = useAtomValue(serverUploadLimitAtom);
  return override ?? defaultVideoQuality(prefs, size, maxUploadBytes, canCompress);
}
