import { fetchLimited } from './net';

const MAX_ICON_BYTES = 200 * 1024;

type Sniffed = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

/** Identifies the image by its magic bytes; the Content-Type header alone is not trusted. */
function sniff(b: Uint8Array): Sniffed | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return 'image/png';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 5 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return 'image/gif';
  if (
    b.length > 12 &&
    String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' &&
    String.fromCharCode(...b.subarray(8, 12)) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

const ALLOWED_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Downloads an icon once, at install, and returns it as a data URL so third-party hosts are not
 * contacted again. PNG, JPEG, WebP and GIF only (never SVG). Returns null on any problem.
 */
export async function fetchIconDataUrl(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) return null;
    const res = await fetchLimited(
      url,
      MAX_ICON_BYTES,
      'image/png,image/jpeg,image/webp,image/gif'
    );
    if (!res.ok || !ALLOWED_TYPES.includes(res.contentType)) return null;
    const type = sniff(res.bytes);
    if (!type) return null;
    let bin = '';
    for (let i = 0; i < res.bytes.length; i += 0x8000)
      bin += String.fromCharCode(...res.bytes.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}
