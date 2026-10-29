import type { MatrixClient } from 'matrix-js-sdk';
import { isLivekitTransportConfig, type LivekitTransportConfig } from 'matrix-js-sdk/lib/matrixrtc';

const RTC_FOCI_WELL_KNOWN_KEY = 'org.matrix.msc4143.rtc_foci';

export function normalizeServiceUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0)$/i;

function isPrivateAddress(host: string): boolean {
  const ip = host.replace(/^\[|\]$/g, '');
  if (ip.includes(':'))
    return /^(::1?|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/i.test(ip) || ip === '::';
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p))) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * Whether a call server that another call member named is one to send our OpenID token to: https,
 * on the public internet. Our own homeserver's advertised call server is not checked (it is the
 * user's own choice); anyone in the call could otherwise point everyone at a server they run, or
 * at an address inside the viewer's network.
 */
export function isTrustedRemoteServiceUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return false;
  return !PRIVATE_HOST.test(parsed.hostname) && !isPrivateAddress(parsed.hostname);
}

function livekitFrom(list: unknown): LivekitTransportConfig | null {
  if (!Array.isArray(list)) return null;
  const livekit = list.find(isLivekitTransportConfig);
  return livekit
    ? { type: 'livekit', livekit_service_url: normalizeServiceUrl(livekit.livekit_service_url) }
    : null;
}

export async function getLivekitTransport(
  client: MatrixClient
): Promise<LivekitTransportConfig | null> {
  const wellKnown = client.getClientWellKnown() as Record<string, unknown> | undefined;
  const fromWellKnown = livekitFrom(wellKnown?.[RTC_FOCI_WELL_KNOWN_KEY]);
  if (fromWellKnown) return fromWellKnown;
  try {
    return livekitFrom(await client._unstable_getRTCTransports());
  } catch {
    return null;
  }
}
