/** Hardened fetching shared by repository and icon downloads. Never throws. */

export type FetchResult =
  | { ok: true; bytes: Uint8Array; contentType: string }
  | { ok: false; error: string };

export const FETCH_TIMEOUT_MS = 10_000;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * No cookies, no referrer, no redirects (a redirect could point somewhere the user never
 * approved), a hard timeout and a size cap enforced while streaming.
 */
export async function fetchLimited(
  url: string,
  maxBytes: number,
  accept?: string
): Promise<FetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: accept ? { Accept: accept } : undefined,
    });
    if (!res.ok) return { ok: false, error: `${hostOf(url)} answered ${res.status}` };
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes)
      return { ok: false, error: 'file is too large' };
    const contentType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!res.body) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > maxBytes) return { ok: false, error: 'file is too large' };
      return { ok: true, bytes: buf, contentType };
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
        return { ok: false, error: 'file is too large' };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((c) => {
      bytes.set(c, offset);
      offset += c.length;
    });
    return { ok: true, bytes, contentType };
  } catch {
    if (ctrl.signal.aborted) return { ok: false, error: 'timed out' };
    return { ok: false, error: `could not load ${hostOf(url) || 'file'}` };
  } finally {
    clearTimeout(timer);
  }
}
