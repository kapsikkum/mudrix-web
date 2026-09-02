import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import {
  getEncryptedFile,
  decryptMediaFile,
  getMediaThumbnail,
  type MediaThumbnail,
  type IEncryptedFile,
} from '../encryptedMedia';
import {
  getMediaCacheKey,
  getCachedMedia,
  setCachedMedia,
  getCachedBlobUrl,
  setCachedBlobUrl,
} from './mediaCache';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

const DOWNLOAD_TIMEOUT_MS = 30000;

type MediaTarget =
  | { kind: 'thumbnail'; file: IEncryptedFile & { url: string }; mimeType?: string }
  | { kind: 'full'; file: IEncryptedFile & { url: string }; mimeType?: string };

function getTargetCacheKey(target: MediaTarget): string {
  return getMediaCacheKey(target.file);
}

export function useDecryptedMedia(
  event: MatrixEvent,
  content: Record<string, unknown>,
  client: MatrixClient
): {
  mediaSrc: string | null;
  isDecrypting: boolean;
  hasFailed: boolean;
  setMediaSrc: (url: string) => void;
  requestFullRes: () => Promise<string | null>;
} {
  const { t } = useTranslation();
  const toast = useToast();
  const [mediaSrc, setMediaSrc_] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const eventId = event.getId();
  const failedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  // Bumped on reconnect so a temporarily failed media download re-runs.
  const reconnectTick = useRef(0);

  const setMediaSrc = useCallback((url: string | null) => {
    if (blobUrlRef.current && blobUrlRef.current !== url) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    blobUrlRef.current = url;
    setMediaSrc_(url);
  }, []);

  // Stable primitives derived from content (avoids effect re-run on object ref change)
  const msgtype = content?.msgtype as string | undefined;
  const eventType = event.getType();
  const isMedia =
    msgtype === 'm.image' ||
    msgtype === 'm.video' ||
    msgtype === 'm.file' ||
    msgtype === 'm.audio' ||
    eventType === 'm.sticker';
  const encryptedFile = isMedia ? getEncryptedFile(content) : null;
  const fullCacheKey = encryptedFile ? getMediaCacheKey(encryptedFile) : null;
  const fullMimeType =
    encryptedFile && content.info
      ? ((content.info as Record<string, unknown>)?.mimetype as string | undefined)
      : undefined;

  const thumbnail: MediaThumbnail | null =
    msgtype === 'm.image' ? getMediaThumbnail(content) : null;
  const target: MediaTarget | null = thumbnail
    ? {
        kind: 'thumbnail',
        file: thumbnail.file,
        mimeType: thumbnail.mimetype ?? fullMimeType,
      }
    : encryptedFile
      ? { kind: 'full', file: encryptedFile, mimeType: fullMimeType }
      : null;
  const targetCacheKey = target ? getTargetCacheKey(target) : null;

  useEffect(() => {
    if (!target || !targetCacheKey) return;
    if (mediaSrc) return;
    if (failedRef.current) return;

    const cachedUrl = getCachedBlobUrl(targetCacheKey);
    if (cachedUrl) {
      setMediaSrc(cachedUrl);
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    (async () => {
      const cached = await getCachedMedia(targetCacheKey);
      if (cancelled) return;

      if (cached) {
        const blobUrl = URL.createObjectURL(new Blob([cached.data], { type: cached.mimeType }));
        setCachedBlobUrl(targetCacheKey, blobUrl, cached.mimeType);
        setMediaSrc(blobUrl);
        return;
      }

      setIsDecrypting(true);
      setHasFailed(false);
      const downloadTimeout = window.setTimeout(() => abortController.abort(), DOWNLOAD_TIMEOUT_MS);

      try {
        const blob = await decryptMediaFile(
          client,
          target.file,
          target.mimeType,
          abortController.signal
        );
        if (cancelled) return;

        const buffer = await blob.arrayBuffer();
        await setCachedMedia(targetCacheKey, buffer, blob.type);

        if (cancelled) return;
        const blobUrl = URL.createObjectURL(new Blob([buffer], { type: blob.type }));
        setCachedBlobUrl(targetCacheKey, blobUrl, blob.type);
        setMediaSrc(blobUrl);
      } catch (err) {
        if (cancelled) return;
        failedRef.current = true;
        setHasFailed(true);
        toast.error(t('timeline.decryptFailed', { error: getErrorMessage(err) }));
      } finally {
        window.clearTimeout(downloadTimeout);
        if (!cancelled) setIsDecrypting(false);
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, client, targetCacheKey, mediaSrc, toast, t, reconnectTick.current]);

  useMatrixEvent(
    client,
    'sync',
    useCallback((state: string) => {
      if (state === 'SYNCING' || state === 'CATCHUP' || state === 'PREPARED') {
        if (failedRef.current) {
          failedRef.current = false;
          reconnectTick.current += 1;
          setHasFailed(false);
        }
      }
    }, [])
  );

  // Decrypt the full-resolution file on demand (lightbox / download).
  const requestFullRes = useCallback(async (): Promise<string | null> => {
    if (!encryptedFile || !fullCacheKey) return null;

    const cachedUrl = getCachedBlobUrl(fullCacheKey);
    if (cachedUrl) return cachedUrl;

    try {
      const cached = await getCachedMedia(fullCacheKey);
      if (cached) {
        const blobUrl = URL.createObjectURL(new Blob([cached.data], { type: cached.mimeType }));
        setCachedBlobUrl(fullCacheKey, blobUrl, cached.mimeType);
        return blobUrl;
      }
    } catch {
      // Fall through to decryption below.
    }

    try {
      const blob = await decryptMediaFile(client, encryptedFile, fullMimeType);
      const buffer = await blob.arrayBuffer();
      await setCachedMedia(fullCacheKey, buffer, blob.type);
      const url = URL.createObjectURL(new Blob([buffer], { type: blob.type }));
      setCachedBlobUrl(fullCacheKey, url, blob.type);
      return url;
    } catch {
      return null;
    }
  }, [client, encryptedFile, fullCacheKey, fullMimeType]);

  // Cache cleanup is handled by LRU eviction (2000 entries) in mediaCache.ts.
  // We intentionally do NOT remove the cache entry on unmount, doing so would
  // destroy the pre-cached blob URL for the sender's own media when the Matrix
  // SDK replaces the local echo event with the confirmed remote echo.

  return { mediaSrc, isDecrypting, hasFailed, setMediaSrc, requestFullRes };
}
