import type { MatrixClient } from 'matrix-js-sdk';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { getSafeMimeType } from '@/util/safeMimeType';

export interface DownloadProgress {
  loaded: number;
  /** 0 when neither the response nor the caller knows the size. */
  total: number;
}

export interface StreamOptions {
  onProgress?: (progress: DownloadProgress) => void;
  /** Abort when no bytes have arrived for this long, instead of capping the whole download. */
  stallTimeoutMs?: number;
  /** Size to report progress against when the response carries no content-length. */
  expectedSize?: number;
}

export class DownloadStalledError extends Error {
  constructor() {
    super('Download stalled: no data received');
    this.name = 'DownloadStalledError';
  }
}

/**
 * Downloads a URL as a stream, reporting progress and aborting only when the connection goes quiet.
 * Chunks are collected and joined once, so the body is held at most twice rather than re-copied.
 */
export async function fetchStreamed(
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal | undefined,
  { onProgress, stallTimeoutMs, expectedSize }: StreamOptions = {}
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> {
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', relayAbort, { once: true });

  let stalled = false;
  let timer: number | undefined;
  const armStallTimer = () => {
    if (!stallTimeoutMs) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      stalled = true;
      controller.abort();
    }, stallTimeoutMs);
  };

  try {
    armStallTimer();
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type') ?? '';
    const headerLength = Number(response.headers.get('content-length'));
    const total = headerLength > 0 ? headerLength : (expectedSize ?? 0);

    const reader = response.body?.getReader();
    if (!reader) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      onProgress?.({ loaded: bytes.length, total: bytes.length });
      return { bytes, contentType };
    }

    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      armStallTimer();
      onProgress?.({ loaded, total });
    }

    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return { bytes, contentType };
  } catch (err) {
    if (stalled) throw new DownloadStalledError();
    throw err;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', relayAbort);
  }
}

/** Streams an unencrypted mxc:// download (authenticated media) into a blob with a safe MIME type. */
export async function downloadMxcMedia(
  client: MatrixClient,
  mxcUrl: string,
  mimeType: string | undefined,
  signal: AbortSignal | undefined,
  options: StreamOptions
): Promise<Blob> {
  // Event-supplied URLs must be mxc://: anything else would make this client fetch a sender-chosen URL.
  if (!mxcUrl.startsWith('mxc://')) throw new Error('Not an mxc URL');
  const httpUrl = mxcUrlToHttp(client, mxcUrl, undefined, undefined, undefined, false, true, true);
  if (!httpUrl) throw new Error(`Cannot resolve mxc URL: ${mxcUrl}`);

  const token = client.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const { bytes, contentType } = await fetchStreamed(httpUrl, headers, signal, options);
  // Never trust the uploaded content type; fall back to the event's own when the server's is not renderable.
  const served = getSafeMimeType(contentType);
  const type = served !== 'application/octet-stream' ? served : getSafeMimeType(mimeType ?? '');
  return new Blob([bytes], { type });
}
