import { useSyncExternalStore } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { ImportRoomKeyStage } from 'matrix-js-sdk/lib/crypto-api';
import type { KeyBackupRestoreResult } from 'matrix-js-sdk/lib/crypto-api';
import type { CryptoBackend } from 'matrix-js-sdk/lib/common-crypto/CryptoBackend';
import { refreshRecoverySnapshot } from './recoveryState';

export type KeyBackupRestorePhase = 'idle' | 'running' | 'done' | 'error';

export interface KeyBackupRestoreState {
  phase: KeyBackupRestorePhase;
  /** True while the encrypted backup is still being downloaded (total not known yet). */
  fetching: boolean;
  imported: number;
  failed: number;
  total: number;
  error: string | null;
}

const IDLE: KeyBackupRestoreState = {
  phase: 'idle',
  fetching: false,
  imported: 0,
  failed: 0,
  total: 0,
  error: null,
};

let state: KeyBackupRestoreState = IDLE;
let inFlight: Promise<KeyBackupRestoreResult> | null = null;
const listeners = new Set<() => void>();

function setState(next: KeyBackupRestoreState): void {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getState(): KeyBackupRestoreState {
  return state;
}

export function useKeyBackupRestoreState(): KeyBackupRestoreState {
  return useSyncExternalStore(subscribe, getState, getState);
}

const RESTORED_KEY_PREFIX = 'mudrix.keyBackupRestored::';

function restoredStorageKey(client: MatrixClient): string | null {
  const userId = client.getUserId();
  // Ends with `::<userId>` so it is wiped together with the rest of the account's local data on logout.
  return userId ? `${RESTORED_KEY_PREFIX}${userId}` : null;
}

/** Whether a full restore of this backup version already completed on this device. */
export function hasRestoredBackupVersion(client: MatrixClient, version: string): boolean {
  const key = restoredStorageKey(client);
  if (!key) return false;
  try {
    return localStorage.getItem(key) === `${client.getDeviceId() ?? ''}:${version}`;
  } catch {
    return false;
  }
}

function markRestoredBackupVersion(client: MatrixClient, version: string | null): void {
  const key = restoredStorageKey(client);
  if (!key || !version) return;
  try {
    localStorage.setItem(key, `${client.getDeviceId() ?? ''}:${version}`);
  } catch {
    // Storage unavailable: worst case the restore is repeated on the next start.
  }
}

/**
 * Download and import every room key from the server-side key backup.
 *
 * Requires the backup decryption key to already be cached on this device (it is after the recovery
 * key was entered, or after verification with another device). Only one restore runs at a time;
 * concurrent callers share the same promise. Events that were waiting on those keys are
 * re-decrypted by the SDK as the keys are imported.
 */
export function restoreKeyBackupNow(client: MatrixClient): Promise<KeyBackupRestoreResult> {
  if (inFlight) return inFlight;

  const crypto = client.getCrypto();
  if (!crypto) return Promise.reject(new Error('Crypto not available'));

  let lastPublish = 0;
  setState({ ...IDLE, phase: 'running', fetching: true });

  inFlight = (async () => {
    try {
      const check = await crypto.checkKeyBackupAndEnable();
      const version = check?.backupInfo?.version ?? (await crypto.getActiveSessionBackupVersion());

      const result = await crypto.restoreKeyBackup({
        progressCallback: (progress) => {
          if (progress.stage === ImportRoomKeyStage.Fetch) {
            setState({ ...state, phase: 'running', fetching: true });
            return;
          }
          const now = Date.now();
          if (now - lastPublish < 200) return;
          lastPublish = now;
          setState({
            phase: 'running',
            fetching: false,
            imported: progress.successes,
            failed: progress.failures,
            total: progress.total,
            error: null,
          });
        },
      });

      markRestoredBackupVersion(client, version);
      setState({
        phase: 'done',
        fetching: false,
        imported: result.imported,
        failed: Math.max(0, result.total - result.imported),
        total: result.total,
        error: null,
      });
      return result;
    } catch (err) {
      setState({
        ...IDLE,
        phase: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      inFlight = null;
      refreshRecoverySnapshot(client);
    }
  })();

  return inFlight;
}

/**
 * Ask the SDK to try decrypting these events again.
 *
 * Refreshes the key-backup state first, so a backup that became usable since the first attempt is
 * picked up. A failed decryption of a missing session also queues a download of that single
 * session from the key backup (when the backup key is cached), which is the on-demand path.
 * No device is trusted and no verification is skipped.
 */
export async function retryDecryption(
  client: MatrixClient,
  events: readonly MatrixEvent[]
): Promise<void> {
  const crypto = client.getCrypto();
  if (!crypto) return;
  try {
    await crypto.checkKeyBackupAndEnable();
  } catch {
    // Backup check is best effort; the decryption retry below still runs.
  }
  await Promise.all(
    events
      .filter((e) => e.isDecryptionFailure() && !e.isBeingDecrypted())
      .map((e) =>
        // `attemptDecryption` is how the SDK itself retries after receiving keys. The rust crypto
        // implementation is the `CryptoBackend`, `getCrypto()` just exposes it as the public API.
        e.attemptDecryption(crypto as unknown as CryptoBackend, { isRetry: true }).catch(() => {})
      )
  );
}

/** Retry every undecryptable event currently loaded for the room. */
export async function retryRoomDecryption(client: MatrixClient, roomId: string): Promise<void> {
  const room = client.getRoom(roomId);
  if (!room) return;
  const events = room
    .getUnfilteredTimelineSet()
    .getTimelines()
    .flatMap((timeline) => timeline.getEvents());
  await retryDecryption(client, events);
}
