import { onCaptureEnded } from '@/util/desktop';

/**
 * Receives native screen-capture data in the top document (the only place WebView2 delivers shared
 * buffers). Native posts each buffer once per capture (3 video slots and 1 audio slot) and then
 * announces every video frame with a `mudrix-capture-frame` message; the pixels stay in the shared
 * buffer until `consumeVideoFrame` has copied them and handed the slot back.
 */

const HEADER_BYTES = 64;
const FORMAT_BGRA = 1;
/** How long buffers of a finished capture are kept when no `mudrix-capture-ended` message comes. */
const RELEASE_FALLBACK_MS = 1500;
const MAX_REMEMBERED_ENDED = 32;

interface SharedBufferEvent extends Event {
  getBuffer(): ArrayBuffer;
  additionalData?: unknown;
}

interface WebViewBridge {
  addEventListener(type: 'sharedbufferreceived', listener: (e: SharedBufferEvent) => void): void;
  addEventListener(type: 'message', listener: (e: MessageEvent) => void): void;
  releaseBuffer(buffer: ArrayBuffer): void;
}

function getWebView(): WebViewBridge | null {
  const webview = (window as { chrome?: { webview?: WebViewBridge } }).chrome?.webview;
  return webview && typeof webview.addEventListener === 'function' ? webview : null;
}

export interface RawVideoFrame {
  width: number;
  height: number;
  stride: number;
  timestampUs: number;
  seq: number;
  /** A view into the shared buffer; only valid inside the `consumeVideoFrame` callback. */
  pixels: Uint8Array;
}

export interface RawAudioChunk {
  sampleRate: number;
  channels: number;
  frames: number;
  /** Interleaved float32, copied out of the ring. */
  data: Float32Array<ArrayBuffer>;
}

export class CaptureStream {
  readonly videoSlots: Array<ArrayBuffer | undefined> = [];

  audioBuffer: ArrayBuffer | undefined;

  /** A video slot holds a new frame. */
  onFrame: ((slot: number) => void) | null = null;

  /** The capture is over (stopped, source closed or failed). Fires once. */
  onEnded: ((reason: string) => void) | null = null;

  ended = false;

  private readonly buffers: ArrayBuffer[] = [];

  private released = false;

  private audioReadPos: number | null = null;

  constructor(readonly captureId: string) {}

  addBuffer(buffer: ArrayBuffer, kind: string, slot: number): void {
    this.buffers.push(buffer);
    if (kind === 'audio') this.audioBuffer = buffer;
    else if (kind === 'video' && Number.isInteger(slot) && slot >= 0) {
      this.videoSlots[slot] = buffer;
    }
  }

  /** Slots that already hold a frame, oldest first. Used when a consumer attaches late. */
  pendingSlots(): number[] {
    const pending: Array<{ slot: number; seq: number }> = [];
    this.videoSlots.forEach((buf, slot) => {
      if (!buf) return;
      const header = new Uint32Array(buf, 0, 8);
      if (Atomics.load(header, 0) === 1) pending.push({ slot, seq: header[6] });
    });
    return pending.sort((a, b) => a.seq - b.seq).map((p) => p.slot);
  }

  /**
   * Reads the frame in `slot` (if it is ready) through `make`, which must copy what it needs
   * synchronously, then hands the slot back to native. Returns undefined when nothing was ready.
   */
  consumeVideoFrame<T>(slot: number, make: (frame: RawVideoFrame) => T): T | undefined {
    const buf = this.videoSlots[slot];
    if (!buf || this.released) return undefined;
    const header = new Uint32Array(buf, 0, 8);
    if (Atomics.load(header, 0) !== 1) return undefined;
    try {
      const width = header[1];
      const height = header[2];
      const stride = header[3];
      const valid =
        header[7] === FORMAT_BGRA &&
        width > 0 &&
        height > 0 &&
        stride >= width * 4 &&
        HEADER_BYTES + stride * height <= buf.byteLength;
      if (!valid) return undefined;
      return make({
        width,
        height,
        stride,
        timestampUs: header[4] + header[5] * 4294967296,
        seq: header[6],
        pixels: new Uint8Array(buf, HEADER_BYTES, stride * height),
      });
    } finally {
      Atomics.store(header, 0, 0);
    }
  }

