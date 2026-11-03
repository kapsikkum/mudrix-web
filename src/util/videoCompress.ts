export type FixedHeight = 1080 | 720 | 480;
/** What one attachment is sent as: untouched, shrunk to fit the size the settings aim for, or a fixed resolution. */
export type VideoQuality = 'original' | 'smart' | FixedHeight;
/** What the encoder is asked for: a size to fit under, or a resolution to scale down to. */
export type CompressTarget =
  | { kind: 'smart'; maxBytes: number }
  | { kind: 'fixed'; height: FixedHeight };

/** What is known about a source video before it is encoded; `height` and `width` are as displayed. */
export interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  /** Bits per second of the whole file, sound included. */
  bitrate: number;
}

export interface CompressPlan {
  /** Short side the video is scaled down to (never above its own). */
  height: number;
  /** Bits per second for the picture. */
  videoBitrate: number;
  estimatedBytes: number;
}

/** Resolution steps a smart plan picks from: each needs at least `min` bit/s to look decent, and gains nothing past `cap`. */
const TIERS = [
  { height: 1080, min: 3_500_000, cap: 6_000_000 },
  { height: 720, min: 1_800_000, cap: 3_000_000 },
  { height: 480, min: 800_000, cap: 1_500_000 },
  { height: 360, min: 400_000, cap: 800_000 },
] as const;
/** What a fixed resolution is encoded at. */
const FIXED_BITRATE: Record<FixedHeight, number> = {
  1080: 5_000_000,
  720: 2_800_000,
  480: 1_400_000,
};
const AUDIO_BITRATE = 128_000;
/** Lowest picture bitrate a smart plan will go to for a clip too long to fit otherwise. */
const MIN_VIDEO_BITRATE = 150_000;
/** Share of the size budget left for the picture and sound; the rest absorbs container overhead and rate overshoot. */
const BUDGET_SHARE = 0.9;
const MAX_FRAME_RATE = 30;
/** The result is only worth sending if it is at least this much smaller than the original. */
const MIN_SAVING = 0.15;

let probe: Promise<boolean> | null = null;
let supported = false;

/**
 * Whether this webview can re-encode video: WebCodecs with an H.264 encoder. The check is async,
 * so this is false until `probeVideoCompression` (started by the first call) has finished.
 */
export function canCompressVideo(): boolean {
  void probeVideoCompression();
  return supported;
}

export function probeVideoCompression(): Promise<boolean> {
  probe ??= (async () => {
    if (
      typeof VideoEncoder === 'undefined' ||
      typeof VideoDecoder === 'undefined' ||
      typeof VideoFrame === 'undefined'
    ) {
      return false;
    }
    try {
      const { supported: ok } = await VideoEncoder.isConfigSupported({
        codec: 'avc1.640028',
        width: 1280,
        height: 720,
        bitrate: FIXED_BITRATE[720],
      });
      supported = ok === true;
    } catch {
      supported = false;
    }
    return supported;
  })();
  return probe;
}

/**
 * How to re-encode a video for a target, or null when it should go as it is (it already fits, or
 * is already smaller than the target would make it).
 */
export function planCompression(meta: VideoMeta, target: CompressTarget): CompressPlan | null {
  const { durationSec, width, height } = meta;
  if (!(durationSec > 0) || !(width > 0) || !(height > 0)) return null;
  const shortSide = Math.min(width, height);
  const sourceVideoBitrate = Math.max(0, meta.bitrate - AUDIO_BITRATE);
  const estimate = (videoBitrate: number) => (durationSec * (videoBitrate + AUDIO_BITRATE)) / 8;

  if (target.kind === 'fixed') {
    const videoBitrate = FIXED_BITRATE[target.height];
    const fitsAlready =
      shortSide <= target.height &&
      (sourceVideoBitrate === 0 || sourceVideoBitrate <= videoBitrate * 1.25);
    if (fitsAlready) return null;
    const bitrate = Math.round(
      sourceVideoBitrate > 0 ? Math.min(videoBitrate, sourceVideoBitrate) : videoBitrate
    );
    return {
      height: Math.min(target.height, shortSide),
      videoBitrate: bitrate,
      estimatedBytes: estimate(bitrate),
    };
  }

  if ((meta.bitrate * durationSec) / 8 <= target.maxBytes) return null;
  const available = (target.maxBytes * 8 * BUDGET_SHARE) / durationSec - AUDIO_BITRATE;
  const smallest = TIERS[TIERS.length - 1];
  const tier =
    TIERS.find((candidate) => candidate.height <= shortSide && available >= candidate.min) ??
    (available >= smallest.min ? undefined : smallest);
  // Fewer pixels than even the smallest step has: keep them all and spend what is available on them.
  const stepHeight = tier?.height ?? shortSide;
  const cap = tier?.cap ?? smallest.cap;
  let videoBitrate = Math.max(MIN_VIDEO_BITRATE, Math.min(available, cap));
  if (sourceVideoBitrate > 0) videoBitrate = Math.min(videoBitrate, sourceVideoBitrate);
  videoBitrate = Math.round(videoBitrate);
  return {
    height: Math.min(stepHeight, shortSide),
    videoBitrate,
    estimatedBytes: estimate(videoBitrate),
  };
}

