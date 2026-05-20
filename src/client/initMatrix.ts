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

function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
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

export async function login(
  username: string,
  password: string,
  homeserverUrl: string
): Promise<{ client: MatrixClient; credentials: MatrixCredentials }> {
  const baseUrl = normalizeUrl(homeserverUrl);
  const matrixId = username.startsWith('@')
    ? username
    : `@${username}:${new URL(baseUrl).hostname}`;

  // Persist device ID per user so devices don't multiply on re-login
  let deviceId = localStorage.getItem(`${STORAGE_KEY_DEVICE_ID_PREFIX}${matrixId}`);
  if (!deviceId) {
    deviceId = `device-${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(`${STORAGE_KEY_DEVICE_ID_PREFIX}${matrixId}`, deviceId);
  }

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

  // startup() must be called after assigning the store to the client so the
  // SDK can set store.createUser before startup loads presence events.
  await store.startup();

  await client.login('m.login.password', {
    user: matrixId,
    password,
    device_id: deviceId,
  });

  await client.initRustCrypto();
  await client.startClient();

  _client = client;
  const credentials = saveCredentials(client);
  return { client, credentials };
}

export async function resume(credentials: MatrixCredentials): Promise<MatrixClient> {
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

  // startup() must be called after assigning the store to the client so the
  // SDK can set store.createUser before startup loads presence events.
  await store.startup();

  await client.initRustCrypto();
  await client.startClient();

  _client = client;
  return client;
}

export async function logout(): Promise<void> {
  if (_client) {
    try {
      await _client.logout(true);
    } catch {
      // Best effort — still clear local state
    }
    _client.stopClient();
    _client = null;
  }
  clearCredentials();
}
