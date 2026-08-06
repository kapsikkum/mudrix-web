import { createClient, IndexedDBStore, MatrixClient, Method } from 'matrix-js-sdk';
import type { MatrixCredentials } from './types';
import { STORAGE_KEY_CREDENTIALS, STORAGE_KEY_DEVICE_ID_PREFIX } from '@/const/storageKeys';
import type { MatrixError } from 'matrix-js-sdk/lib/http-api';

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in_ms?: number;
}

interface ClientFactoryOpts {
  baseUrl: string;
  userId: string;
  accessToken: string;
  deviceId: string;
  store: IndexedDBStore;
  refreshToken?: string;
}

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

function persistCredentials(credentials: MatrixCredentials): void {
  localStorage.setItem(STORAGE_KEY_CREDENTIALS, JSON.stringify(credentials));
}

async function refreshTokens(
  client: MatrixClient,
  refreshToken: string
): Promise<RefreshTokenResponse> {
  const body = { refresh_token: refreshToken };
  try {
    return await client.http.request(Method.Post, '/refresh', undefined, body, {
      prefix: '/_matrix/client/v3',
    });
  } catch (e) {
    if ((e as MatrixError).errcode === 'M_UNRECOGNIZED') {
      return await client.http.request(Method.Post, '/refresh', undefined, body, {
        prefix: '/_matrix/client/v1',
      });
    }
    throw e;
  }
}

function createAuthenticatedClient({
  baseUrl,
  userId,
  accessToken,
  deviceId,
  store,
  refreshToken,
}: ClientFactoryOpts): MatrixClient {
  const client = createClient({
    baseUrl,
    userId,
    accessToken,
    deviceId,
    store,
    cryptoCallbacks: {},
    fallbackICEServerAllowed: true,
    timelineSupport: true,
    refreshToken,
    tokenRefreshFunction: refreshToken
      ? async (token) => {
          const res = await refreshTokens(client, token);
          const prev = loadCredentials();
          persistCredentials({
            userId: prev?.userId ?? userId,
            deviceId: prev?.deviceId ?? deviceId,
            homeserverUrl: prev?.homeserverUrl ?? baseUrl,
            accessToken: res.access_token,
            refreshToken: res.refresh_token ?? token,
            expiresInMs: res.expires_in_ms,
          });
          sendSessionToSW(client);
          return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token,
            expiry:
              typeof res.expires_in_ms === 'number'
                ? new Date(Date.now() + res.expires_in_ms)
                : undefined,
          };
        }
      : undefined,
  });
  return client;
}

export async function requestPersistentStorage(): Promise<void> {
  if (!navigator.storage?.persist) return;
  try {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) await navigator.storage.persist();
  } catch {
    // best effort — storage eviction is a browser-level policy
  }
}

function setupSWMessageListener(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'requestSession') {
      const creds = loadCredentials();
      if (creds?.accessToken && creds?.homeserverUrl) {
        event.source?.postMessage({
          type: 'setSession',
          accessToken: creds.accessToken,
          baseUrl: creds.homeserverUrl,
        });
      }
    }
  });
}

// Register the listener early so the SW can always reach it
setupSWMessageListener();

async function sendSessionToSW(client: MatrixClient): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({
      type: 'setSession',
      accessToken: client.getAccessToken(),
      baseUrl: client.baseUrl ?? client.getHomeserverUrl(),
    });
  } catch {
    /* noop */
  }
}

function saveCredentials(
  client: MatrixClient,
  homeserverUrl?: string,
  refreshToken?: string,
  expiresInMs?: number
): MatrixCredentials {
  const credentials: MatrixCredentials = {
    userId: client.getUserId() ?? '',
    accessToken: client.getAccessToken() ?? '',
    homeserverUrl: homeserverUrl ?? client.getHomeserverUrl(),
    deviceId: client.getDeviceId() ?? '',
    refreshToken,
    expiresInMs,
  };
  persistCredentials(credentials);
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

  // Create a temporary client to perform the login request.
  // loginRequest does NOT mutate the client instance (unlike the deprecated login()),
  // so we create the authenticated client from the response below.
  const tempClient = createClient({ baseUrl });

  const loginResponse = await tempClient.loginRequest({
    type: 'm.login.password',
    user: matrixId,
    password,
    device_id: deviceId,
    refresh_token: true,
    initial_device_display_name: 'WizardChat Web',
  });

  const client = createAuthenticatedClient({
    baseUrl,
    userId: loginResponse.user_id,
    accessToken: loginResponse.access_token,
    deviceId: loginResponse.device_id,
    store,
    refreshToken: loginResponse.refresh_token,
  });

  await store.startup();
  await client.initRustCrypto();
  await client.startClient({
    lazyLoadMembers: true,
    clientWellKnownPollPeriod: 86400,
    initialSyncLimit: 20,
    threadSupport: true,
  });

  _client = client;
  const resolvedHsUrl = loginResponse.well_known?.['m.homeserver']?.base_url ?? undefined;
  const credentials = saveCredentials(
    client,
    resolvedHsUrl,
    loginResponse.refresh_token,
    loginResponse.expires_in_ms
  );
  sendSessionToSW(client);
  requestPersistentStorage();
  return { client, credentials };
}

export async function resume(
  credentials: MatrixCredentials,
  onFirstSync?: () => void
): Promise<MatrixClient> {
  const baseUrl = normalizeUrl(credentials.homeserverUrl);
  const store = createStore(credentials.userId);

  const client = createAuthenticatedClient({
    baseUrl,
    userId: credentials.userId,
    accessToken: credentials.accessToken,
    deviceId: credentials.deviceId,
    store,
    refreshToken: credentials.refreshToken,
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
    clientWellKnownPollPeriod: 86400,
    initialSyncLimit: 20,
    threadSupport: true,
  });

  _client = client;
  sendSessionToSW(client);
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
