import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getEncryptedFile, decryptMediaFile } from '../encryptedMedia';
import { getMediaCacheKey, getCachedMedia, setCachedMedia } from './mediaCache';

// Events that have permanently failed decryption this session
const sessionFailedEventIds = new Set<string>();

export function useDecryptedMedia(
  event: MatrixEvent,
  content: Record<string, unknown>,
  client: MatrixClient
): { mediaSrc: string | null; isDecrypting: boolean; setMediaSrc: (url: string) => void } {
  const { t } = useTranslation();
  const toast = useToast();
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const eventId = event.getId();
  const failedRef = useRef(false);

  useEffect(() => {
    const msgtype = content?.msgtype as string | undefined;
    const isMedia =
      msgtype === 'm.image' ||
      msgtype === 'm.video' ||
      msgtype === 'm.file' ||
      msgtype === 'm.audio';
    if (!isMedia) return;

    const encryptedFile = getEncryptedFile(content);
    if (!encryptedFile) return;

    if (mediaSrc) return;

    if (failedRef.current) return;
    if (eventId && sessionFailedEventIds.has(eventId)) return;

    const cacheKey = getMediaCacheKey(encryptedFile);
    const abortController = new AbortController();
    let cancelled = false;
    setIsDecrypting(true);

    const mimeType = content.info
      ? ((content.info as Record<string, unknown>)?.mimetype as string | undefined)
      : undefined;

    (async () => {
      const cached = await getCachedMedia(cacheKey);
      if (cancelled) return;
      if (cached) {
        setMediaSrc(URL.createObjectURL(new Blob([cached.data], { type: cached.mimeType })));
        setIsDecrypting(false);
        return;
      }

      try {
        const blob = await decryptMediaFile(
          client,
          encryptedFile,
          mimeType,
          abortController.signal
        );
        if (cancelled) return;

        const buffer = await blob.arrayBuffer();
        setCachedMedia(cacheKey, buffer, blob.type);

        if (cancelled) return;
        setMediaSrc(URL.createObjectURL(new Blob([buffer], { type: blob.type })));
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
  }, [eventId, client, content, mediaSrc, toast, t]);

  return { mediaSrc, isDecrypting, setMediaSrc };
}
