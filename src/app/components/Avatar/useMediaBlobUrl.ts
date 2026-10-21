import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { fetchMediaBlobUrl, mediaBlobCacheKey } from './fetchMediaBlobUrl';
import { deleteCachedBlobUrl, getCachedBlobUrl } from '@/app/features/timeline/message/mediaCache';

const RETRY_DELAYS_MS = [1500, 4000, 10_000, 20_000, 30_000];

export interface MediaBlobOptions {
  width?: number;
  height?: number;
  resizeMethod?: string;
  /** When false nothing is fetched (and an in-flight fetch is cancelled). Default true. */
  enabled?: boolean;
  /** Route a full-size download through the bounded queue. */
  queue?: boolean;
}

export interface MediaBlobResult {
  src: string | undefined;
  refetch: () => void;
}

function resolveInitialSrc(
  mxcUrl: string | undefined | null,
  cacheKey: string | null
): string | undefined {
  if (!mxcUrl) return undefined;
  if (!mxcUrl.startsWith('mxc://')) return mxcUrl;
  return cacheKey ? (getCachedBlobUrl(cacheKey) ?? undefined) : undefined;
}

export function useMediaBlobUrl(
  client: MatrixClient | null | undefined,
  mxcUrl: string | undefined | null,
  options: MediaBlobOptions = {}
): MediaBlobResult {
  const { width, height, resizeMethod, enabled = true, queue } = options;
  const isMxc = !!mxcUrl && mxcUrl.startsWith('mxc://');
  const cacheKey = isMxc ? mediaBlobCacheKey(mxcUrl as string, width, height, resizeMethod) : null;

  const [state, setState] = useState<{ key: string | null; src: string | undefined }>(() => ({
    key: cacheKey,
    src: resolveInitialSrc(mxcUrl, cacheKey),
  }));
  const [nonce, setNonce] = useState(0);
  const attemptRef = useRef(0);
  const loadedRef = useRef(false);
  loadedRef.current = !!state.src;

  if (state.key !== cacheKey) {
    attemptRef.current = 0;
    setState({ key: cacheKey, src: resolveInitialSrc(mxcUrl, cacheKey) });
  }

  // A failed load (token or sync not ready right after sign-in, network blip, 5xx) is retried
  // when the browser comes back online or the first sync completes, not only on remount.
  useEffect(() => {
    if (!client || !isMxc || !enabled) return;
    const retryNow = () => {
      if (loadedRef.current) return;
      attemptRef.current = 0;
      setNonce((n) => n + 1);
    };
    const onSync = (syncState: string) => {
      if (syncState === 'PREPARED' || syncState === 'SYNCING') retryNow();
    };
    window.addEventListener('online', retryNow);
    if (!client.isInitialSyncComplete?.()) {
      client.on('sync' as Parameters<typeof client.on>[0], onSync as never);
    }
    return () => {
      window.removeEventListener('online', retryNow);
      client.off('sync' as Parameters<typeof client.off>[0], onSync as never);
    };
  }, [client, isMxc, enabled, cacheKey]);

  useEffect(() => {
    if (!mxcUrl || !client || !isMxc || !cacheKey || !enabled) return;
    const cachedNow = getCachedBlobUrl(cacheKey);
    if (cachedNow) {
      setState((prev) =>
        prev.key === cacheKey && !prev.src ? { key: prev.key, src: cachedNow } : prev
      );
      return;
    }

    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    fetchMediaBlobUrl(mxcUrl, client, 2, width, height, resizeMethod, {
      signal: controller.signal,
      queue,
    }).then((url) => {
      if (controller.signal.aborted) return;
      if (url) {
        attemptRef.current = 0;
        setState((prev) => (prev.key === cacheKey ? { key: prev.key, src: url } : prev));
        return;
      }
      const delay = RETRY_DELAYS_MS[attemptRef.current];
      if (delay === undefined) return;
      attemptRef.current += 1;
      retryTimer = setTimeout(() => setNonce((n) => n + 1), delay);
    });
    return () => {
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [mxcUrl, client, isMxc, cacheKey, width, height, resizeMethod, nonce, enabled, queue]);

  const refetch = useCallback(() => {
    if (cacheKey) deleteCachedBlobUrl(cacheKey);
    setNonce((n) => n + 1);
  }, [cacheKey]);

  return { src: state.src, refetch };
}