  /** New audio since the last call, or null. Skips ahead when the reader fell behind the ring. */
  readAudio(): RawAudioChunk | null {
    const buf = this.audioBuffer;
    if (!buf || this.released) return null;
    const header = new Uint32Array(buf, 0, 4);
    const written = Atomics.load(header, 0);
    const sampleRate = header[1];
    const channels = header[2];
    const capacity = header[3];
    if (!sampleRate || !channels || !capacity) return null;
    if (HEADER_BYTES + capacity * channels * 4 > buf.byteLength) return null;

    if (this.audioReadPos === null) this.audioReadPos = written;
    let available = (written - this.audioReadPos) >>> 0;
    if (available === 0) return null;
    if (available > capacity) {
      // Overrun: native wrapped past the reader. Resume from half a ring back.
      this.audioReadPos = (written - (capacity >>> 1)) >>> 0;
      available = capacity >>> 1;
    }

    const ring = new Float32Array(buf, HEADER_BYTES, capacity * channels);
    const data = new Float32Array(available * channels);
    const start = this.audioReadPos % capacity;
    const firstRun = Math.min(available, capacity - start);
    data.set(ring.subarray(start * channels, (start + firstRun) * channels), 0);
    if (firstRun < available) {
      data.set(ring.subarray(0, (available - firstRun) * channels), firstRun * channels);
    }
    this.audioReadPos = (this.audioReadPos + available) >>> 0;
    return { sampleRate, channels, frames: available, data };
  }

  /** Marks the capture over and tells the consumer once. Buffers are released separately. */
  finish(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    const cb = this.onEnded;
    this.onFrame = null;
    this.onEnded = null;
    cb?.(reason);
  }

  releaseBuffers(): void {
    if (this.released) return;
    this.released = true;
    const webview = getWebView();
    this.buffers.forEach((buf) => {
      try {
        webview?.releaseBuffer(buf);
      } catch {
        // Already released by the host.
      }
    });
    this.buffers.length = 0;
  }
}

const streams = new Map<string, CaptureStream>();
const recentlyEnded = new Set<string>();
let installed = false;

function rememberEnded(captureId: string): void {
  recentlyEnded.add(captureId);
  if (recentlyEnded.size > MAX_REMEMBERED_ENDED) {
    const oldest = recentlyEnded.values().next().value;
    if (oldest !== undefined) recentlyEnded.delete(oldest);
  }
}

function getOrCreate(captureId: string): CaptureStream {
  let stream = streams.get(captureId);
  if (!stream) {
    stream = new CaptureStream(captureId);
    if (recentlyEnded.has(captureId)) stream.ended = true;
    streams.set(captureId, stream);
  }
  return stream;
}

function endCapture(captureId: string, reason: string, releaseNow: boolean): void {
  const stream = streams.get(captureId);
  rememberEnded(captureId);
  if (!stream) return;
  stream.finish(reason);
  if (releaseNow) {
    stream.releaseBuffers();
    streams.delete(captureId);
  } else {
    // The host message normally follows the `capture-ended` event; release without it if it never does.
    setTimeout(() => {
      stream.releaseBuffers();
      if (streams.get(captureId) === stream) streams.delete(captureId);
    }, RELEASE_FALLBACK_MS);
  }
}

function readMeta(data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

/**
 * Starts listening for native capture data. Safe to call repeatedly; must run before
 * `capture_start` so no shared buffer is missed. Returns false outside WebView2.
 */
export function installCaptureReceiver(): boolean {
  if (installed) return true;
  const webview = getWebView();
  if (!webview) return false;
  installed = true;

  webview.addEventListener('sharedbufferreceived', (e) => {
    const meta = readMeta(e.additionalData);
    if (!meta || meta.type !== 'mudrix-capture-buffer' || typeof meta.captureId !== 'string') {
      return;
    }
    const stream = getOrCreate(meta.captureId);
    const buffer = e.getBuffer();
    if (stream.ended) {
      // The capture is already over (or its buffers were released): hand the buffer straight back.
      try {
        getWebView()?.releaseBuffer(buffer);
      } catch {
        // ignore
      }
      return;
    }
    stream.addBuffer(buffer, String(meta.kind), Number(meta.slot));
  });

  webview.addEventListener('message', (e) => {
    const msg = readMeta(e.data);
    if (!msg || typeof msg.captureId !== 'string') return;
    if (msg.type === 'mudrix-capture-frame') {
      const stream = streams.get(msg.captureId);
      if (stream && !stream.ended) stream.onFrame?.(Number(msg.slot));
    } else if (msg.type === 'mudrix-capture-ended') {
      endCapture(msg.captureId, 'ended', true);
    }
  });

  onCaptureEnded((event) => endCapture(event.captureId, event.reason, false));
  return true;
}

/** The stream for a capture id; buffers may already be in it if native posted them early. */
export function attachCaptureStream(captureId: string): CaptureStream {
  return getOrCreate(captureId);
}

/** Ends the capture on this side and releases its buffers (after `capture_stop` returned). */
export function closeCaptureStream(captureId: string, reason = 'stopped'): void {
  endCapture(captureId, reason, false);
}
