import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import {
  CAPABILITIES,
  hasCapability,
  type Capability,
  type Integration,
  type Permissions,
} from './manifest';
import { fetchIconDataUrl } from './icons';
import { permissionsWidened } from './permissions';
import { fetchRepo, parseRepoUrl } from './repository';
import { checkRepoUpdate } from './signature';
import type { GrantMap, InstalledIntegration, RepositoryRecord } from './types';

export { permissionsWidened } from './permissions';

// Everything lives on this device only, in localStorage. Failures (private mode, quota) must
// never break the app, so every access is guarded.
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable or full: keep working in memory */
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function persisted<T>(key: string, initial: T) {
  return atomWithStorage<T>(
    key,
    initial,
    createJSONStorage<T>(() => safeStorage),
    {
      getOnInit: true,
    }
  );
}

/**
 * Repositories saved before signatures existed have no pinned key and cannot be trusted: drop
 * them and mark what was installed from them as having lost its source (it keeps working).
 * Runs once, before the persisted atoms read their storage.
 */
function dropUnpinnedRepositories(): void {
  try {
    const rawRepos = safeStorage.getItem('integrations.repositories');
    if (!rawRepos) return;
    const repos = JSON.parse(rawRepos) as unknown;
    if (!Array.isArray(repos)) return;
    const isPinned = (r: unknown) =>
      typeof r === 'object' &&
      r !== null &&
      typeof (r as RepositoryRecord).key === 'string' &&
      (r as RepositoryRecord).key.length > 0 &&
      typeof (r as RepositoryRecord).fingerprint === 'string' &&
      typeof (r as RepositoryRecord).serial === 'number';
    const kept = repos.filter(isPinned);
    if (kept.length === repos.length) return;
    const droppedUrls = new Set(
      repos.filter((r) => !isPinned(r)).map((r) => (r as { url?: unknown })?.url)
    );
    safeStorage.setItem('integrations.repositories', JSON.stringify(kept));
    const rawInstalled = safeStorage.getItem('integrations.installed');
    if (!rawInstalled) return;
    const installed = JSON.parse(rawInstalled) as unknown;
    if (!Array.isArray(installed)) return;
    safeStorage.setItem(
      'integrations.installed',
      JSON.stringify(
        installed.map((i: InstalledIntegration) =>
          droppedUrls.has(i?.repoUrl) ? { ...i, sourceGone: true } : i
        )
      )
    );
  } catch {
    /* unreadable storage: nothing to migrate */
  }
}
dropUnpinnedRepositories();

export const repositoriesAtom = persisted<RepositoryRecord[]>('integrations.repositories', []);
export const installedIntegrationsAtom = persisted<InstalledIntegration[]>(
  'integrations.installed',
  []
);
export const grantsAtom = persisted<GrantMap>('integrations.grants', {});

export type ActionResult = { ok: true } | { ok: false; error: string };
const ok: ActionResult = { ok: true };
const err = (error: string): ActionResult => ({ ok: false, error });

/** Compares dotted versions numerically where possible; > 0 means `a` is newer. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.\-+]/);
  const pb = b.replace(/^v/i, '').split(/[.\-+]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const x = pa[i] ?? '0';
    const y = pb[i] ?? '0';
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    const d = nx && ny ? Number(x) - Number(y) : x.localeCompare(y);
    if (d !== 0) return d;
  }
  return 0;
}

function grantsFor(permissions: Permissions): Partial<Record<Capability, boolean>> {
  const out: Partial<Record<Capability, boolean>> = {};
  CAPABILITIES.forEach((c) => {
    if (hasCapability(permissions, c)) out[c] = true;
  });
  return out;
}

/** Applies a refreshed repository's integration to an installed one. Permissions only change if not widened. */
function reconcile(
  inst: InstalledIntegration,
  fresh: Integration | undefined
): InstalledIntegration {
  if (!fresh) return inst;
  const widened = permissionsWidened(inst.permissions, fresh.permissions);
  const newer = compareVersions(fresh.version, inst.version) > 0;
  if (widened) {
    // Keep the approved permissions in force until the user re-approves (even if the version
    // did not change: a silent change of what an integration may do is treated as an update).
    return {
      ...inst,
      pendingUpdate: {
        version: fresh.version,
        name: fresh.name,
        description: fresh.description,
        iconUrl: fresh.icon,
        permissions: fresh.permissions,
      },
    };
  }
  const { pendingUpdate: stale, ...rest } = inst;
  if (!newer) return stale ? rest : inst;
  return {
    ...rest,
    version: fresh.version,
    name: fresh.name,
    description: fresh.description,
    // Narrower or equal: safe to take the reduced set.
    permissions: fresh.permissions,
  };
}

