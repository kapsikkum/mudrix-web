import type { MatrixClient, Room } from 'matrix-js-sdk';
import type { RawStateContent, UntypedStateEventType } from '@/types/matrix';
import {
  ROOM_PACK_TYPES,
  getStateEventsForType,
} from '@/app/features/settings/emojis/imagePackTypes';
import { getImageDimensions } from '@/app/features/timeline/encryptedMedia';
import { probeIsAnimated } from '@/app/features/timeline/utils/imageAnimation';
import { packDebug, packTimer } from '@/util/packDebug';
import type { ImageEntry, PackData } from './PackEditor';

/**
 * Matrix caps a whole event (content plus envelope: ids, hashes, signatures, auth/prev events) at
 * 65,536 bytes of canonical JSON. A pack is one state event, so the pack content must leave room
 * for the envelope. 60 KiB of content leaves ~5 KiB, which is comfortably more than Synapse's
 * envelope for a state event in a busy room.
 */
export const EVENT_CAP_BYTES = 65536;
export const PACK_BUDGET_BYTES = 60 * 1024;
/** Show a warning from this fraction of the budget. */
export const PACK_WARN_RATIO = 0.8;

const encoder = new TextEncoder();

export function utf8Size(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

export function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

/**
 * Serialises one image for the event. Fields equal to what a reader would infer are left out:
 * an empty `usage`, and a `usage` identical to the pack's (MSC2545: absent means "inherit").
 */
export function buildImageContent(
  shortcode: string,
  img: ImageEntry,
  packUsage: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { url: img.url };
  if (img.usage && img.usage.length > 0 && !sameSet(img.usage, packUsage)) out.usage = img.usage;
  out.body = img.body ?? shortcode;
  if (img.mimetype) out.mimetype = img.mimetype;
  if (img.info && Object.keys(img.info).length > 0) out.info = img.info;
  return out;
}

export function buildPackContent(pack: PackData): RawStateContent {
  const images: Record<string, Record<string, unknown>> = {};
  for (const [key, img] of Object.entries(pack.images)) {
    images[key] = buildImageContent(key, img, pack.usage);
  }
  return {
    pack: {
      display_name: pack.displayName,
      usage: pack.usage,
      avatar_url: pack.avatarUrl,
      attribution: pack.attribution || undefined,
    },
    images,
  } as unknown as RawStateContent;
}

export function packContentSize(pack: PackData): number {
  const done = packTimer('size estimate');
  const size = utf8Size(buildPackContent(pack));
  done({ images: Object.keys(pack.images).length, bytes: size });
  return size;
}

/** Bytes one new image will add, assuming an mxc URI of a typical length for this server. */
export function estimateEntryBytes(
  shortcode: string,
  packUsage: readonly string[],
  homeserverDomain: string,
  withInfo = true
): number {
  const entry = buildImageContent(
    shortcode,
    {
      shortcode,
      url: `mxc://${homeserverDomain}/${'x'.repeat(24)}`,
      usage: [],
      mimetype: 'image/png',
      info: withInfo ? { w: 1024, h: 1024, mimetype: 'image/png' } : undefined,
    },
    packUsage
  );
  // key + ":" + value + ","
  return utf8Size(shortcode) + 1 + utf8Size(entry) + 1;
}

/** Splits an image map into chunks whose pack events each fit within `budget` bytes. */
export function splitImagesBySize(
  pack: PackData,
  budget: number = PACK_BUDGET_BYTES
): Record<string, ImageEntry>[] {
  const headerBytes = utf8Size(buildPackContent({ ...pack, images: {} })) + 32;
  const chunks: Record<string, ImageEntry>[] = [];
  let current: Record<string, ImageEntry> = {};
  let used = headerBytes;
  for (const [key, img] of Object.entries(pack.images)) {
    const bytes = utf8Size(key) + 1 + utf8Size(buildImageContent(key, img, pack.usage)) + 1;
    if (used + bytes > budget && Object.keys(current).length > 0) {
      chunks.push(current);
      current = {};
      used = headerBytes;
    }
    current[key] = img;
    used += bytes;
  }
  if (Object.keys(current).length > 0 || chunks.length === 0) chunks.push(current);
  return chunks;
}

export function numberedPackName(name: string, index: number, total: number): string {
  return total > 1 ? `${name} (${index + 1})` : name;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function sameContent(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

type ErrorLike = {
  httpStatus?: number;
  errcode?: string;
  data?: { retry_after_ms?: number };
  getRetryAfterMs?: () => number | null;
  message?: string;
};

function isRateLimited(err: unknown): err is ErrorLike {
  const e = err as ErrorLike | null;
  return !!e && (e.httpStatus === 429 || e.errcode === 'M_LIMIT_EXCEEDED');
}

function retryAfterMs(err: ErrorLike, attempt: number): number {
  let ms: number | null = null;
  try {
    ms = err.getRetryAfterMs?.() ?? err.data?.retry_after_ms ?? null;
  } catch {
    ms = null;
  }
  const fallback = 1000 * 2 ** attempt;
  return Math.min(Math.max(ms ?? fallback, 250), 30_000);
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Retries on 429 honouring the server's Retry-After (capped), up to `attempts` tries. */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  signal?: AbortSignal,
  attempts = 4
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimited(err) || attempt >= attempts - 1 || signal?.aborted) throw err;
      const wait = retryAfterMs(err, attempt);
      packDebug('429, retrying', { attempt, wait });

      await abortableSleep(wait, signal);
    }
  }
}

