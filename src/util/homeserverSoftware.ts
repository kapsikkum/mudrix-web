export interface HomeserverSoftware {
  /** Software name as the server reports it ("Synapse", "Tuwunel", ...). */
  name: string;
  version: string;
}

export interface KnownSoftware {
  label: string;
  /** Brand colour of the badge. */
  color: string;
  /** One or two characters drawn on the badge. */
  glyph: string;
}

const KNOWN: Record<string, KnownSoftware> = {
  synapse: { label: 'Synapse', color: '#0dbd8b', glyph: 'S' },
  dendrite: { label: 'Dendrite', color: '#6c5ce7', glyph: 'D' },
  conduit: { label: 'Conduit', color: '#f59e0b', glyph: 'C' },
  conduwuit: { label: 'Conduwuit', color: '#ec4899', glyph: 'Cw' },
  continuwuity: { label: 'Continuwuity', color: '#f472b6', glyph: 'Ct' },
  tuwunel: { label: 'Tuwunel', color: '#38bdf8', glyph: 'T' },
  grapevine: { label: 'Grapevine', color: '#a855f7', glyph: 'G' },
  construct: { label: 'Construct', color: '#64748b', glyph: 'Co' },
  telodendria: { label: 'Telodendria', color: '#84cc16', glyph: 'Te' },
  palpo: { label: 'Palpo', color: '#ef4444', glyph: 'P' },
};

/** How a software name is drawn; unknown servers get a neutral badge with their initial. */
export function describeSoftware(name: string): KnownSoftware {
  const known = KNOWN[name.trim().toLowerCase()];
  if (known) return known;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return { label: name.trim().slice(0, 32), color: '#6b7280', glyph: initial };
}

const FETCH_TIMEOUT_MS = 6000;

/**
 * A public server name we are willing to contact. A user id can carry any server name, so this
 * keeps a profile view from making the browser probe localhost, private networks or raw IPs.
 */
export function isPublicServerName(serverName: string): boolean {
  const m =
    /^([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)(:(\d{1,5}))?$/i.exec(
      serverName
    );
  if (!m) return false;
  const host = m[1].toLowerCase();
  if (/^\d+(\.\d+){3}$/.test(host)) return false;
  if (/\.(local|localhost|internal|lan|home|test|invalid|example)$/.test(host)) return false;
  const port = m[6] ? Number(m[6]) : 443;
  return port >= 1 && port <= 65535;
}

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseVersionResponse(body: unknown): HomeserverSoftware | null {
  const server = (body as { server?: { name?: unknown; version?: unknown } } | null)?.server;
  if (!server || typeof server.name !== 'string' || !server.name.trim()) return null;
  return {
    name: server.name.trim().slice(0, 64),
    version: typeof server.version === 'string' ? server.version.trim().slice(0, 64) : '',
  };
}

/**
 * Asks the server itself (never a third party) what it runs, through the federation version
 * endpoint. The federation host is found through `/.well-known/matrix/server` first, then the
 * server name itself on 443 and 8448. Servers that don't allow cross-site requests, hide their
 * version or are unreachable simply have no software shown.
 */
async function lookupHomeserverSoftware(serverName: string): Promise<HomeserverSoftware | null> {
  if (!isPublicServerName(serverName)) return null;

  const candidates: string[] = [];
  const wellKnown = await fetchJson(`https://${serverName}/.well-known/matrix/server`);
  const delegated = (wellKnown as { 'm.server'?: unknown } | null)?.['m.server'];
  if (typeof delegated === 'string' && isPublicServerName(delegated)) {
    // A delegated name without a port means 8448 per the federation spec.
    candidates.push(/:\d+$/.test(delegated) ? delegated : `${delegated}:8448`);
    if (!/:\d+$/.test(delegated)) candidates.push(delegated);
  }
  candidates.push(serverName, `${serverName.replace(/:\d+$/, '')}:8448`);

  for (const host of Array.from(new Set(candidates))) {
    const parsed = parseVersionResponse(
      await fetchJson(`https://${host}/_matrix/federation/v1/version`)
    );
    if (parsed) return parsed;
  }
  return null;
}

const cache = new Map<string, Promise<HomeserverSoftware | null>>();

export function getHomeserverSoftware(serverName: string): Promise<HomeserverSoftware | null> {
  const key = serverName.toLowerCase();
  let pending = cache.get(key);
  if (!pending) {
    pending = lookupHomeserverSoftware(key);
    cache.set(key, pending);
  }
  return pending;
}
