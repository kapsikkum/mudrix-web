import type { CryptoApi } from 'matrix-js-sdk/lib/crypto-api';

type SecretsBundle = Parameters<NonNullable<CryptoApi['importSecretsBundle']>>[0];

type Pending = { userId: string; deviceId: string; secrets: SecretsBundle; expiresAt: number };

// The secrets are the account's cross-signing and backup keys: keep them for as short a time as
// possible, only in sessionStorage (gone with the tab), and remove them the moment they are used.
const STORAGE_PREFIX = 'mudrix.qrSecrets.';
const PENDING_TTL_MS = 10 * 60 * 1000;
const CROSS_SIGN_ATTEMPTS = 5;
const CROSS_SIGN_RETRY_MS = 3000;

// Adding a second account reloads the page before the first sync, which drops anything held only
// in memory, so a copy lives in sessionStorage too (the memory copy covers storage being blocked).
const memory = new Map<string, Pending>();
let importing = false;
let unreportedFailure = false;
const listeners = new Set<() => void>();
const failureListeners = new Set<() => void>();

const keyFor = (userId: string, deviceId: string) => `${STORAGE_PREFIX}${userId}|${deviceId}`;

function readPending(userId: string, deviceId: string): Pending | null {
  const key = keyFor(userId, deviceId);
  let pending: Pending | null = memory.get(key) ?? null;
  if (!pending) {
    try {
      const raw = sessionStorage.getItem(key);
      pending = raw ? (JSON.parse(raw) as Pending) : null;
    } catch {
      pending = null;
    }
  }
  if (pending && (pending.expiresAt <= Date.now() || !pending.secrets)) {
    clearPendingQrSecrets(userId, deviceId);
    return null;
  }
  return pending;
}

export function clearPendingQrSecrets(userId: string, deviceId: string): void {
  const key = keyFor(userId, deviceId);
  memory.delete(key);
  try {
    sessionStorage.removeItem(key);
  } catch {
    // storage unavailable: the memory copy is already gone
  }
}

/** Whether the shared secrets of this session are waiting for, or in the middle of, being applied. */
export function isQrImportPending(userId?: string, deviceId?: string): boolean {
  if (importing) return true;
  if (userId && deviceId) return readPending(userId, deviceId) !== null;
  return memory.size > 0;
}

export function setPendingQrSecrets(
  userId: string,
  deviceId: string,
  secrets: SecretsBundle
): void {
  const pending: Pending = { userId, deviceId, secrets, expiresAt: Date.now() + PENDING_TTL_MS };
  memory.set(keyFor(userId, deviceId), pending);
  try {
    sessionStorage.setItem(keyFor(userId, deviceId), JSON.stringify(pending));
  } catch {
    // storage unavailable: a reload before the first sync will lose them, nothing else
  }
}

/** Runs when an import finishes, worked or not, e.g. to look at the session's trust again. */
export function onQrImportSettled(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Runs when an import failed. A failure that happens before anyone is listening is delivered to
 * the next listener, so it is never silently lost.
 */
export function onQrImportFailed(cb: () => void): () => void {
  failureListeners.add(cb);
  if (unreportedFailure) {
    unreportedFailure = false;
    cb();
  }
  return () => {
    failureListeners.delete(cb);
  };
}

function settle(ok: boolean): void {
  importing = false;
  if (!ok) {
    if (failureListeners.size === 0) unreportedFailure = true;
    [...failureListeners].forEach((cb) => cb());
  }
  [...listeners].forEach((cb) => cb());
}

async function withRetries<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < CROSS_SIGN_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, CROSS_SIGN_RETRY_MS));
    try {
      return await run();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export async function applyPendingQrSecrets(
  crypto: CryptoApi,
  userId: string,
  deviceId: string
): Promise<void> {
  const pending = readPending(userId, deviceId);
  if (!pending) return;
  // Mark the import before the secrets leave storage, so there is no gap where it looks finished.
  importing = true;
  clearPendingQrSecrets(userId, deviceId);
  try {
    await crypto.importSecretsBundle?.(pending.secrets);
    // This device's keys are uploaded by the first sync, but that can lag a little behind it.
    await withRetries(() => crypto.crossSignDevice(deviceId));
    await withRetries(() => crypto.checkKeyBackupAndEnable());
    settle(true);
  } catch (err) {
    console.error('[qrLogin] importing the shared secrets failed', err);
    settle(false);
  }
}