export interface RepositoryPreview {
  url: string;
  name: string;
  key: string;
  fingerprint: string;
  serial: number;
  official: boolean;
  integrationCount: number;
  alreadyAdded: boolean;
  /** The verified content, kept so confirming stores exactly what the user was shown. */
  integrations: Integration[];
}

export type PreviewResult = { ok: true; preview: RepositoryPreview } | { ok: false; error: string };

/** Step 1 of adding: fetch and verify, store nothing. The UI shows the key fingerprint. */
export const previewRepositoryAtom = atom(
  null,
  async (get, _set, input: string): Promise<PreviewResult> => {
    const parsed = parseRepoUrl(input);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const res = await fetchRepo(parsed.url);
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      preview: {
        url: parsed.url,
        name: res.value.name,
        key: res.key,
        fingerprint: res.fingerprint,
        serial: res.serial,
        official: res.official,
        integrationCount: res.value.integrations.length,
        alreadyAdded: get(repositoriesAtom).some((r) => r.url === parsed.url),
        integrations: res.value.integrations,
      },
    };
  }
);

/** Step 2 of adding: the user accepted the fingerprint, so the key is pinned. */
export const confirmRepositoryAtom = atom(
  null,
  (get, set, preview: RepositoryPreview): ActionResult => {
    if (get(repositoriesAtom).some((r) => r.url === preview.url))
      return err('That repository is already added');
    const now = Date.now();
    set(repositoriesAtom, (list) => [
      ...list,
      {
        url: preview.url,
        name: preview.name,
        addedAt: now,
        lastFetchedAt: now,
        integrations: preview.integrations,
        key: preview.key,
        fingerprint: preview.fingerprint,
        serial: preview.serial,
        official: preview.official,
        trustedAt: now,
      },
    ]);
    // A repository that returns after being removed re-adopts integrations installed from it,
    // unless they were installed under a different, known key.
    set(installedIntegrationsAtom, (list) =>
      list.map((i) => {
        if (i.repoUrl !== preview.url) return i;
        if (i.publisherFingerprint && i.publisherFingerprint !== preview.fingerprint) return i;
        return {
          ...i,
          sourceGone: undefined,
          publisherFingerprint: preview.fingerprint,
          official: preview.official,
        };
      })
    );
    return ok;
  }
);

/** Removes the repository only. Installed integrations stay, marked as having lost their source. */
export const removeRepositoryAtom = atom(null, (_get, set, url: string) => {
  set(repositoriesAtom, (list) => list.filter((r) => r.url !== url));
  set(installedIntegrationsAtom, (list) =>
    list.map((i) => (i.repoUrl === url ? { ...i, sourceGone: true } : i))
  );
});

export const refreshRepositoryAtom = atom(
  null,
  async (get, set, url: string): Promise<ActionResult> => {
    const current = get(repositoriesAtom).find((r) => r.url === url);
    if (!current) return err('Unknown repository');
    const refuse = (error: string, keyChanged?: boolean): ActionResult => {
      set(repositoriesAtom, (list) =>
        list.map((r) =>
          r.url === url ? { ...r, error, ...(keyChanged ? { keyChanged: true } : {}) } : r
        )
      );
      return err(error);
    };
    const res = await fetchRepo(url);
    if (!res.ok) return refuse(res.error);
    const decision = checkRepoUpdate(
      { key: current.key, serial: current.serial },
      { key: res.key, serial: res.serial }
    );
    if (!decision.ok) return refuse(decision.error, decision.keyChanged);
    set(repositoriesAtom, (list) =>
      list.map((r) =>
        r.url === url
          ? {
              url,
              addedAt: r.addedAt,
              name: res.value.name,
              lastFetchedAt: Date.now(),
              integrations: res.value.integrations,
              key: r.key,
              fingerprint: r.fingerprint,
              serial: res.serial,
              official: res.official,
              trustedAt: r.trustedAt,
            }
          : r
      )
    );
    set(installedIntegrationsAtom, (list) =>
      list.map((i) =>
        i.repoUrl === url
          ? {
              ...reconcile(
                i,
                res.value.integrations.find((f) => f.id === i.id)
              ),
              publisherFingerprint: current.fingerprint,
              official: res.official,
            }
          : i
      )
    );
    return ok;
  }
);

