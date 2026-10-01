import type { MatrixClient } from 'matrix-js-sdk';

export function mxcUrlToHttp(
  client: MatrixClient,
  mxcUrl: string | undefined | null,
  width?: number,
  height?: number,
  resizeMethod?: string,
  allowDirectLinks = false,
  allowRedirects?: boolean,
  useAuthentication?: boolean
): string {
  if (!mxcUrl || !client) return '';
  const original = client.mxcUrlToHttp(
    mxcUrl,
    width,
    height,
    resizeMethod,
    allowDirectLinks,
    allowRedirects,
    useAuthentication
  );
  if (!original) return '';

  try {
    const url = new URL(original);
    url.searchParams.delete('allow_redirect');

    let w = width;
    let h = height;
    if ((w && !h) || (h && !w)) {
      if (w && !h) h = w;
      if (h && !w) w = h;
    }

    if (w && h) {
      if (w) url.searchParams.set('width', Math.round(w).toString());
      if (h) url.searchParams.set('height', Math.round(h).toString());
      if (resizeMethod) url.searchParams.set('method', resizeMethod);
    } else {
      for (const param of ['width', 'height', 'method']) {
        url.searchParams.delete(param);
      }
      url.pathname = url.pathname.replace('/thumbnail/', '/download/');
    }

    return url.href;
  } catch {
    return original.replace(/[?&]allow_redirect=[^&]+/g, '').replace(/&$/, '');
  }
}
