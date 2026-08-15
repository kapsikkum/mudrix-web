import { encryptAttachment, decryptAttachment } from 'matrix-encrypt-attachment';
import type { IEncryptedFile } from 'matrix-encrypt-attachment';
import type { MatrixClient } from 'matrix-js-sdk';
import { getMediaCacheKey, setCachedBlobUrl } from './message/mediaCache';

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
  thumbnailFile?: IEncryptedFile & { url: string };
  thumbnailInfo?: { w: number; h: number; mimetype: string; size: number };
}

const MAX_THUMB_DIM = 800;

async function createImageThumbnail(
  file: File
): Promise<{ blob: Blob; w: number; h: number } | null> {
  try {
    if (typeof createImageBitmap !== 'function') return null;
    if (file.type === 'image/gif' || file.type === 'image/apng' || file.type === 'image/svg+xml') {
      return null;
    }
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_THUMB_DIM / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return null;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8)
    );
    if (!blob) return null;
    return { blob, w, h };
  } catch {
    return null;
  }
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
  const fileType = file.type;
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

  const uploadedFile: IEncryptedFile & { url: string } = {
    ...info,
    url: response.content_uri,
  };

  let thumbnailFile: (IEncryptedFile & { url: string }) | undefined;
  let thumbnailInfo: { w: number; h: number; mimetype: string; size: number } | undefined;

  if (fileType.startsWith('image/')) {
    const isImageType =
      fileType === 'image/jpeg' ||
      fileType === 'image/png' ||
      fileType === 'image/webp' ||
      fileType === 'image/avif';
    if (isImageType && !abortController?.signal.aborted) {
      const thumb = await createImageThumbnail(file);
      if (thumb && !abortController?.signal.aborted) {
        const { data: encryptedThumb, info: thumbInfo } = await encryptAttachment(
          await thumb.blob.arrayBuffer()
        );
        if (abortController?.signal.aborted)
          throw new DOMException('Upload cancelled', 'AbortError');

        const thumbResponse = await client.uploadContent(
          new Blob([encryptedThumb], { type: 'application/octet-stream' }),
          {
            includeFilename: false,
            type: 'application/octet-stream',
            abortController,
          }
        );
        thumbnailFile = { ...thumbInfo, url: thumbResponse.content_uri };
        thumbnailInfo = { w: thumb.w, h: thumb.h, mimetype: 'image/jpeg', size: thumb.blob.size };

        const thumbKey = getMediaCacheKey(thumbnailFile);
        setCachedBlobUrl(thumbKey, URL.createObjectURL(thumb.blob), thumb.blob.type);
      }
    }
  }

  return { file: uploadedFile, thumbnailFile, thumbnailInfo };
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

export interface MediaThumbnail {
  file: IEncryptedFile & { url: string };
  mimetype?: string;
}

export function getMediaThumbnail(content: Record<string, unknown>): MediaThumbnail | null {
  const info = content?.info as Record<string, unknown> | undefined;
  const thumb = info?.thumbnail_file as Record<string, unknown> | undefined;
  if (!thumb || typeof thumb.url !== 'string') return null;
  const thumbInfo = info?.thumbnail_info as Record<string, unknown> | undefined;
  return {
    file: thumb as unknown as IEncryptedFile & { url: string },
    mimetype: typeof thumbInfo?.mimetype === 'string' ? thumbInfo.mimetype : undefined,
  };
}

export interface MediaInfo {
  mimetype: string;
  size: number;
  w?: number;
  h?: number;
}

export async function getImageDimensions(file: File): Promise<{ w: number; h: number } | null> {
  try {
    if (typeof createImageBitmap !== 'function') return null;
    const bitmap = await createImageBitmap(file);
    const dims = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    if (dims.w > 0 && dims.h > 0) return dims;
  } catch {
    // Not every image format decodes via createImageBitmap; fall back to no dimensions.
  }
  return null;
}

export function buildMediaMessageContent(
  msgtype: 'm.image' | 'm.video' | 'm.file' | 'm.audio',
  filename: string,
  body: string,
  uploadResult: UploadResult,
  info: MediaInfo
): Record<string, unknown> {
  const mergedInfo =
    uploadResult.thumbnailFile && uploadResult.thumbnailInfo
      ? {
          ...info,
          thumbnail_file: uploadResult.thumbnailFile,
          thumbnail_info: uploadResult.thumbnailInfo,
        }
      : info;
  const base = {
    msgtype,
    body,
    filename,
    info: mergedInfo,
  };

  if (uploadResult.file) {
    // Encrypted room — MSC3090 format
    return { ...base, file: uploadResult.file };
  }

  // Unencrypted room
  return { ...base, url: uploadResult.url };
}
