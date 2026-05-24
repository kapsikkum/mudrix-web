import type { MatrixClient } from 'matrix-js-sdk';

export async function fetchAvatarBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  retries = 2
): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const httpUrl = client.mxcUrlToHttp(mxcUrl, 64, 64, 'crop', false, true, true) as
        | string
        | null;
      if (!httpUrl) return null;

      const res = await fetch(httpUrl, {
        headers: { Authorization: `Bearer ${client.getAccessToken()}` },
      });

      if (!res.ok) {
        if (i < retries) {
          await new Promise((r) => setTimeout(r, 500 * (i + 1)));
          continue;
        }
        return null;
      }

      return URL.createObjectURL(await res.blob());
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}

export async function fetchMediaBlobUrl(
  mxcUrl: string,
  client: MatrixClient,
  retries = 2
): Promise<string | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const httpUrl = client.mxcUrlToHttp(
        mxcUrl,
        undefined,
        undefined,
        undefined,
        false,
        true,
        true
      ) as string | null;
      if (!httpUrl) return null;

      const res = await fetch(httpUrl, {
        headers: { Authorization: `Bearer ${client.getAccessToken()}` },
      });

      if (!res.ok) {
        if (i < retries) {
          await new Promise((r) => setTimeout(r, 500 * (i + 1)));
          continue;
        }
        return null;
      }

      return URL.createObjectURL(await res.blob());
    } catch {
      if (i < retries) await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  return null;
}
