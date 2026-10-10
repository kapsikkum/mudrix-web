import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { uploadEncryptedFile, buildMediaMessageContent } from '../encryptedMedia';
import { getMediaCacheKey, setCachedBlobUrl } from '../message/mediaCache';
import { sendMessageContent } from './sendMessageContent';
import { VOICE_MIMETYPE } from './useVoiceRecorder';

const VOICE_FILENAME = 'Voice message.ogg';
const VOICE_BODY = 'Voice message';

interface SendVoiceMessageOptions {
  client: MatrixClient;
  roomId: string;
  threadId?: string | null;
  replyTo?: MatrixEvent | null;
  myId?: string;
  durationMs: number;
  waveform: number[];
  onProgress?: (fraction: number) => void;
}

export async function sendVoiceMessage(
  blob: Blob,
  {
    client,
    roomId,
    threadId,
    replyTo,
    myId,
    durationMs,
    waveform,
    onProgress,
  }: SendVoiceMessageOptions
): Promise<void> {
  const file = new File([blob], VOICE_FILENAME, { type: VOICE_MIMETYPE });
  const uploadResult = await uploadEncryptedFile(client, roomId, file, undefined, onProgress);

  // Pre-cache the recorded audio so the sender's own event plays instantly once
  // the local echo is replaced by the confirmed remote echo.
  try {
    const cacheKey = uploadResult.file
      ? getMediaCacheKey(uploadResult.file)
      : uploadResult.url
        ? `mxc:${uploadResult.url}`
        : null;
    if (cacheKey) {
      setCachedBlobUrl(cacheKey, URL.createObjectURL(file), VOICE_MIMETYPE);
    }
  } catch {
    // Caching is best-effort; playback will fall back to downloading.
  }

  const duration = Math.max(0, Math.round(durationMs));
  const content = buildMediaMessageContent('m.audio', VOICE_FILENAME, VOICE_BODY, uploadResult, {
    mimetype: VOICE_MIMETYPE,
    size: file.size,
    duration,
  });

  content['org.matrix.msc1767.text'] = VOICE_BODY;
  content['org.matrix.msc1767.file'] = {
    ...(uploadResult.file ? { file: uploadResult.file } : { url: uploadResult.url }),
    name: VOICE_FILENAME,
    mimetype: VOICE_MIMETYPE,
    size: file.size,
  };
  content['org.matrix.msc1767.audio'] = {
    duration,
    waveform: Array.isArray(waveform) ? waveform : [],
  };
  content['org.matrix.msc3245.voice'] = {};

  await sendMessageContent(content, { client, roomId, threadId, replyTo, myId });
}
