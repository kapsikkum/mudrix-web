import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getEncryptedFile, decryptMediaFile } from '../encryptedMedia';
import {
  getMediaCacheKey,
  getCachedMedia,
  setCachedMedia,
  getCachedBlobUrl,
  setCachedBlobUrl,
} from './mediaCache';

// Events that have permanently failed decryption this session
const sessionFailedEventIds = new Set<string>();

export function useDecryptedMedia(
  event: MatrixEvent,
  content: Record<string, unknown>,
  client: MatrixClient
): { mediaSrc: string | null; isDecrypting: boolean; setMediaSrc: (url: string) => void } {
  const { t } = useTranslation();
  const toast = useToast();
  const [mediaSrc, setMediaSrc_] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const eventId = event.getId();
  const failedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);

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
  const cacheKey = encryptedFile ? getMediaCacheKey(encryptedFile) : null;
  const mimeType =
    encryptedFile && content.info
      ? ((content.info as Record<string, unknown>)?.mimetype as string | undefined)
      : undefined;

  useEffect(() => {
    if (!cacheKey || !encryptedFile) return;
    if (mediaSrc) return;
    if (failedRef.current) return;
    if (eventId && sessionFailedEventIds.has(eventId)) return;

    const cachedUrl = getCachedBlobUrl(cacheKey);
    if (cachedUrl) {
      setMediaSrc(cachedUrl);
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    (async () => {
      const cached = await getCachedMedia(cacheKey);
      if (cancelled) return;

      if (cached) {
        const blobUrl = URL.createObjectURL(new Blob([cached.data], { type: cached.mimeType }));
        setCachedBlobUrl(cacheKey, blobUrl, cached.mimeType);
        setMediaSrc(blobUrl);
        return;
      }

      setIsDecrypting(true);

      try {
        const blob = await decryptMediaFile(
          client,
          encryptedFile!,
          mimeType,
          abortController.signal
        );
        if (cancelled) return;

        const buffer = await blob.arrayBuffer();
        await setCachedMedia(cacheKey, buffer, blob.type);

        if (cancelled) return;
        const blobUrl = URL.createObjectURL(new Blob([buffer], { type: blob.type }));
        setCachedBlobUrl(cacheKey, blobUrl, blob.type);
        setMediaSrc(blobUrl);
      } catch (err) {
        if (cancelled) return;
        failedRef.current = true;
        if (eventId) sessionFailedEventIds.add(eventId);
        toast.error(t('timeline.decryptFailed', { error: getErrorMessage(err) }));
      } finally {
        if (!cancelled) setIsDecrypting(false);
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, client, cacheKey, mimeType, mediaSrc, toast, t]);

  // Cache cleanup is handled by LRU eviction (2000 entries) in mediaCache.ts.
  // We intentionally do NOT remove the cache entry on unmount, doing so would
  // destroy the pre-cached blob URL for the sender's own media when the Matrix
  // SDK replaces the local echo event with the confirmed remote echo.

  return { mediaSrc, isDecrypting, setMediaSrc };
}
