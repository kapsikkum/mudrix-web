import { encryptAttachment, decryptAttachment } from 'matrix-encrypt-attachment';
import type { IEncryptedFile } from 'matrix-encrypt-attachment';
import type { MatrixClient } from 'matrix-js-sdk';

export type { IEncryptedFile };

const UNSAFE_MIME_FRAGMENTS = [
  'x-msdownload',
  'x-sh',
  'x-executable',
  'x-bat',
  'x-msdos-program',
  'java-archive',
  'application/javascript',
  'application/ecmascript',
  'text/javascript',
  'text/html',
  'text/xml',
];

function getSafeMimeType(mime: string): string {
  if (!mime) return 'application/octet-stream';
  const lower = mime.toLowerCase();
  if (UNSAFE_MIME_FRAGMENTS.some((f) => lower.includes(f))) {
    return 'application/octet-stream';
  }
  return mime;
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
  onProgress?: (fraction: number) => void
): Promise<UploadResult> {
  const isEncryptedRoom = await client.getCrypto()?.isEncryptionEnabledInRoom(roomId);

  if (!isEncryptedRoom) {
    // Plain upload — existing behaviour
    onPhase?.('uploading');
    const response = await client.uploadContent(file, {
      name: file.name,
      progressHandler: onProgress
        ? ({ loaded, total }: { loaded: number; total: number }) =>
            onProgress(total > 0 ? loaded / total : 0)
        : undefined,
    });
    return { url: response.content_uri };
  }

  // 1. Read file into memory
  onPhase?.('encrypting');
  const data = await file.arrayBuffer();

  // 2. Encrypt (AES-CTR, generates ephemeral key + IV)
  const { data: encryptedData, info } = await encryptAttachment(data);

  // 3. Upload encrypted blob — no filename, octet-stream content type
  onPhase?.('uploading');
  const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
  const response = await client.uploadContent(blob, {
    includeFilename: false,
    type: 'application/octet-stream',
    progressHandler: onProgress
      ? ({ loaded, total }: { loaded: number; total: number }) =>
          onProgress(total > 0 ? loaded / total : 0)
      : undefined,
  });

  // 4. Combine MXC URI with encryption metadata (MSC3090 EncryptedFile)
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
  mimeType?: string
): Promise<Blob> {
  // Resolve mxc:// → authenticated HTTPS URL
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
  const response = await fetch(httpUrl, {
    headers: { Authorization: `Bearer ${client.getAccessToken()}` },
  });
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
