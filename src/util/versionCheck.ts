// The version baked into the JS bundle at build time.
export const CURRENT_VERSION: string = import.meta.env.APP_VERSION ?? '0.0.0';

/**
 * The new app's stable URL. The old client checks its `version.txt` for a newer version, so a
 * release of the new app also reaches people still running this one.
 */
export const NEW_APP_URL = 'https://kapsikkum.github.io/mudrix/';
const DEPLOYED_VERSION_URL = new URL('version.txt', NEW_APP_URL).toString();

export async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(DEPLOYED_VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    if (!text || text.startsWith('<') || text.includes(' ')) return null;
    return text;
  } catch {
    return null;
  }
}

export function isNewerVersion(current: string, deployed: string): boolean {
  return deployed !== current;
}
