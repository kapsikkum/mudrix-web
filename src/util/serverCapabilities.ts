import { AutoDiscovery } from 'matrix-js-sdk';
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

const RTC_UNSTABLE_FEATURE = 'org.matrix.msc3401.call';
const RTC_FOCI_WELL_KNOWN_KEY = 'org.matrix.msc4143.rtc_foci';

async function probeMatrixRtcSupport(client: MatrixClient): Promise<boolean> {
  let advertisesCallMember: boolean;
  try {
    advertisesCallMember = await client.doesServerSupportUnstableFeature(RTC_UNSTABLE_FEATURE);
  } catch {
    return true;
  }
  if (!advertisesCallMember) return false;

  const domain = client.getDomain();
  if (!domain) return true;

  let foci: unknown;
  try {
    const wellKnown = await AutoDiscovery.getRawClientConfig(domain);
    foci = wellKnown[RTC_FOCI_WELL_KNOWN_KEY];
  } catch {
    return true;
  }

  return Array.isArray(foci) && foci.length > 0;
}

const rtcSupportCache = new WeakMap<MatrixClient, Promise<boolean>>();

export function fetchMatrixRtcSupport(client: MatrixClient): Promise<boolean> {
  let cached = rtcSupportCache.get(client);
  if (!cached) {
    cached = probeMatrixRtcSupport(client);
    rtcSupportCache.set(client, cached);
  }
  return cached;
}
