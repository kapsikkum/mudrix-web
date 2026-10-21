import type { MatrixClient } from 'matrix-js-sdk';
import { getCachedBlobUrl, setCachedBlobUrl } from '@/app/features/timeline/message/mediaCache';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { packDebug } from '@/util/packDebug';
import { readCachedThumb, writeCachedThumb } from './thumbCache';

function isMxcUrl(url: string): boolean {
  return url.startsWith('mxc://');
}

export interface MediaFetchOptions {
  /** Abort the request (or drop it from the queue) when the caller no longer needs it. */
  signal?: AbortSignal;
  /** Run a full-size download through the bounded queue as well (thumbnails always are). */
  queue?: boolean;
}

/** Bounded-concurrency lane with cancellation of not-yet-started jobs. */
class Lane {
  private active = 0;

  private readonly pending: Array<() => void> = [];

  constructor(
    private readonly name: string,
    private readonly limit: number
  ) {}

  run<T>(signal: AbortSignal, job: () => Promise<T>, onAborted: T): Promise<T> {
    return new Promise<T>((resolve) => {
      const start = () => {
        this.active += 1;
        packDebug(`${this.name} start`, { active: this.active, queued: this.pending.length });
        job()
          .then(resolve, () => resolve(onAborted))
          .finally(() => {
            this.active -= 1;
            this.next();
          });
      };
      const onAbort = () => {
        const idx = this.pending.indexOf(entry);
        if (idx >= 0) this.pending.splice(idx, 1);
        resolve(onAborted);
      };
      const entry = () => {
        signal.removeEventListener('abort', onAbort);
        start();
      };
      if (signal.aborted) {
        resolve(onAborted);
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
      this.pending.push(entry);
      this.next();
    });
  }

  private next(): void {
    while (this.active < this.limit && this.pending.length > 0) {
      const entry = this.pending.shift();
      entry?.();
    }
  }
}

const thumbLane = new Lane('thumb', 6);
const fullLane = new Lane('full', 3);

interface Inflight {
  promise: Promise<string | null>;
  waiters: number;
  controller: AbortController;
}

const inFlightFetches = new Map<string, Inflight>();

export function mediaBlobCacheKey(
  mxcUrl: string,
  width?: number,
  height?: number,
  resizeMethod?: string
): string {
  if (!width && !height) return `mxc:${mxcUrl}`;
  return `mxc:${mxcUrl}:${width ?? ''}x${height ?? ''}:${resizeMethod ?? 'scale'}`;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function retryDelayMs(res: Response | null, attempt: number): number {
  const header = res?.headers.get('retry-after');
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10_000);
  return 500 * (attempt + 1);
}

type FetchOutcome = { blob: Blob } | { blob: null; fallbackToFull: boolean };

async function downloadBlob(
  httpUrl: string,
  token: string | null,
  retries: number,
  signal: AbortSignal
): Promise<FetchOutcome> {
  for (let i = 0; i <= retries; i += 1) {
    if (signal.aborted) return { blob: null, fallbackToFull: false };
    let res: Response | null = null;
    try {
      res = await fetch(httpUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal,
      });
      if (res.ok) {
        return { blob: await res.blob() };
      }
      // Auth failures are not a property of the media (token not valid yet, e.g. right after
      // sign-in): do not fall back to the full-size download, let the caller retry later.
      if (res.status === 401 || res.status === 403) return { blob: null, fallbackToFull: false };
      const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
      if (!retryable) return { blob: null, fallbackToFull: true };
    } catch {
      if (signal.aborted) return { blob: null, fallbackToFull: false };
    }
    if (i < retries) {
      await sleep(retryDelayMs(res, i), signal);
    }
  }
  return { blob: null, fallbackToFull: true };
}

export async function fetchMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  retries = 2,
  width?: number,
  height?: number,
  resizeMethod?: string,
  options: MediaFetchOptions = {}
): Promise<string | null> {
  if (!isMxcUrl(mxcUrl)) return mxcUrl;

  const cacheKey = mediaBlobCacheKey(mxcUrl, width, height, resizeMethod);
  const cached = getCachedBlobUrl(cacheKey);
  if (cached) return cached;

  const isThumb = !!(width || height);
  if (isThumb) {
    const fullSize = getCachedBlobUrl(`mxc:${mxcUrl}`);
    if (fullSize) return fullSize;
  }

  const httpUrlRaw = mxcUrlToHttp(
    client,
    mxcUrl,
    width,
    height,
    resizeMethod ?? 'scale',
    false,
    true,
    true
  );
  if (!httpUrlRaw) return null;
  let httpUrl = httpUrlRaw;
  if (isThumb) {
    // MSC2705: ask for a still frame so a big APNG/GIF is not decoded for a tiny preview.
    try {
      const u = new URL(httpUrlRaw);
      if (!u.searchParams.has('animated')) u.searchParams.set('animated', 'false');
      httpUrl = u.href;
    } catch {
      httpUrl = httpUrlRaw;
    }
  }

  const { signal } = options;
  let entry = inFlightFetches.get(cacheKey);
  if (!entry || entry.controller.signal.aborted) {
    const controller = new AbortController();
    const lane = isThumb ? thumbLane : options.queue ? fullLane : null;
    const token = client.getAccessToken();

    const work = async (): Promise<string | null> => {
      if (controller.signal.aborted) return null;
      if (isThumb) {
        const persisted = await readCachedThumb(httpUrl);
        if (persisted) {
          const blobUrl = URL.createObjectURL(persisted);
          setCachedBlobUrl(cacheKey, blobUrl, persisted.type);
          return blobUrl;
        }
      }
      const outcome = await downloadBlob(httpUrl, token, retries, controller.signal);
      if (outcome.blob) {
        const blobUrl = URL.createObjectURL(outcome.blob);
        setCachedBlobUrl(cacheKey, blobUrl, outcome.blob.type);
        if (isThumb) void writeCachedThumb(httpUrl, outcome.blob);
        return blobUrl;
      }
      if (isThumb && outcome.fallbackToFull && !controller.signal.aborted) {
        // The server refused to thumbnail this media (e.g. SVG); use the original instead.
        return fetchMediaBlobUrl(mxcUrl, client, retries, undefined, undefined, undefined, {
          signal: controller.signal,
          queue: true,
        });
      }
      return null;
    };

    const promise = lane ? lane.run(controller.signal, work, null) : work();
    const created: Inflight = { promise, waiters: 0, controller };
    entry = created;
    inFlightFetches.set(cacheKey, created);
    const cleanup = () => {
      if (inFlightFetches.get(cacheKey) === created) inFlightFetches.delete(cacheKey);
    };
    promise.then(cleanup, cleanup);
  }

  const shared = entry;
  shared.waiters += 1;
  return new Promise<string | null>((resolve) => {
    let done = false;
    const onAbort = () => {
      if (done) return;
      done = true;
      shared.waiters -= 1;
      if (shared.waiters <= 0) {
        shared.controller.abort();
        if (inFlightFetches.get(cacheKey) === shared) inFlightFetches.delete(cacheKey);
      }
      resolve(null);
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    shared.promise.then(
      (v) => {
        if (done) return;
        done = true;
        signal?.removeEventListener('abort', onAbort);
        resolve(v);
      },
      () => {
        if (done) return;
        done = true;
        resolve(null);
      }
    );
  });
}
