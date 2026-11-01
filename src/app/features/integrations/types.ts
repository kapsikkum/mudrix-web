import type { Capability, Integration, Permissions } from './manifest';

export interface RepositoryRecord {
  /** The URL actually fetched (a github.com URL is stored as its raw repo.json URL). */
  url: string;
  name: string;
  addedAt: number;
  lastFetchedAt: number | null;
  integrations: Integration[];
  /** The pinned signing key (base64 of the raw 32 bytes), trusted on first use. */
  key: string;
  /** Grouped hex fingerprint of `key`. */
  fingerprint: string;
  /** Highest serial seen; a lower one is refused. */
  serial: number;
  /** The pinned key is one built into the app. */
  official: boolean;
  /** When the user pinned the key. */
  trustedAt: number;
  /** Why the last fetch failed; the previous integrations are kept. */
  error?: string;
  /** The last fetch was signed by a different key than the pinned one and was refused. */
  keyChanged?: boolean;
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
  /** Fingerprint of the repository's pinned key when installed (kept in sync on refresh). */
  publisherFingerprint?: string;
  /** The repository's key was the official one. */
  official?: boolean;
  pendingUpdate?: PendingUpdate;
}

/** Per integration id: capability -> still granted. Missing means not granted. */
export type GrantMap = Record<string, Partial<Record<Capability, boolean>>>;
