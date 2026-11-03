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
import { downloadMxcMedia, type DownloadProgress, type StreamOptions } from '../mediaDownload';
import {
  MAX_CACHE_BYTES,
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

// Videos stream and can legitimately take minutes: give up only when the connection goes quiet.
const VIDEO_STALL_TIMEOUT_MS = 30000;
// Videos at or above this size (or of unknown size) wait for a click instead of downloading on render.
const MANUAL_VIDEO_MIN_BYTES = 8 * 1024 * 1024;
const PROGRESS_EMIT_GAP_MS = 120;

export interface ManualVideoLoad {
  /** True while the video is not loaded and waits for the user to start it (or is being fetched). */
  needsClick: boolean;
  /** The persistent cache is still being checked, so no button is offered yet. */
  checking: boolean;
  loading: boolean;
  progress: DownloadProgress | null;
  /** The user started this download, so playback may begin as soon as it is ready. */
  autoPlay: boolean;
  start: () => void;
  cancel: () => void;
}

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
  /** Click-to-download state for videos; null for everything else. */
  videoLoad: ManualVideoLoad | null;
  /** `force` skips the in-memory blob URL cache (its URL may have been revoked). */
  requestFullRes: (force?: boolean) => Promise<string | null>;
} {
  const { t } = useTranslation();
  const toast = useToast();
  const [mediaSrc, setMediaSrc_] = useState<string | null>(null);
  const [thumbnailSrc, setThumbnailSrc_] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [manualRequested, setManualRequested] = useState(false);
  const [videoProgress, setVideoProgress] = useState<DownloadProgress | null>(null);
  // The cache key a deferred video was last found missing from the persistent cache under.
  const [missedKey, setMissedKey] = useState<string | null>(null);

  const eventId = event.getId();
  const failedRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  const thumbBlobUrlRef = useRef<string | null>(null);
  // Bumped on reconnect so a temporarily failed media download re-runs.
  const reconnectTick = useRef(0);

  const setMediaSrc = useCallback((url: string | null) => {
    blobUrlRef.current = url;
    setMediaSrc_(url);
  }, []);

  const setThumbnailSrc = useCallback((url: string | null) => {
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

  const videoInfo = isVideo ? (content.info as Record<string, unknown> | undefined) : undefined;
  const videoSize =
    typeof videoInfo?.size === 'number' && videoInfo.size >= 0 ? videoInfo.size : undefined;
  const videoMimeType = typeof videoInfo?.mimetype === 'string' ? videoInfo.mimetype : undefined;
  const deferVideo = isVideo && (videoSize === undefined || videoSize >= MANUAL_VIDEO_MIN_BYTES);
  const plainVideoUrl = mxcUrl && mxcUrl.startsWith('mxc://') ? mxcUrl : null;
  const videoCacheKey =
    deferVideo && !mediaSrc
      ? (fullCacheKey ?? (plainVideoUrl ? mediaBlobCacheKey(plainVideoUrl) : null))
      : null;
  const videoCachedInMemory = videoCacheKey !== null && getCachedBlobUrl(videoCacheKey) !== null;
  // An encrypted video may still sit in the persistent cache: wait for that check before offering a click.
  const videoCacheMissed = fullCacheKey ? missedKey === fullCacheKey : true;
  const videoNeedsClick = enabled && videoCacheKey !== null && !videoCachedInMemory;

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

  const resolveCached = useCallback(async (key: string): Promise<string | null> => {
    const cachedUrl = getCachedBlobUrl(key);
    if (cachedUrl) return cachedUrl;

    const cached = await getCachedMedia(key);
    if (!cached) return null;
    const blobUrl = URL.createObjectURL(new Blob([cached.data], { type: cached.mimeType }));
    setCachedBlobUrl(key, blobUrl, cached.mimeType, cached.data.byteLength);
    return blobUrl;
  }, []);

  const resolveEncrypted = useCallback(
    async (
      target: MediaTarget,
      signal?: AbortSignal,
      stream?: StreamOptions
    ): Promise<string | null> => {
      const key = getTargetCacheKey(target);
      const cachedUrl = await resolveCached(key);
      if (cachedUrl) return cachedUrl;

      const blob = await decryptMediaFile(client, target.file, target.mimeType, signal, stream);
      // Files over the persistent limit are not stored, so do not copy them out of the blob.
      if (blob.size <= MAX_CACHE_BYTES) {
        await setCachedMedia(key, await blob.arrayBuffer(), blob.type);
      }
      const blobUrl = URL.createObjectURL(blob);
      setCachedBlobUrl(key, blobUrl, blob.type, blob.size);
      return blobUrl;
    },
    [client, resolveCached]
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
    // Large videos wait for a click (or the cache check below) instead of downloading on render.
    if (deferVideo) return;
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
    deferVideo,
    thumbUrl,
    mediaSrc,
    toast,
    t,
    showErrors,
    reconnectTick.current,
  ]);

  // A deferred encrypted video that is already in the persistent cache needs no click.
  useEffect(() => {
    if (!enabled || !deferVideo || !fullCacheKey || mediaSrc) return;
    let cancelled = false;
    resolveCached(fullCacheKey)
      .then((url) => {
        if (cancelled) return;
        if (url) setMediaSrc(url);
        else setMissedKey(fullCacheKey);
      })
      .catch(() => {
        if (!cancelled) setMissedKey(fullCacheKey);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, deferVideo, fullCacheKey, mediaSrc, resolveCached, setMediaSrc]);

  // The click-to-download of a deferred video; cancelling or leaving aborts it through the cleanup.
  useEffect(() => {
    if (!enabled || !deferVideo || !manualRequested || mediaSrc) return;

    const abortController = new AbortController();
    let cancelled = false;
    let lastEmit = 0;
    const stream: StreamOptions = {
      stallTimeoutMs: VIDEO_STALL_TIMEOUT_MS,
      expectedSize: videoSize,
      onProgress: (progress) => {
        const now = Date.now();
        if (cancelled || now - lastEmit < PROGRESS_EMIT_GAP_MS) return;
        lastEmit = now;
        setVideoProgress(progress);
      },
    };

    (async () => {
      try {
        setVideoProgress({ loaded: 0, total: videoSize ?? 0 });
        let url: string | null = null;
        if (encryptedFile) {
          url = await resolveEncrypted(
            { kind: 'full', file: encryptedFile, mimeType: videoMimeType },
            abortController.signal,
            stream
          );
        } else if (plainVideoUrl) {
          const blob = await downloadMxcMedia(
            client,
            plainVideoUrl,
            videoMimeType,
            abortController.signal,
            stream
          );
          url = URL.createObjectURL(blob);
          setCachedBlobUrl(mediaBlobCacheKey(plainVideoUrl), url, blob.type, blob.size);
        }
        if (cancelled) return;
        if (url) setMediaSrc(url);
        else setManualRequested(false);
      } catch (err) {
        if (cancelled) return;
        // Back to the play button so a click retries; failedRef stays untouched so it cannot block that.
        setManualRequested(false);
        toast.error(
          t('timeline.video.downloadFailed', {
            error: getErrorMessage(err),
            defaultValue: 'Could not download the video: {{error}}',
          })
        );
      } finally {
        if (!cancelled) setVideoProgress(null);
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
    deferVideo,
    manualRequested,
    fullCacheKey,
    plainVideoUrl,
    mediaSrc,
    toast,
    t,
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
            setCachedBlobUrl(fullCacheKey, blobUrl, cached.mimeType, cached.data.byteLength);
            return blobUrl;
          }
        } catch {
          // Fall through to decryption below.
        }

        try {
          const blob = await decryptMediaFile(
            client,
            encryptedFile,
            fullMimeType,
            undefined,
            isVideo
              ? { stallTimeoutMs: VIDEO_STALL_TIMEOUT_MS, expectedSize: videoSize }
              : undefined
          );
          if (blob.size <= MAX_CACHE_BYTES) {
            await setCachedMedia(fullCacheKey, await blob.arrayBuffer(), blob.type);
          }
          const url = URL.createObjectURL(blob);
          setCachedBlobUrl(fullCacheKey, url, blob.type, blob.size);
          return url;
        } catch {
          return null;
        }
      }

      // fetchMediaBlobUrl hands non-mxc URLs back unchanged, so never pass it an event-supplied one.
      if (mxcUrl && mxcUrl.startsWith('mxc://')) {
        if (force) deleteCachedBlobUrl(mediaBlobCacheKey(mxcUrl));
        try {
          return await fetchMediaBlobUrl(mxcUrl, client, 1);
        } catch {
          return null;
        }
      }
      return null;
    },
    [client, encryptedFile, fullCacheKey, fullMimeType, mxcUrl, isVideo, videoSize]
  );

  // Cache entries are managed by mediaCache.ts: the in-memory blob URL cache
  // is an LRU (2000 entries) and the persistent decrypted-media store is
  // capped by size/count with LRU eviction and wiped on logout. We do NOT
  // remove the cache entry on unmount, doing so would destroy the pre-cached
  // blob URL for the sender's own media when the Matrix SDK replaces the local
  // echo event with the confirmed remote echo.

  const startVideo = useCallback(() => setManualRequested(true), []);
  const cancelVideo = useCallback(() => setManualRequested(false), []);
  const videoLoad: ManualVideoLoad | null = isVideo
    ? {
        needsClick: videoNeedsClick,
        checking: videoNeedsClick && !videoCacheMissed,
        loading: manualRequested,
        progress: videoProgress,
        autoPlay: manualRequested,
        start: startVideo,
        cancel: cancelVideo,
      }
    : null;

  return {
    mediaSrc,
    thumbnailSrc,
    isDecrypting,
    hasFailed,
    setMediaSrc,
    videoLoad,
    requestFullRes,
  };
}