export function isTooLargeError(err: unknown): boolean {
  const e = err as ErrorLike | null;
  return !!e && (e.errcode === 'M_TOO_LARGE' || e.httpStatus === 413);
}

function currentPackContent(room: Room | null, type: string, stateKey: string): unknown {
  if (!room) return undefined;
  return getStateEventsForType(room, type)
    .find((ev) => ev.getStateKey() === stateKey)
    ?.getContent();
}

/**
 * Sends the pack to both the unstable and the stable event type, skipping any type whose current
 * room state already has identical content (incremental save: a no-op edit sends nothing).
 * Returns the number of events actually sent.
 */
export async function sendPackStateEvents(
  client: MatrixClient,
  roomId: string,
  stateKey: string,
  content: RawStateContent,
  signal?: AbortSignal
): Promise<number> {
  const room = client.getRoom(roomId);
  const done = packTimer(`save ${stateKey}`);
  const toSend = ROOM_PACK_TYPES.filter(
    (type) => !sameContent(currentPackContent(room, type, stateKey), content)
  );
  await Promise.all(
    toSend.map((type) =>
      withRateLimitRetry(
        () => client.sendStateEvent(roomId, type as UntypedStateEventType, content, stateKey),
        signal
      )
    )
  );
  done({ sent: toSend.length, bytes: utf8Size(content) });
  return toSend.length;
}

export interface UploadedImage {
  mxc: string;
  mimetype: string;
  info: Record<string, unknown>;
}

export const fileResumeKey = (f: File): string => `${f.name}:${f.size}:${f.lastModified}`;

export interface PooledUploadResult {
  /** Same order as the input files; null where the upload failed or was cancelled. */
  uploaded: (UploadedImage | null)[];
  /** Failure message per input index. */
  errors: Map<number, string>;
  cancelled: boolean;
}

async function uploadOne(
  client: MatrixClient,
  file: File,
  signal?: AbortSignal
): Promise<UploadedImage> {
  const mimetype = file.type || 'image/png';
  const [res, dims, isAnimated] = await Promise.all([
    withRateLimitRetry(() => {
      const p = client.uploadContent(file, { name: file.name, type: mimetype });
      const onAbort = () => client.cancelUpload(p);
      signal?.addEventListener('abort', onAbort, { once: true });
      return p.finally(() => signal?.removeEventListener('abort', onAbort));
    }, signal),
    getImageDimensions(file),
    probeIsAnimated(mimetype, file),
  ]);
  return {
    mxc: res.content_uri,
    mimetype,
    info: {
      ...(dims ? { w: dims.w, h: dims.h } : {}),
      mimetype,
      ...(isAnimated !== undefined ? { is_animated: isAnimated } : {}),
    },
  };
}

/**
 * Uploads files with bounded concurrency. `done` maps resumeKey -> result of a previous attempt;
 * those files are not uploaded again, which is what makes retry / resume cheap.
 */
export async function uploadFilesPooled(
  client: MatrixClient,
  files: File[],
  opts: {
    concurrency?: number;
    signal?: AbortSignal;
    done?: Map<string, UploadedImage>;
    onProgress?: (completed: number, total: number, failed: number) => void;
  } = {}
): Promise<PooledUploadResult> {
  const { concurrency = 4, signal, done = new Map<string, UploadedImage>(), onProgress } = opts;
  const timer = packTimer(`upload ${files.length} files`);
  const uploaded: (UploadedImage | null)[] = new Array(files.length).fill(null);
  const errors = new Map<number, string>();
  let completed = 0;
  let next = 0;

  files.forEach((file, i) => {
    const hit = done.get(fileResumeKey(file));
    if (hit) {
      uploaded[i] = hit;
      completed += 1;
    }
  });
  onProgress?.(completed, files.length, 0);

  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const i = next;
      next += 1;
      if (i >= files.length) return;
      if (uploaded[i]) continue;
      try {
        const res = await uploadOne(client, files[i], signal);
        uploaded[i] = res;
        done.set(fileResumeKey(files[i]), res);
      } catch (err) {
        if (signal?.aborted) return;
        errors.set(i, err instanceof Error ? err.message : String(err));
      }
      completed += 1;
      onProgress?.(completed, files.length, errors.size);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  timer({ failed: errors.size, cancelled: !!signal?.aborted });
  return { uploaded, errors, cancelled: !!signal?.aborted };
}

/** Shortcode derived from a file name (letters, digits, - and _ only). */
export function shortcodeFromFile(fileName: string, fallback = 'image'): string {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || fallback
  );
}
