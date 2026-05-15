import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useToast } from '@/app/hooks/useToast';
import { getErrorMessage } from '@/util/error';
import { getEncryptedFile, decryptMediaFile } from '../encryptedMedia';

// Handles decryption of encrypted media attachments (MSC3090).
// Returns a blob URL once decrypted, and an in-progress flag while decrypting.
export function useDecryptedMedia(
  event: MatrixEvent,
  content: Record<string, unknown>,
  client: MatrixClient
): { mediaSrc: string | null; isDecrypting: boolean; setMediaSrc: (url: string) => void } {
  const { t } = useTranslation();
  const toast = useToast();
  const [mediaSrc, setMediaSrc] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  useEffect(() => {
    const msgtype = content?.msgtype as string | undefined;
    const isMedia =
      msgtype === 'm.image' ||
      msgtype === 'm.video' ||
      msgtype === 'm.file' ||
      msgtype === 'm.audio';
    if (!isMedia) return;

    const encryptedFile = getEncryptedFile(content);
    if (!encryptedFile) return; // unencrypted — handled by getMediaBlobUrl

    if (mediaSrc) return;

    let cancelled = false;
    setIsDecrypting(true);

    const mimeType = content.info
      ? ((content.info as Record<string, unknown>)?.mimetype as string | undefined)
      : undefined;

    decryptMediaFile(client, encryptedFile, mimeType)
      .then((blob) => {
        if (cancelled) return;
        setMediaSrc(URL.createObjectURL(blob));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(t('timeline.decryptFailed', { error: getErrorMessage(err) }));
      })
      .finally(() => {
        if (!cancelled) setIsDecrypting(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.getId()]);

  return { mediaSrc, isDecrypting, setMediaSrc };
}
