import { createClient, IndexedDBStore, MatrixClient } from 'matrix-js-sdk';
import type { MatrixCredentials } from './types';
import { STORAGE_KEY_CREDENTIALS, STORAGE_KEY_DEVICE_ID_PREFIX } from '@/const/storageKeys';

let _client: MatrixClient | null = null;

export function getMatrixClient(): MatrixClient {
  const client = getMatrixClientOrNull();
  if (!client) throw new Error('MatrixClient not initialized');
  return client;
}

export function getMatrixClientOrNull(): MatrixClient | null {
  return _client;
}

export function normalizeUrl(url: string): string {
  let clean = url.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean;
}

function createStore(userId: string) {
  return new IndexedDBStore({
    indexedDB: window.indexedDB,
    dbName: `matrix-store-${userId}`,
    localStorage: window.localStorage,
  });
}

function saveCredentials(client: MatrixClient): MatrixCredentials {
  const credentials: MatrixCredentials = {
    userId: client.getUserId() ?? '',
    accessToken: client.getAccessToken() ?? '',
    homeserverUrl: client.getHomeserverUrl(),
    deviceId: client.getDeviceId() ?? '',
  };
  localStorage.setItem(STORAGE_KEY_CREDENTIALS, JSON.stringify(credentials));
  return credentials;
}

export function loadCredentials(): MatrixCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CREDENTIALS);
    return raw ? (JSON.parse(raw) as MatrixCredentials) : null;
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  localStorage.removeItem(STORAGE_KEY_CREDENTIALS);
}

export function prewarmCrypto(): void {
  import('@matrix-org/matrix-sdk-crypto-wasm')
    .then((mod) => mod.initAsync())
    .catch(() => {
      // Non-fatal, initRustCrypto() will redo this itself if it has to.
    });
}

export async function login(
  username: string,
  password: string,
  homeserverUrl: string
): Promise<{ client: MatrixClient; credentials: MatrixCredentials }> {
  const baseUrl = normalizeUrl(homeserverUrl);
  const matrixId = username.startsWith('@')
    ? username
    : `@${username}:${new URL(baseUrl).hostname}`;

  await clearSessionData(matrixId);

  const deviceId = Math.random().toString(36).substring(2, 15);

  const store = createStore(matrixId);

  const client = createClient({
    baseUrl,
    deviceId,
    store,
    cryptoCallbacks: {},
    // Allow stun:turn.matrix.org as fallback ICE server when the homeserver
    // does not advertise TURN credentials via /voip/turnServer.
    // The SDK automatically queries the homeserver for TURN servers before
    // each call and uses these credentials if available.
    fallbackICEServerAllowed: true,
  });

  await store.startup();

  await client.login('m.login.password', {
    user: matrixId,
    password,
    device_id: deviceId,
    initial_device_display_name: 'WizardChat Web',
  });

  await client.initRustCrypto();
  await client.startClient({
    lazyLoadMembers: true,
  });

  _client = client;
  const credentials = saveCredentials(client);
  return { client, credentials };
}

export async function resume(
  credentials: MatrixCredentials,
  onFirstSync?: () => void
): Promise<MatrixClient> {
  const baseUrl = normalizeUrl(credentials.homeserverUrl);
  const store = createStore(credentials.userId);

  const client = createClient({
    baseUrl,
    userId: credentials.userId,
    accessToken: credentials.accessToken,
    deviceId: credentials.deviceId,
    store,
    cryptoCallbacks: {},
    fallbackICEServerAllowed: true,
  });

  await Promise.all([
    store.startup(),
    import('@matrix-org/matrix-sdk-crypto-wasm').then((mod) => mod.initAsync()),
  ]);

  await client.initRustCrypto();

  // Register the first-sync listener BEFORE startClient so we never miss it.
  if (onFirstSync) {
    const handler = (state: string) => {
      if (state === 'PREPARED' || state === 'CATCHUP') {
        client.off('sync' as Parameters<typeof client.off>[0], handler);
        onFirstSync();
      }
    };
    client.on('sync' as Parameters<typeof client.on>[0], handler);
  }

  await client.startClient({
    lazyLoadMembers: true,
  });

  _client = client;
  return client;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve(); // best effort — resolve either way
    req.onblocked = () => resolve();
  });
}

async function clearSessionData(userId?: string | null): Promise<void> {
  await Promise.all([
    deleteDatabase('matrix-js-sdk::matrix-sdk-crypto'),
    deleteDatabase('matrix-js-sdk::matrix-sdk-crypto-meta'),
    ...(userId ? [deleteDatabase(`matrix-store-${userId}`)] : []),
  ]);

  localStorage.removeItem(STORAGE_KEY_CREDENTIALS);
  Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_KEY_DEVICE_ID_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}

export async function logout(): Promise<void> {
  const userId = _client?.getUserId() ?? null;
  _client = null;
  await clearSessionData(userId);
  window.location.reload();
}
