import type { CaptureStream, RawVideoFrame } from './captureReceiver';

/**
 * Turns a `CaptureStream` into MediaStreamTracks.
 *
 * Realm: every object that ends up inside Element Call (the generators, the VideoFrames and
 * AudioData written to them, the MediaStream, the ended events) is created with the constructors
 * of the call iframe's window, not this document's. Element Call and LiveKit run `instanceof
 * MediaStreamTrack` / `MediaStream` checks against their own globals, which fail for objects of
 * another realm. Same-origin frames share one renderer, so a WebCodecs object made by one realm's
 * constructor is accepted by the other realm's WebRTC machinery either way; this keeps both the
 * type checks and the object lifetime (the iframe's) consistent.
 */

interface TrackGenerator<Chunk> extends MediaStreamTrack {
  readonly writable: WritableStream<Chunk>;
}

interface TrackGeneratorConstructor<Chunk> {
  new (init: { kind: 'video' | 'audio' }): TrackGenerator<Chunk>;
}

/** The pieces of an iframe window this module needs. */
export type CaptureRealm = Window &
  typeof globalThis & {
    MediaStreamTrackGenerator?: TrackGeneratorConstructor<VideoFrame | AudioData>;
  };

export interface NativeTrackInfo {
  width: number;
  height: number;
  fps: number;
  kind: 'screen' | 'window';
  cursor: boolean;
}

export interface NativeTracks {
  stream: MediaStream;
  video: MediaStreamTrack;
  audio: MediaStreamTrack | null;
  /** Stops pumping data and ends the tracks (firing `ended` on them), as a closed source does. */
  end: () => void;
}

const AUDIO_POLL_MS = 10;
/** A still screen sends no frames; repeat the last one so late joiners and encoders get fresh ones. */
const KEEPALIVE_MS = 500;
const MAX_PENDING_AUDIO_WRITES = 50;

export function isNativeTrackApiSupported(realm: CaptureRealm): boolean {
  return (
    typeof realm.MediaStreamTrackGenerator === 'function' &&
    typeof realm.VideoFrame === 'function' &&
    typeof realm.MediaStream === 'function'
  );
}

/**
 * LiveKit sizes the encodings from `track.getSettings()` and waits for width and height to show up
 * there, but generator tracks report neither. Report the source's size and rate instead.
 */
function patchSettings(track: MediaStreamTrack, extra: () => Record<string, unknown>): void {
  const original = track.getSettings.bind(track);
  Object.defineProperty(track, 'getSettings', {
    configurable: true,
    value: (): MediaTrackSettings => ({ ...original(), ...extra() }),
  });
  // A clone is a plain track fed by the same source; give it the same settings.
  const originalClone = track.clone.bind(track);
  Object.defineProperty(track, 'clone', {
    configurable: true,
    value: (): MediaStreamTrack => {
      const copy = originalClone();
      patchSettings(copy, extra);
      return copy;
    },
  });
}

