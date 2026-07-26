import { encryptAttachment, decryptAttachment } from 'matrix-encrypt-attachment';
import type { IEncryptedFile } from 'matrix-encrypt-attachment';
import type { MatrixClient } from 'matrix-js-sdk';

export type { IEncryptedFile };

// Only allow mime types the browser can safely render as a blob URL.
const ALLOWED_BLOB_MIMETYPES = [
  'image/jpeg',
  'image/gif',
  'image/png',
  'image/apng',
  'image/webp',
  'image/avif',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'audio/mp4',
  'audio/webm',
  'audio/aac',
  'audio/mpeg',
  'audio/ogg',
  'audio/wave',
  'audio/wav',
  'audio/x-wav',
  'audio/x-pn-wav',
  'audio/flac',
  'audio/x-flac',
];

function getSafeMimeType(mime: string): string {
  if (!mime) return 'application/octet-stream';
  if (ALLOWED_BLOB_MIMETYPES.includes(mime.toLowerCase())) return mime;
  return 'application/octet-stream';
}

export interface UploadResult {
  url?: string;
  file?: IEncryptedFile & { url: string };
}

export type UploadPhase = 'encrypting' | 'uploading';

export async function uploadEncryptedFile(
  client: MatrixClient,
  roomId: string,
  file: File,
  onPhase?: (phase: UploadPhase) => void,
  onProgress?: (fraction: number) => void,
  abortController?: AbortController
): Promise<UploadResult> {
  const isEncryptedRoom = await client.getCrypto()?.isEncryptionEnabledInRoom(roomId);

  if (!isEncryptedRoom) {
    onPhase?.('uploading');
    const response = await client.uploadContent(file, {
      name: file.name,
      abortController,
      progressHandler: onProgress
        ? ({ loaded, total }: { loaded: number; total: number }) =>
            onProgress(total > 0 ? loaded / total : 0)
        : undefined,
    });
    return { url: response.content_uri };
  }

  onPhase?.('encrypting');
  const data = await file.arrayBuffer();

  const { data: encryptedData, info } = await encryptAttachment(data);

  if (abortController?.signal.aborted) throw new DOMException('Upload cancelled', 'AbortError');

  onPhase?.('uploading');
  const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
  const response = await client.uploadContent(blob, {
    includeFilename: false,
    type: 'application/octet-stream',
    abortController,
    progressHandler: onProgress
      ? ({ loaded, total }: { loaded: number; total: number }) =>
          onProgress(total > 0 ? loaded / total : 0)
      : undefined,
  });

  return {
    file: {
      ...info,
      url: response.content_uri,
    },
  };
}

export async function decryptMediaFile(
  client: MatrixClient,
  encryptedFile: IEncryptedFile & { url: string },
  mimeType?: string,
  signal?: AbortSignal
): Promise<Blob> {
  const httpUrl = client.mxcUrlToHttp(
    encryptedFile.url,
    undefined,
    undefined,
    undefined,
    false,
    true,
    true
  );
  if (!httpUrl) throw new Error(`Cannot resolve mxc URL: ${encryptedFile.url}`);

  // Download encrypted ciphertext
  const token = client.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  headers['Accept-Encoding'] = 'identity';

  const response = await fetch(httpUrl, { headers, signal });
  if (!response.ok) {
    throw new Error(
      `Failed to download encrypted media: ${response.status} ${response.statusText}`
    );
  }

  const ciphertext = await response.arrayBuffer();

  // Decrypt
  const plaintext = await decryptAttachment(ciphertext, encryptedFile);

  // Return blob with a safe MIME type (prevents XSS from executable content)
  return new Blob([plaintext], { type: getSafeMimeType(mimeType ?? '') });
}

export function getEncryptedFile(
  content: Record<string, unknown>
): (IEncryptedFile & { url: string }) | null {
  const file = content?.file as Record<string, unknown> | undefined;
  if (!file || typeof file.url !== 'string') return null;
  return file as unknown as IEncryptedFile & { url: string };
}

export function buildMediaMessageContent(
  msgtype: 'm.image' | 'm.video' | 'm.file' | 'm.audio',
  filename: string,
  body: string,
  uploadResult: UploadResult,
  info: { mimetype: string; size: number }
): Record<string, unknown> {
  const base = {
    msgtype,
    body,
    filename,
    info,
  };

  if (uploadResult.file) {
    // Encrypted room — MSC3090 format
    return { ...base, file: uploadResult.file };
  }

  // Unencrypted room
  return { ...base, url: uploadResult.url };
}
