import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import {
  getEncryptedFile,
  decryptMediaFile,
  getMediaThumbnail,
  type IEncryptedFile,
} from '../encryptedMedia';
import {
  getMediaCacheKey,
  getCachedMedia,
  setCachedMedia,
  getCachedBlobUrl,
  setCachedBlobUrl,
  deleteCachedBlobUrl,
} from './mediaCache';
import { getMediaBlobUrl } from './media';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { mediaBlobCacheKey } from '@/app/components/Avatar/fetchMediaBlobUrl';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

// A download that timed out (abort) is not worth a toast, and a screenful of failing media must not
// stack one toast per item: the failed state already shows on the media itself.
let lastDecryptToastAt = 0;
const DECRYPT_TOAST_GAP_MS = 30_000;
function notifyDecryptFailure(show: (message: string) => void, message: string, err: unknown) {
  if (
    (err instanceof DOMException && err.name === 'AbortError') ||
    /aborted/i.test(getErrorMessage(err))
  ) {
    return;
  }
  const now = Date.now();
  if (now - lastDecryptToastAt < DECRYPT_TOAST_GAP_MS) return;
  lastDecryptToastAt = now;
  show(message);
}

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
  client: MatrixClient,
  enabled = true,
  showErrors = true
): {
  mediaSrc: string | null;
  thumbnailSrc: string | null;
  isDecrypting: boolean;
  hasFailed: boolean;
  setMediaSrc: (url: string) => void;
  /** `force` skips the in-memory blob URL cache (its URL may have been revoked). */
  requestFullRes: (force?: boolean) => Promise<string | null>;
} {
  const { t } = useTranslation();
  const toast = useToast();
  const [mediaSrc, setMediaSrc_] = useState<string | null>(null);
  const [thumbnailSrc, setThumbnailSrc_] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const eventId = event.getId();
  const failedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  const thumbBlobUrlRef = useRef<string | null>(null);
  // Bumped on reconnect so a temporarily failed media download re-runs.
  const reconnectTick = useRef(0);

  const setMediaSrc = useCallback((url: string | null) => {
    if (blobUrlRef.current && blobUrlRef.current !== url) {
      URL.revokeObjectURL(blobUrlRef.current);
    }
    blobUrlRef.current = url;
    setMediaSrc_(url);
  }, []);

  const setThumbnailSrc = useCallback((url: string | null) => {
    if (thumbBlobUrlRef.current && thumbBlobUrlRef.current !== url) {
      URL.revokeObjectURL(thumbBlobUrlRef.current);
    }
    thumbBlobUrlRef.current = url;
    setThumbnailSrc_(url);
  }, []);

  // Stable primitives derived from content (avoids effect re-run on object ref change)
  const msgtype = content?.msgtype as string | undefined;
  const eventType = event.getType();
  const isImage = msgtype === 'm.image';
  const isVideo = msgtype === 'm.video';
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
  const mxcUrl = content?.url as string | undefined;

  const thumbnail = isImage || isVideo ? getMediaThumbnail(content) : null;
  const thumbFile = thumbnail?.file ?? null;
  const thumbUrl = thumbnail?.url ?? null;
  const thumbMimeType = thumbnail?.mimetype;

  const primaryIsThumb = isImage && thumbFile !== null;
  const primaryFile = primaryIsThumb ? thumbFile : encryptedFile;
  const primaryMimeType = primaryIsThumb ? (thumbMimeType ?? fullMimeType) : fullMimeType;
  const primaryTarget: MediaTarget | null = primaryFile
    ? {
        kind: primaryIsThumb ? 'thumbnail' : 'full',
        file: primaryFile,
        mimeType: primaryMimeType,
      }
    : null;
  const primaryCacheKey = primaryTarget ? getTargetCacheKey(primaryTarget) : null;

  const posterTarget: MediaTarget | null =
    isVideo && thumbFile
      ? { kind: 'thumbnail', file: thumbFile, mimeType: thumbMimeType ?? fullMimeType }
      : null;
  const posterCacheKey = posterTarget ? getTargetCacheKey(posterTarget) : null;

  const resolveEncrypted = useCallback(
    async (target: MediaTarget, signal?: AbortSignal): Promise<string | null> => {
      const key = getTargetCacheKey(target);
      const cachedUrl = getCachedBlobUrl(key);
      if (cachedUrl) return cachedUrl;

      const cached = await getCachedMedia(key);
      if (cached) {
        const blobUrl = URL.createObjectURL(new Blob([cached.data], { type: cached.mimeType }));
        setCachedBlobUrl(key, blobUrl, cached.mimeType);
        return blobUrl;
      }

      const blob = await decryptMediaFile(client, target.file, target.mimeType, signal);
      const buffer = await blob.arrayBuffer();
      await setCachedMedia(key, buffer, blob.type);
      const blobUrl = URL.createObjectURL(new Blob([buffer], { type: blob.type }));
      setCachedBlobUrl(key, blobUrl, blob.type);
      return blobUrl;
    },
    [client]
  );

  useEffect(() => {
    if (!enabled) return;
    if (!primaryTarget) {
      if (isImage && thumbUrl) {
        const cached = getMediaBlobUrl(thumbUrl, client, setMediaSrc);
        if (cached) setMediaSrc(cached);
      }
      return;
    }
    if (mediaSrc) return;
    if (failedRef.current) return;

    const abortController = new AbortController();
    let cancelled = false;
    const downloadTimeout = window.setTimeout(() => abortController.abort(), DOWNLOAD_TIMEOUT_MS);

    (async () => {
      try {
        setIsDecrypting(true);
        setHasFailed(false);
        const url = await resolveEncrypted(primaryTarget, abortController.signal);
        if (cancelled) return;
        setMediaSrc(url);
      } catch (err) {
        if (cancelled) return;
        failedRef.current = true;
        setHasFailed(true);
        if (showErrors) {
          notifyDecryptFailure(
            toast.error,
            t('timeline.decryptFailed', { error: getErrorMessage(err) }),
            err
          );
        }
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
  }, [
    eventId,
    client,
    enabled,
    primaryCacheKey,
    isImage,
    thumbUrl,
    mediaSrc,
    toast,
    t,
    showErrors,
    reconnectTick.current,
  ]);

  useEffect(() => {
    if (!enabled) return;
    if (!isVideo) {
      setThumbnailSrc(null);
      return;
    }
    if (!posterTarget) {
      if (thumbUrl) {
        const cached = getMediaBlobUrl(thumbUrl, client, setThumbnailSrc);
        if (cached) setThumbnailSrc(cached);
      }
      return;
    }
    if (thumbnailSrc) return;
    if (failedRef.current) return;

    const abortController = new AbortController();
    let cancelled = false;
    const downloadTimeout = window.setTimeout(() => abortController.abort(), DOWNLOAD_TIMEOUT_MS);

    (async () => {
      try {
        setIsDecrypting(true);
        setHasFailed(false);
        const url = await resolveEncrypted(posterTarget, abortController.signal);
        if (cancelled) return;
        setThumbnailSrc(url);
      } catch (err) {
        if (cancelled) return;
        failedRef.current = true;
        setHasFailed(true);
        if (showErrors) {
          notifyDecryptFailure(
            toast.error,
            t('timeline.decryptFailed', { error: getErrorMessage(err) }),
            err
          );
        }
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
  }, [
    eventId,
    client,
    enabled,
    isVideo,
    posterCacheKey,
    thumbUrl,
    thumbnailSrc,
    setThumbnailSrc,
    toast,
    t,
    showErrors,
    reconnectTick.current,
  ]);

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

  // Full-resolution file on demand (lightbox / download), for encrypted and
  // unencrypted media alike.
  const requestFullRes = useCallback(
    async (force = false): Promise<string | null> => {
      if (encryptedFile && fullCacheKey) {
        if (force) deleteCachedBlobUrl(fullCacheKey);
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
      }

      if (mxcUrl) {
        if (force) deleteCachedBlobUrl(mediaBlobCacheKey(mxcUrl));
        try {
          return await fetchMediaBlobUrl(mxcUrl, client, 1);
        } catch {
          return null;
        }
      }
      return null;
    },
    [client, encryptedFile, fullCacheKey, fullMimeType, mxcUrl]
  );

  // Cache entries are managed by mediaCache.ts: the in-memory blob URL cache
  // is an LRU (2000 entries) and the persistent decrypted-media store is
  // capped by size/count with LRU eviction and wiped on logout. We do NOT
  // remove the cache entry on unmount, doing so would destroy the pre-cached
  // blob URL for the sender's own media when the Matrix SDK replaces the local
  // echo event with the confirmed remote echo.

  return { mediaSrc, thumbnailSrc, isDecrypting, hasFailed, setMediaSrc, requestFullRes };
}
