import { useEffect, useSyncExternalStore } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api';

/**
 * A small, shared view of "can this device read old messages?".
 *
 * Many components (undecryptable-message placeholders, settings) need the same few facts about the
 * local crypto state. This store computes them once, keeps them fresh from SDK events, and never
 * holds any key material (only booleans / version strings).
 */
export interface RecoverySnapshot {
  loaded: boolean;
  /** This device is signed by the account's cross-signing identity. */
  deviceVerified: boolean;
  /** The account has secret storage (4S), i.e. a recovery key can unlock cross-signing and backup. */
  secretStorageExists: boolean;
  /** A key backup exists on the server. */
  backupExists: boolean;
  backupVersion: string | null;
  /** The server backup is trusted by this device. */
  backupTrusted: boolean;
  /** The backup decryption key is cached on this device. */
  backupKeyCached: boolean;
  /** This device is actively using the backup (trusted + key cached). */
  backupActive: boolean;
}

const EMPTY: RecoverySnapshot = {
  loaded: false,
  deviceVerified: false,
  secretStorageExists: false,
  backupExists: false,
  backupVersion: null,
  backupTrusted: false,
  backupKeyCached: false,
  backupActive: false,
};

let snapshot: RecoverySnapshot = EMPTY;
let refreshSeq = 0;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let boundClient: MatrixClient | null = null;
let unbind: (() => void) | null = null;
let users = 0;
const listeners = new Set<() => void>();

const WATCHED_EVENTS = [
  CryptoEvent.KeyBackupStatus,
  CryptoEvent.KeyBackupFailed,
  CryptoEvent.KeyBackupDecryptionKeyCached,
  CryptoEvent.UserTrustStatusChanged,
  CryptoEvent.DevicesUpdated,
  CryptoEvent.KeysChanged,
] as const;

function sameSnapshot(a: RecoverySnapshot, b: RecoverySnapshot): boolean {
  return (
    a.loaded === b.loaded &&
    a.deviceVerified === b.deviceVerified &&
    a.secretStorageExists === b.secretStorageExists &&
    a.backupExists === b.backupExists &&
    a.backupVersion === b.backupVersion &&
    a.backupTrusted === b.backupTrusted &&
    a.backupKeyCached === b.backupKeyCached &&
    a.backupActive === b.backupActive
  );
}

async function compute(client: MatrixClient): Promise<RecoverySnapshot> {
  const crypto = client.getCrypto();
  const userId = client.getUserId();
  const deviceId = client.getDeviceId();
  if (!crypto || !userId || !deviceId) return { ...EMPTY, loaded: true };

  const [deviceStatus, secretStorage, backupInfo, activeVersion, backupKey] = await Promise.all([
    crypto.getDeviceVerificationStatus(userId, deviceId).catch(() => null),
    crypto.getSecretStorageStatus().catch(() => null),
    crypto.getKeyBackupInfo().catch(() => null),
    crypto.getActiveSessionBackupVersion().catch(() => null),
    crypto.getSessionBackupPrivateKey().catch(() => null),
  ]);

  let backupTrusted = false;
  if (backupInfo) {
    try {
      backupTrusted = (await crypto.isKeyBackupTrusted(backupInfo)).trusted;
    } catch {
      backupTrusted = false;
    }
  }

  return {
    loaded: true,
    deviceVerified: deviceStatus?.crossSigningVerified ?? false,
    secretStorageExists: Boolean(secretStorage?.defaultKeyId),
    backupExists: Boolean(backupInfo?.version),
    backupVersion: backupInfo?.version ?? null,
    backupTrusted,
    backupKeyCached: backupKey !== null,
    backupActive: activeVersion !== null,
  };
}

function publish(next: RecoverySnapshot): void {
  if (sameSnapshot(snapshot, next)) return;
  snapshot = next;
  listeners.forEach((l) => l());
}

export function refreshRecoverySnapshot(client: MatrixClient | null): Promise<void> {
  if (!client) return Promise.resolve();
  refreshSeq += 1;
  const seq = refreshSeq;
  return compute(client)
    .then((next) => {
      // A newer refresh (or a different client) superseded this one.
      if (seq !== refreshSeq || boundClient !== client) return;
      publish(next);
    })
    .catch(() => {
      // Crypto not ready yet; the next event will refresh.
    });
}

function scheduleRefresh(client: MatrixClient): void {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshRecoverySnapshot(client);
  }, 250);
}

function bind(client: MatrixClient): void {
  unbind?.();
  boundClient = client;
  snapshot = EMPTY;
  const handler = () => scheduleRefresh(client);
  WATCHED_EVENTS.forEach((ev) => client.on(ev as Parameters<typeof client.on>[0], handler));
  unbind = () => {
    clearTimeout(refreshTimer);
    WATCHED_EVENTS.forEach((ev) => client.off(ev as Parameters<typeof client.off>[0], handler));
    unbind = null;
    boundClient = null;
  };
  refreshRecoverySnapshot(client);
}

function acquire(client: MatrixClient | null): () => void {
  if (!client) return () => {};
  users += 1;
  if (boundClient !== client) bind(client);
  else if (!snapshot.loaded) refreshRecoverySnapshot(client);
  return () => {
    users -= 1;
    if (users <= 0) {
      users = 0;
      unbind?.();
    }
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): RecoverySnapshot {
  return snapshot;
}

export function useRecoverySnapshot(client: MatrixClient | null): RecoverySnapshot {
  useEffect(() => acquire(client), [client]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
