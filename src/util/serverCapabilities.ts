import type { MatrixClient } from 'matrix-js-sdk';
import { DEFAULT_MAX_UPLOAD_BYTES } from '@/app/store/atoms';

export async function fetchServerUploadLimit(client: MatrixClient): Promise<number> {
  try {
    const config = await client.getMediaConfig();
    const limit = config['m.upload.size'];
    if (typeof limit === 'number' && limit > 0) return limit;
  } catch {
    // Server may not support the endpoint – use the default
  }
  return DEFAULT_MAX_UPLOAD_BYTES;
}
