import type { Capability, Integration, Permissions } from './manifest';

export interface RepositoryRecord {
  /** The URL actually fetched (a github.com URL is stored as its raw repo.json URL). */
  url: string;
  name: string;
  addedAt: number;
  lastFetchedAt: number | null;
  integrations: Integration[];
  /** Why the last fetch failed; the previous integrations are kept. */
  error?: string;
}

export interface PendingUpdate {
  version: string;
  name: string;
  description: string;
  iconUrl?: string;
  /** Not in force until approved. */
  permissions: Permissions;
}

export interface InstalledIntegration {
  id: string;
  repoUrl: string;
  name: string;
  description: string;
  version: string;
  iconDataUrl?: string;
  /** Exactly what the user approved. Only this is ever acted on. */
  permissions: Permissions;
  enabled: boolean;
  approvedAt: number;
  /** The repository it came from was removed. */
  sourceGone?: boolean;
  pendingUpdate?: PendingUpdate;
}

/** Per integration id: capability -> still granted. Missing means not granted. */
export type GrantMap = Record<string, Partial<Record<Capability, boolean>>>;
