import { createClient, IndexedDBStore, MatrixClient, Method } from 'matrix-js-sdk';
import { OidcTokenRefresher } from 'matrix-js-sdk/lib/oidc';
import type { AccessTokens } from 'matrix-js-sdk/lib/http-api';
import type { UserIdentifier } from 'matrix-js-sdk/lib/@types/auth';
import type { MatrixCredentials, OidcSession } from './types';
import { applySavedSettingsToLocalStorage } from './settingsSync';
import { revokeOidcSession } from '@/app/features/oidc/oidc';
import {
  STORAGE_KEY_ACCOUNTS,
  STORAGE_KEY_ACTIVE_ACCOUNT,
  STORAGE_KEY_CREDENTIALS,
  STORAGE_KEY_DEVICE_ID_PREFIX,
} from '@/const/storageKeys';
import { setStoredUserId } from '@/const/accountStorage';
import { deleteThumbCache } from '@/app/components/Avatar/thumbCache';
import { clearMediaCache, mediaCacheDbName } from '@/app/features/timeline/message/mediaCache';
import {
  getAccount,
  getActiveAccountId,
  listAccounts,
  removeAccount,
  setActiveAccountId,
  upsertAccount,
} from './accounts';
import type { MatrixError } from 'matrix-js-sdk/lib/http-api';
import { setActiveMatrixClient } from './clientHolder';
import { defaultDeviceName } from '@/util/desktop';
import {
  clearSlidingSync,
  createSlidingSync,
  seedOwnProfile,
  isSlidingSyncEnabled,
  serverSupportsSlidingSync,
} from './slidingSync';

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
  oidc?: OidcSession;
}

let _client: MatrixClient | null = null;
let _resumePromise: Promise<MatrixClient> | null = null;
let _resumeUserId: string | null = null;
let _firstSyncResolved = false;
const _firstSyncCallbacks = new Set<() => void>();

function subscribeToFirstSync(cb: () => void): void {
  if (_firstSyncResolved) {
    cb();
    return;
  }
  _firstSyncCallbacks.add(cb);
}

function notifyFirstSync(): void {
  _firstSyncResolved = true;
  _firstSyncCallbacks.forEach((cb) => cb());
  _firstSyncCallbacks.clear();
}

function resetFirstSyncState(): void {
  _firstSyncResolved = false;
  _firstSyncCallbacks.clear();
}

export function getMatrixClient(): MatrixClient {
  const client = getMatrixClientOrNull();
  if (!client) throw new Error('MatrixClient not initialized');
  return client;
}

export function getMatrixClientOrNull(): MatrixClient | null {
  return _client;
}

