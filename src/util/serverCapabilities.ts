import { AutoDiscovery } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import { DEFAULT_MAX_UPLOAD_BYTES } from '@/app/store/atoms';

export async function fetchServerUploadLimit(client: MatrixClient): Promise<number> {
  // Servers that have switched off unauthenticated media answer only on the authenticated endpoint,
  // older ones only on the legacy one.
  for (const authenticated of [true, false]) {
    try {
      const config = await client.getMediaConfig(authenticated);
      const limit = config['m.upload.size'];
      if (typeof limit === 'number' && limit > 0) return limit;
    } catch {
      // Not served here; try the other endpoint
    }
  }
  return DEFAULT_MAX_UPLOAD_BYTES;
}

const RTC_FOCI_WELL_KNOWN_KEY = 'org.matrix.msc4143.rtc_foci';

async function hasLivekitBackendTransport(client: MatrixClient): Promise<boolean> {
  try {
    const transports = await client._unstable_getRTCTransports();
    return (
      Array.isArray(transports) && transports.some((transport) => transport?.type === 'livekit')
    );
  } catch {
    return false;
  }
}

async function fetchWellKnownLivekitFocus(client: MatrixClient): Promise<boolean | null> {
  const domain = client.getDomain();
  if (!domain) return null;

  let foci: unknown;
  try {
    const wellKnown =
      client.getClientWellKnown() ?? (await AutoDiscovery.getRawClientConfig(domain));
    foci = wellKnown[RTC_FOCI_WELL_KNOWN_KEY];
  } catch {
    return null;
  }

  return Array.isArray(foci) && foci.length > 0;
}

async function probeMatrixRtcSupport(client: MatrixClient): Promise<boolean> {
  const [backendTransport, wellKnownFocus] = await Promise.all([
    hasLivekitBackendTransport(client),
    fetchWellKnownLivekitFocus(client),
  ]);

  return backendTransport || wellKnownFocus !== false;
}

const rtcSupportCache = new WeakMap<MatrixClient, Promise<boolean>>();

export function fetchMatrixRtcSupport(client: MatrixClient): Promise<boolean> {
  const cached = rtcSupportCache.get(client);
  if (cached) return cached;

  const probe = probeMatrixRtcSupport(client).then((supported) => {
    if (supported) rtcSupportCache.set(client, probe);
    return supported;
  });
  return probe;
}
