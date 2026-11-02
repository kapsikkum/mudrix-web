/** Hardened fetching shared by repository and icon downloads. Never throws. */

import { hostOf } from './widget';

export type FetchResult =
  /** `etag` is only set for a well-formed entity tag the host let us read. */
  | { ok: true; bytes: Uint8Array; contentType: string; etag?: string }
  /**
   * `status` is set when the host answered with an HTTP error (or 304 Not Modified for a
   * conditional request). `network` is set when no answer arrived at all.
   */
  | { ok: false; error: string; status?: number; network?: true };

export const FETCH_TIMEOUT_MS = 10_000;
/** The `error` of a result whose body exceeded the cap. */
export const ERR_TOO_LARGE = 'file is too large';

export interface RequestOptions {
  accept?: string;
  /** POST with this JSON text as the body. Content-Type is the only header ever set. */
  jsonBody?: string | null;
  /** Makes the request a POST even without a body. */
  post?: boolean;
  /** A conditional GET: sends If-None-Match with this entity tag (only if it is well formed). */
  ifNoneMatch?: string;
}

/** A strong or weak entity tag as RFC 9110 allows it, kept short. */
const ETAG = /^(W\/)?"[\x21\x23-\x7e]{0,190}"$/;

export function validEtag(v: string | null | undefined): string | undefined {
  return typeof v === 'string' && ETAG.test(v) ? v : undefined;
}

/**
 * No cookies, no referrer, no redirects (a redirect could point somewhere the user never
 * approved), a hard timeout and a size cap enforced while streaming.
 */
export function fetchLimited(url: string, maxBytes: number, accept?: string): Promise<FetchResult> {
  return fetchHardened(url, maxBytes, { accept });
}

/** Same guarantees as `fetchLimited`, optionally as a POST (used by integration API actions). */
export async function fetchHardened(
  url: string,
  maxBytes: number,
  opts: RequestOptions = {}
): Promise<FetchResult> {
  const post = opts.post === true || typeof opts.jsonBody === 'string';
  const headers: Record<string, string> = {};
  if (opts.accept) headers.Accept = opts.accept;
  if (typeof opts.jsonBody === 'string') headers['Content-Type'] = 'application/json';
  const ifNoneMatch = post ? undefined : validEtag(opts.ifNoneMatch);
  if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: post ? 'POST' : 'GET',
      body: typeof opts.jsonBody === 'string' ? opts.jsonBody : undefined,
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    if (!res.ok)
      return {
        ok: false,
        error: `${hostOf(url, { hostnameOnly: true })} answered ${res.status}`,
        status: res.status,
      };
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes)
      return { ok: false, error: ERR_TOO_LARGE };
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    const etag = validEtag(res.headers.get('etag'));
    const done = (bytes: Uint8Array): FetchResult =>
      etag ? { ok: true, bytes, contentType, etag } : { ok: true, bytes, contentType };
    if (!res.body) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > maxBytes) return { ok: false, error: ERR_TOO_LARGE };
      return done(buf);
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, error: ERR_TOO_LARGE };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((c) => {
      bytes.set(c, offset);
      offset += c.length;
    });
    return done(bytes);
  } catch {
    if (ctrl.signal.aborted) return { ok: false, error: 'timed out' };
    return {
      ok: false,
      error: `could not ${post ? 'reach' : 'load'} ${hostOf(url, { hostnameOnly: true }) || 'file'}`,
      network: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