/** Installs with exactly the permissions the user approved (which may be fewer than offered). */
export const installAtom = atom(
  null,
  async (
    get,
    set,
    args: { integration: Integration; repoUrl: string; approved: Permissions }
  ): Promise<ActionResult> => {
    const { integration, repoUrl, approved } = args;
    if (permissionsWidened(integration.permissions, approved))
      return err('Approved permissions exceed what the integration offers');
    const repo = get(repositoriesAtom).find((r) => r.url === repoUrl);
    if (!repo) return err('Unknown repository');
    const iconDataUrl = integration.icon ? await fetchIconDataUrl(integration.icon) : null;
    const entry: InstalledIntegration = {
      id: integration.id,
      repoUrl,
      name: integration.name,
      description: integration.description,
      version: integration.version,
      ...(iconDataUrl ? { iconDataUrl } : {}),
      permissions: approved,
      enabled: true,
      approvedAt: Date.now(),
      publisherFingerprint: repo.fingerprint,
      official: repo.official,
    };
    set(installedIntegrationsAtom, [
      ...get(installedIntegrationsAtom).filter((i) => i.id !== entry.id),
      entry,
    ]);
    set(grantsAtom, (g) => ({ ...g, [entry.id]: grantsFor(approved) }));
    return ok;
  }
);

export const uninstallAtom = atom(null, (_get, set, id: string) => {
  set(installedIntegrationsAtom, (list) => list.filter((i) => i.id !== id));
  set(grantsAtom, (g) => {
    const { [id]: _removed, ...rest } = g;
    return rest;
  });
});

export const setEnabledAtom = atom(null, (_get, set, args: { id: string; enabled: boolean }) => {
  set(installedIntegrationsAtom, (list) =>
    list.map((i) => (i.id === args.id ? { ...i, enabled: args.enabled } : i))
  );
});

/** Turns one capability off (granted: false) or back on, only if it was approved. */
export const setGrantAtom = atom(
  null,
  (get, set, args: { id: string; capability: Capability; granted: boolean }) => {
    const inst = get(installedIntegrationsAtom).find((i) => i.id === args.id);
    if (!inst || !hasCapability(inst.permissions, args.capability)) return;
    set(grantsAtom, (g) => ({
      ...g,
      [args.id]: { ...g[args.id], [args.capability]: args.granted },
    }));
  }
);

/** Accepts the pending update: new permissions take effect and new capabilities are granted. */
export const approveUpdateAtom = atom(null, async (get, set, id: string): Promise<ActionResult> => {
  const inst = get(installedIntegrationsAtom).find((i) => i.id === id);
  const pending = inst?.pendingUpdate;
  if (!inst || !pending) return err('No update pending');
  const iconDataUrl = pending.iconUrl ? await fetchIconDataUrl(pending.iconUrl) : null;
  set(installedIntegrationsAtom, (list) =>
    list.map((i) =>
      i.id === id
        ? {
            ...i,
            version: pending.version,
            name: pending.name,
            description: pending.description,
            permissions: pending.permissions,
            iconDataUrl: iconDataUrl ?? i.iconDataUrl,
            approvedAt: Date.now(),
            pendingUpdate: undefined,
          }
        : i
    )
  );
  set(grantsAtom, (g) => {
    const next = { ...g[id] };
    CAPABILITIES.forEach((c) => {
      // Capabilities the user had switched off stay off; new ones start granted.
      const offered = hasCapability(pending.permissions, c);
      if (offered && next[c] === undefined) next[c] = true;
      if (!offered) delete next[c];
    });
    return { ...g, [id]: next };
  });
  return ok;
});

/** Drops a pending update without applying it. */
export const dismissUpdateAtom = atom(null, (_get, set, id: string) => {
  set(installedIntegrationsAtom, (list) =>
    list.map((i) => (i.id === id ? { ...i, pendingUpdate: undefined } : i))
  );
});