export function normalizeUrl(url: string): string {
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    return `https://${clean}`;
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

export function persistCredentials(credentials: MatrixCredentials): void {
  upsertAccount({
    ...credentials,
    expiresAt:
      credentials.expiresAt ??
      (credentials.expiresInMs ? Date.now() + credentials.expiresInMs : undefined),
  });
  setActiveAccountId(credentials.userId);
  setStoredUserId(credentials.userId);
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

// Serialise token refreshes across tabs: with refresh-token rotation a second tab refreshing with
// an already-used refresh token would be rejected and the session logged out.
async function withRefreshLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return fn();
  return await navigator.locks.request(`mudrix-token-refresh:${userId}`, fn);
}

function createAuthenticatedClient({
  baseUrl,
  userId,
  accessToken,
  deviceId,
  store,
  refreshToken,
  oidc,
}: ClientFactoryOpts): MatrixClient {
  const oidcRefresher = oidc
    ? new OidcTokenRefresher(
        oidc.issuer,
        oidc.clientId,
        oidc.redirectUri,
        deviceId,
        oidc.idTokenClaims as unknown as ConstructorParameters<typeof OidcTokenRefresher>[4]
      )
    : null;

  const persistRefreshed = (tokens: AccessTokens): void => {
    const prev = getAccount(userId);
    upsertAccount({
      userId,
      deviceId: prev?.deviceId ?? deviceId,
      homeserverUrl: prev?.homeserverUrl ?? baseUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? prev?.refreshToken ?? refreshToken,
      expiresInMs: tokens.expiry ? tokens.expiry.getTime() - Date.now() : prev?.expiresInMs,
      expiresAt: tokens.expiry ? tokens.expiry.getTime() : undefined,
      oidc: prev?.oidc ?? oidc,
    });
    sendSessionToSW(client);
  };

  // Runs `doRefresh` under the cross-tab lock. If another tab already rotated the tokens while we
  // waited (the stored refresh token differs from the one we were about to use), adopt those
  // instead of calling the server with a spent refresh token. The SDK copies the returned tokens
  // into its own http opts, so its refresh token stays in sync.
  const refreshExclusive = (
    token: string,
    doRefresh: () => Promise<AccessTokens>
  ): Promise<AccessTokens> =>
    withRefreshLock(userId, async () => {
      const stored = getAccount(userId);
      if (stored?.accessToken && stored.refreshToken && stored.refreshToken !== token) {
        sendSessionToSW(client);
        return {
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          expiry: stored.expiresAt ? new Date(stored.expiresAt) : undefined,
        };
      }
      const tokens = await doRefresh();
      persistRefreshed(tokens);
      return tokens;
    });

  const tokenRefreshFunction = oidcRefresher
    ? (token: string): Promise<AccessTokens> =>
        refreshExclusive(token, () => oidcRefresher.doRefreshAccessToken(token))
    : refreshToken
      ? (token: string): Promise<AccessTokens> =>
          refreshExclusive(token, async () => {
            const res = await refreshTokens(client, token);
            return {
              accessToken: res.access_token,
              refreshToken: res.refresh_token,
              expiry:
                typeof res.expires_in_ms === 'number'
                  ? new Date(Date.now() + res.expires_in_ms)
                  : undefined,
            };
          })
      : undefined;

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
    tokenRefreshFunction,
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
      // Reply with this tab's own account; only fall back to the stored active account before a
      // client exists.
      const client = getMatrixClientOrNull();
      const accessToken = client ? client.getAccessToken() : loadCredentials()?.accessToken;
      const baseUrl = client
        ? (client.baseUrl ?? client.getHomeserverUrl())
        : loadCredentials()?.homeserverUrl;
      if (accessToken && baseUrl) {
        event.source?.postMessage({ type: 'setSession', accessToken, baseUrl });
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

export function loadCredentials(): MatrixCredentials | null {
  const activeId = getActiveAccountId();
  if (!activeId) return null;
  return getAccount(activeId);
}

export function prewarmCrypto(): void {
  import('@matrix-org/matrix-sdk-crypto-wasm')
    .then((mod) => mod.initAsync())
    .catch(() => {
      // Non-fatal, initRustCrypto() will redo this itself if it has to.
    });
}

/**
 * Password login. `user` is a user name / id, or a ready `identifier` object (an email or phone
 * number bound to the account: `{ type: 'm.id.thirdparty', medium, address }`).
 */
export async function login(
  user: string | UserIdentifier,
  password: string,
  homeserverUrl: string
): Promise<{ credentials: MatrixCredentials; userId: string }> {
  const baseUrl = normalizeUrl(homeserverUrl);

  const deviceId = crypto.randomUUID();

  // Create a temporary client to perform the login request.
  // loginRequest does NOT mutate the client instance (unlike the deprecated login()),
  // so the authenticated client is built once by resume()/RequireAuth afterwards.
  const tempClient = createClient({ baseUrl });

  const loginResponse = await tempClient.loginRequest({
    type: 'm.login.password',
    identifier: typeof user === 'string' ? { type: 'm.id.user', user } : user,
    password,
    device_id: deviceId,
    refresh_token: true,
    initial_device_display_name: defaultDeviceName(),
  });

  const resolvedHsUrl = loginResponse.well_known?.['m.homeserver']?.base_url ?? undefined;
  const credentials: MatrixCredentials = {
    userId: loginResponse.user_id,
    accessToken: loginResponse.access_token,
    deviceId: loginResponse.device_id,
    homeserverUrl: resolvedHsUrl ?? baseUrl,
    refreshToken: loginResponse.refresh_token,
    expiresInMs: loginResponse.expires_in_ms,
  };

  await resetClientForNewSession(credentials.userId);

  persistCredentials(credentials);
  requestPersistentStorage();
  return { credentials, userId: credentials.userId };
}

export async function resume(
  credentials: MatrixCredentials,
  onFirstSync?: () => void
): Promise<MatrixClient> {
  const existing = getMatrixClientOrNull();
  if (
    existing &&
    existing.getSyncState() !== 'STOPPED' &&
    existing.getUserId() === credentials.userId
  ) {
    if (onFirstSync) subscribeToFirstSync(onFirstSync);
    return existing;
  }

  if (_resumePromise && _resumeUserId === credentials.userId) {
    if (onFirstSync) subscribeToFirstSync(onFirstSync);
    return _resumePromise;
  }
  if (existing) {
    existing.stopClient();
    resetFirstSyncState();
  }

  if (onFirstSync) subscribeToFirstSync(onFirstSync);

  _resumeUserId = credentials.userId;
  _resumePromise = buildResumedClient(credentials);
  try {
    return await _resumePromise;
  } finally {
    _resumePromise = null;
    _resumeUserId = null;
  }
}

async function buildResumedClient(credentials: MatrixCredentials): Promise<MatrixClient> {
  const baseUrl = normalizeUrl(credentials.homeserverUrl);
  const store = createStore(credentials.userId);

  const client = createAuthenticatedClient({
    baseUrl,
    userId: credentials.userId,
    accessToken: credentials.accessToken,
    deviceId: credentials.deviceId,
    store,
    refreshToken: credentials.refreshToken,
    oidc: credentials.oidc,
  });

  await Promise.all([
    store.startup(),
    import('@matrix-org/matrix-sdk-crypto-wasm').then((mod) => mod.initAsync()),
  ]);

  await applySavedSettingsToLocalStorage(store);

  await client.initRustCrypto({ cryptoDatabasePrefix: cryptoDbPrefix(credentials.userId) });

  // Notify first-sync subscribers exactly once, when the filter is loaded.
  const handler = (state: string) => {
    if (state === 'PREPARED' || state === 'CATCHUP') {
      client.off('sync' as Parameters<typeof client.off>[0], handler);
      notifyFirstSync();
    }
  };
  client.on('sync' as Parameters<typeof client.on>[0], handler);

  // Sliding sync is opt-in (Settings > Developer) and falls back to classic /sync when the
  // homeserver does not advertise MSC4186.
  clearSlidingSync();
  const slidingSync =
    isSlidingSyncEnabled() && (await serverSupportsSlidingSync(client))
      ? createSlidingSync(client, baseUrl)
      : undefined;

  await client.startClient({
    lazyLoadMembers: true,
    clientWellKnownPollPeriod: 86400,
    initialSyncLimit: 20,
    threadSupport: true,
    slidingSync,
  });
  if (slidingSync) void seedOwnProfile(client);

  _client = client;
  setActiveMatrixClient(client);
  sendSessionToSW(client);
  return client;
}

const LEGACY_CRYPTO_DB_PREFIX = 'matrix-js-sdk';
const LEGACY_MEDIA_CACHE_DB = 'wz-media-cache';

function cryptoDbPrefix(userId: string): string {
  return `matrix-js-sdk-${userId}`;
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve(); // best effort — resolve either way
    req.onblocked = () => resolve();
  });
}

async function deleteAccountData(userId: string): Promise<void> {
  if (getActiveAccountId() === userId) {
    await clearMediaCache();
  }

  const prefix = cryptoDbPrefix(userId);
  await Promise.all([
    deleteDatabase(`${prefix}::matrix-sdk-crypto`),
    deleteDatabase(`${prefix}::matrix-sdk-crypto-meta`),
    deleteDatabase(mediaCacheDbName(userId)),
    deleteDatabase(`matrix-store-${userId}`),
    deleteThumbCache(userId),
  ]);

  localStorage.removeItem(`${STORAGE_KEY_DEVICE_ID_PREFIX}${userId}`);
  Object.keys(localStorage)
    .filter((key) => key.endsWith(`::${userId}`))
    .forEach((key) => localStorage.removeItem(key));
}

export async function resetClientForNewSession(userId: string): Promise<void> {
  if (_client) {
    try {
      _client.stopClient();
    } catch {
      // best effort
    }
    _client = null;
    setActiveMatrixClient(null);
    resetFirstSyncState();
  }

  await deleteAccountData(userId);
}

export function switchAccount(userId: string): void {
  if (getActiveAccountId() === userId) return;
  setActiveAccountId(userId);
  setStoredUserId(userId);
  window.location.reload();
}

export async function logout(fallbackUserId?: string | null): Promise<void> {
  const client = getMatrixClientOrNull();
  const activeId = getActiveAccountId();
  const userId = fallbackUserId ?? client?.getUserId() ?? activeId ?? null;
  const clientUserId = client?.getUserId() ?? null;
  const isCurrentSession =
    !!userId && (clientUserId ? userId === clientUserId : userId === activeId);
  const targetCreds = userId ? getAccount(userId) : null;

  const invalidateToken = async (target: MatrixClient) => {
    await Promise.race([
      target.logout(true),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
  };

  // Invalidate the token (and device) on the homeserver
  if (isCurrentSession && client) {
    try {
      await invalidateToken(client);
    } catch {
      // ignore
    }
  } else if (targetCreds?.accessToken && targetCreds?.homeserverUrl) {
    try {
      await invalidateToken(
        createClient({
          baseUrl: normalizeUrl(targetCreds.homeserverUrl),
          accessToken: targetCreds.accessToken,
          userId: targetCreds.userId,
        })
      );
    } catch {
      // ignore
    }
  }

  // Revoke the OIDC session at the authorization server (RFC 7009).
  if (targetCreds?.oidc) {
    try {
      await revokeOidcSession(targetCreds.oidc, {
        accessToken: targetCreds.accessToken,
        refreshToken: targetCreds.refreshToken,
      });
    } catch {
      // ignore — homeserver logout above already invalidated the session where possible
    }
  }

  if (isCurrentSession) {
    // Stop the service worker from proxying media with the dead token.
    try {
      navigator.serviceWorker.controller?.postMessage({ type: 'clearSession' });
    } catch {
      // noop
    }

    if (client) {
      try {
        client.stopClient();
      } catch {
        // best effort
      }
    }
    _client = null;
    setActiveMatrixClient(null);
    resetFirstSyncState();
  }

  if (userId) {
    await deleteAccountData(userId);
    removeAccount(userId);
  }

  if (isCurrentSession) {
    const remaining = listAccounts();
    const next = remaining[0];
    if (next) {
      setActiveAccountId(next.userId);
      setStoredUserId(next.userId);
    } else {
      setActiveAccountId(null);
      setStoredUserId(null);
    }
    window.location.reload();
  }
}

export async function cleanupLegacyStorage(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY_CREDENTIALS);

  const hasAccounts =
    !!localStorage.getItem(STORAGE_KEY_ACCOUNTS) ||
    !!localStorage.getItem(STORAGE_KEY_ACTIVE_ACCOUNT);
  if (hasAccounts) return;

  await Promise.all([
    deleteDatabase(`${LEGACY_CRYPTO_DB_PREFIX}::matrix-sdk-crypto`),
    deleteDatabase(`${LEGACY_CRYPTO_DB_PREFIX}::matrix-sdk-crypto-meta`),
    deleteDatabase(LEGACY_MEDIA_CACHE_DB),
  ]);
}