export function createNativeTracks(
  realm: CaptureRealm,
  stream: CaptureStream,
  info: NativeTrackInfo,
  withAudio: boolean,
  onStop: () => void
): NativeTracks {
  const Generator = realm.MediaStreamTrackGenerator as TrackGeneratorConstructor<
    VideoFrame | AudioData
  >;

  let ended = false;
  const cleanups: Array<() => void> = [];

  // ---- video ---------------------------------------------------------------------------------
  const size = { width: info.width, height: info.height };
  const videoGen = new Generator({ kind: 'video' }) as TrackGenerator<VideoFrame>;
  const videoWriter = videoGen.writable.getWriter();
  patchSettings(videoGen, () => ({
    width: size.width,
    height: size.height,
    frameRate: info.fps,
    aspectRatio: size.width / size.height,
    displaySurface: info.kind === 'screen' ? 'monitor' : 'window',
    cursor: info.cursor ? 'always' : 'never',
  }));

  let lastFrame: VideoFrame | null = null;
  let lastWriteAt = performance.now();
  let lastTimestampUs = 0;

  const writeVideo = (frame: VideoFrame): void => {
    if (ended || (videoWriter.desiredSize !== null && videoWriter.desiredSize <= 0)) {
      frame.close();
      return;
    }
    lastWriteAt = performance.now();
    // The generator takes the frame on write; closing afterwards is a no-op then and frees it if not.
    videoWriter.write(frame).then(
      () => frame.close(),
      () => frame.close()
    );
  };

  const copyFrame = (raw: RawVideoFrame): VideoFrame =>
    new realm.VideoFrame(raw.pixels, {
      // BGRX: native capture leaves the alpha byte undefined.
      format: 'BGRX',
      codedWidth: raw.width,
      codedHeight: raw.height,
      timestamp: raw.timestampUs,
      layout: [{ offset: 0, stride: raw.stride }],
    });

  const pumpSlot = (slot: number): void => {
    if (ended) return;
    let frame: VideoFrame | undefined;
    try {
      frame = stream.consumeVideoFrame(slot, copyFrame);
    } catch (err) {
      console.warn('[capture] could not read frame', err);
      return;
    }
    if (!frame) return;
    size.width = frame.codedWidth;
    size.height = frame.codedHeight;
    lastTimestampUs = frame.timestamp;
    lastFrame?.close();
    lastFrame = frame.clone();
    writeVideo(frame);
  };

  stream.onFrame = pumpSlot;
  stream.pendingSlots().forEach(pumpSlot);

  const keepAlive = window.setInterval(() => {
    if (ended || !lastFrame) return;
    const idle = performance.now() - lastWriteAt;
    if (idle < KEEPALIVE_MS) return;
    try {
      lastTimestampUs += Math.round(idle * 1000);
      writeVideo(new realm.VideoFrame(lastFrame, { timestamp: lastTimestampUs }));
    } catch {
      // The frame was closed by a concurrent end().
    }
  }, KEEPALIVE_MS / 2);
  cleanups.push(() => window.clearInterval(keepAlive));

  // ---- audio ---------------------------------------------------------------------------------
  let audioGen: TrackGenerator<AudioData> | null = null;
  let stopAudioPump = (): void => {};
  if (withAudio && stream.audioBuffer && typeof realm.AudioData === 'function') {
    const gen = new Generator({ kind: 'audio' }) as TrackGenerator<AudioData>;
    audioGen = gen;
    const audioWriter = gen.writable.getWriter();
    let audioFormat = { sampleRate: 48000, channels: 2 };
    patchSettings(gen, () => ({
      channelCount: audioFormat.channels,
      sampleRate: audioFormat.sampleRate,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    }));

    let framesSent = 0;
    let pendingWrites = 0;
    const pollAudio = (): void => {
      if (ended) return;
      let chunk;
      try {
        chunk = stream.readAudio();
      } catch (err) {
        console.warn('[capture] could not read audio', err);
        return;
      }
      if (!chunk) return;
      audioFormat = { sampleRate: chunk.sampleRate, channels: chunk.channels };
      if (pendingWrites >= MAX_PENDING_AUDIO_WRITES) return;
      const data = new realm.AudioData({
        format: 'f32',
        sampleRate: chunk.sampleRate,
        numberOfFrames: chunk.frames,
        numberOfChannels: chunk.channels,
        timestamp: Math.round((framesSent / chunk.sampleRate) * 1e6),
        data: chunk.data,
      });
      framesSent += chunk.frames;
      pendingWrites += 1;
      const done = () => {
        pendingWrites -= 1;
        data.close();
      };
      audioWriter.write(data).then(done, done);
    };
    const audioTimer = window.setInterval(pollAudio, AUDIO_POLL_MS);
    stopAudioPump = () => window.clearInterval(audioTimer);
    cleanups.push(stopAudioPump);
  }

  // ---- lifetime ------------------------------------------------------------------------------
  const tracks: MediaStreamTrack[] = audioGen ? [videoGen, audioGen] : [videoGen];
  const mediaStream = new realm.MediaStream(tracks);
  const originalStops = new Map<MediaStreamTrack, () => void>();
  const stopped = new Set<MediaStreamTrack>();

  const finish = (notify: boolean): void => {
    if (ended) return;
    ended = true;
    cleanups.forEach((fn) => fn());
    stream.onFrame = null;
    lastFrame?.close();
    lastFrame = null;
    tracks.forEach((track) => {
      if (!stopped.has(track)) {
        stopped.add(track);
        originalStops.get(track)?.();
      }
      if (notify) track.dispatchEvent(new realm.Event('ended'));
    });
  };

  tracks.forEach((track) => {
    originalStops.set(track, track.stop.bind(track));
    // Element Call stops the tracks when the user ends the share; once none is left the capture stops.
    Object.defineProperty(track, 'stop', {
      configurable: true,
      value: () => {
        if (ended || stopped.has(track)) return;
        stopped.add(track);
        originalStops.get(track)?.();
        if (track === audioGen) stopAudioPump();
        if (tracks.every((t) => stopped.has(t))) {
          finish(false);
          onStop();
        }
      },
    });
  });

  return {
    stream: mediaStream,
    video: videoGen,
    audio: audioGen,
    end: () => finish(true),
  };
}