/** Rough size the video will have after being encoded for `target`; the original size when it is sent as it is. */
export function estimateCompressedSize(
  meta: VideoMeta,
  target: CompressTarget,
  originalSize: number
): number {
  const plan = planCompression(meta, target);
  return plan ? Math.min(plan.estimatedBytes, originalSize) : originalSize;
}

/** Reads the length and picture size of a video file from its metadata. Null if it can't be read. */
export function readVideoMeta(file: File): Promise<VideoMeta | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (value: VideoMeta | null) => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      const { duration, videoWidth, videoHeight } = video;
      done(
        Number.isFinite(duration) && duration > 0 && videoWidth > 0 && videoHeight > 0
          ? {
              durationSec: duration,
              width: videoWidth,
              height: videoHeight,
              bitrate: (file.size * 8) / duration,
            }
          : null
      );
    };
    video.onerror = () => done(null);
    video.src = url;
  });
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError');
}

/**
 * Re-encodes a video to H.264 (hardware encoder where available) as an MP4 with the moov atom first,
 * so it can start playing before it has fully downloaded. How far it is shrunk comes from the target
 * and the video's own length and bitrate (`planCompression`). Audio is copied when the container
 * allows it, otherwise re-encoded. Resolves with the original file when re-encoding would not make it
 * at least ~15% smaller. Rejects with an AbortError DOMException when `signal` aborts.
 */
export async function compressVideo(
  file: File,
  opts: {
    target: CompressTarget;
    onProgress: (fraction: number) => void;
    signal: AbortSignal;
  }
): Promise<File> {
  const { target, onProgress, signal } = opts;
  if (signal.aborted) throw abortError();

  // Loaded on demand so it stays out of the main bundle.
  const {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    ConversionCanceledError,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
  } = await import('mediabunny');
  if (signal.aborted) throw abortError();

  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('No video track');
    // Display size already has the rotation metadata applied.
    const displayW = await track.getDisplayWidth();
    const displayH = await track.getDisplayHeight();
    const durationSec = await input.computeDuration();
    const stats = await track.computePacketStats(200);
    const plan = planCompression(
      {
        durationSec,
        width: displayW,
        height: displayH,
        bitrate: durationSec > 0 ? (file.size * 8) / durationSec : 0,
      },
      target
    );
    if (!plan) return file;

    // The short side is what "720p" means, so a portrait video keeps its 9:16 shape.
    const shortSide = Math.min(displayW, displayH);
    const resize = shortSide > plan.height;
    const fastEnough = stats.averagePacketRate <= MAX_FRAME_RATE + 0.5;
    const scale = resize ? plan.height / shortSide : 1;
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      video: {
        ...(resize ? { width: even(displayW * scale), height: even(displayH * scale) } : {}),
        fit: 'contain',
        codec: 'avc',
        quality: new Quality({ bitrate: plan.videoBitrate }),
        ...(fastEnough ? {} : { frameRate: MAX_FRAME_RATE }),
        keyFrameInterval: 2,
        forceTranscode: true,
      },
      showWarnings: false,
    });
    if (!conversion.isValid) throw new Error('Video cannot be converted on this device');
    // Better to fall back to the original than to silently send the video without its sound.
    if (conversion.discardedTracks.some((d) => d.track.isAudioTrack())) {
      throw new Error('Audio cannot be converted on this device');
    }

    conversion.onProgress = (p) => onProgress(Math.min(1, Math.max(0, p)));
    const onAbort = () => void conversion.cancel();
    signal.addEventListener('abort', onAbort);
    try {
      await conversion.execute();
    } catch (err) {
      if (signal.aborted || err instanceof ConversionCanceledError) throw abortError();
      throw err;
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
    if (signal.aborted) throw abortError();

    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength > file.size * (1 - MIN_SAVING)) return file;
    const dot = file.name.lastIndexOf('.');
    const base = dot > 0 ? file.name.slice(0, dot) : file.name;
    return new File([buffer], `${base}.mp4`, { type: 'video/mp4', lastModified: Date.now() });
  } finally {
    input.dispose();
  }
}
