import {
  AutoDiscovery,
  AutoDiscoveryAction,
  createClient,
  HTTPError,
  MatrixError,
  SSOAction,
  type IRequestTokenResponse,
} from 'matrix-js-sdk';
import type {
  ILoginFlowsResponse,
  ISSOFlow,
  IIdentityProvider,
} from 'matrix-js-sdk/lib/@types/auth';
import type { OidcClientConfig } from 'matrix-js-sdk/lib/oidc';
import {
  STORAGE_KEY_SSO_HOMESERVER_URL,
  STORAGE_KEY_SSO_STATE,
  STORAGE_KEY_SSO_IDP_ID,
  STORAGE_KEY_SSO_ACTION,
} from '@/const/storageKeys';
import { isTauri, openAuthInBrowser } from '@/util/desktop';
import { publicUrl } from '@/util/publicUrl';

export type IdentityProvider = IIdentityProvider;
export { SSOAction };

export function resolveIdpIconUrl(homeserverUrl: string, icon: string | undefined): string | null {
  if (!icon) return null;
  const client = createClient({ baseUrl: homeserverUrl });
  return client.mxcUrlToHttp(icon, 96, 96, 'crop', false);
}

function findSSOFlow(flows: ILoginFlowsResponse['flows']): ISSOFlow | undefined {
  return flows.find((f): f is ISSOFlow => f.type === 'm.login.sso' || f.type === 'm.login.cas');
}

export enum RegisterStatus {
  Available = 'available',
  Disabled = 'disabled',
  RateLimited = 'rateLimited',
  Unavailable = 'unavailable',
}

export enum DiscoveryStatus {
  Ok = 'ok',
  /** Nothing answered at the address (wrong host, offline, timed out). */
  Unreachable = 'unreachable',
  /** Something answered, but it is not a Matrix homeserver (or will not talk to browsers). */
  NotMatrix = 'notMatrix',
}

/** UIA stages this client can complete during registration without a web page. */
export const REGISTRATION_TOKEN_STAGES = [
  'm.login.registration_token',
  'org.matrix.msc3231.login.registration_token',
];

export interface ServerSoftware {
  name: string;
  version?: string;
}

export interface AuthCapabilities {
  resolvedBaseUrl: string;
  /** What the server says it runs (Synapse, Tuwunel...), when it says. */
  software?: ServerSoftware;
  /** The server name in user ids (`@name:<serverName>`), when it could be found out. */
  serverName?: string;
  /** Registration flows (lists of UIA stages) the server offered, when it offered any. */
  registerFlows?: string[][];
  hasPasswordLogin: boolean;
  hasTokenLogin: boolean;
  ssoFlow?: ISSOFlow;
  registerStatus: RegisterStatus;
  discoveryStatus: DiscoveryStatus;
  delegatedAuth: boolean;
  accountManagementUri?: string;
  authMetadata?: OidcClientConfig;
}

const DISCOVERY_TIMEOUT_MS = 8000;

class DiscoveryTimeout extends Error {}

/** Rejects if a discovery request hangs, so the login page is never stuck on "checking server". */
function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new DiscoveryTimeout(`${what} timed out`)),
      DISCOVERY_TIMEOUT_MS
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * The client base URL behind an address: the `.well-known` delegation when the address has one
 * (matrix.org -> matrix-client.matrix.org), otherwise the address itself. `delegated` says the
 * address published a well-known file, which means it is also the server name in user ids.
 */
async function resolveBaseUrl(
  homeserverUrl: string
): Promise<{ baseUrl: string; delegated: boolean }> {
  let origin: string;
  try {
    origin = new URL(homeserverUrl).origin;
  } catch {
    return { baseUrl: homeserverUrl, delegated: false };
  }
  try {
    // An origin (with its scheme) so a typed http:// address is asked over http, not https.
    const config = await AutoDiscovery.findClientConfig(origin);
    const hs = config['m.homeserver'];
    if (hs.state === AutoDiscoveryAction.SUCCESS && hs.base_url) {
      return { baseUrl: hs.base_url.replace(/\/+$/, ''), delegated: true };
    }
  } catch (err) {
    console.warn('[auth] well-known discovery failed for', homeserverUrl, err);
  }
  return { baseUrl: homeserverUrl, delegated: false };
}

/**
 * After a failed Matrix request: did anything answer at all? A reply without CORS headers (any
 * ordinary website) looks exactly like a network error to fetch, so ask once more in `no-cors`
 * mode, which resolves for any HTTP answer and rejects only when nothing is there.
 */
async function anythingAnswers(url: string): Promise<boolean> {
  try {
    await withTimeout(fetch(url, { mode: 'no-cors', cache: 'no-store' }), 'reachability probe');
    return true;
  } catch {
    return false;
  }
}

async function classifyFailure(err: unknown, baseUrl: string): Promise<DiscoveryStatus> {
  // A real HTTP answer (404 page, 500, a JSON error) from something that is not a homeserver.
  if (err instanceof HTTPError) return DiscoveryStatus.NotMatrix;
  if (err instanceof DiscoveryTimeout) return DiscoveryStatus.Unreachable;
  return (await anythingAnswers(baseUrl)) ? DiscoveryStatus.NotMatrix : DiscoveryStatus.Unreachable;
}

/** Fetches a small JSON document; undefined on any failure. */
async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await withTimeout(fetch(url), url);
    if (!res.ok) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

/**
 * The software a homeserver reports, from the federation version endpoint. Best effort: a server
 * that keeps federation elsewhere, or blocks it from browsers, just has no name. The reply is
 * untrusted, so only short plain strings are kept.
 */
async function detectServerSoftware(baseUrl: string): Promise<ServerSoftware | undefined> {
  const body = (await fetchJson(`${baseUrl.replace(/\/+$/, '')}/_matrix/federation/v1/version`)) as
    | { server?: { name?: unknown; version?: unknown } }
    | undefined;
  const server = body?.server;
  if (typeof server?.name !== 'string' || !server.name.trim()) return undefined;
  return {
    name: server.name.trim().slice(0, 40),
    version: typeof server.version === 'string' ? server.version.trim().slice(0, 40) : undefined,
  };
}

/** The server name from the server's signing-key document. Best effort, like the software. */
async function detectServerName(baseUrl: string): Promise<string | undefined> {
  const body = (await fetchJson(`${baseUrl.replace(/\/+$/, '')}/_matrix/key/v2/server`)) as
    | { server_name?: unknown }
    | undefined;
  const name = body?.server_name;
  return typeof name === 'string' && /^[a-z0-9.:[\]-]{1,255}$/i.test(name) ? name : undefined;
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

function loginFlowsOf(baseUrl: string) {
  return withTimeout(createClient({ baseUrl }).loginFlows(), 'login flow discovery');
}

/** What a server offers for signing in and signing up. Never throws. */
export async function discoverAuthCapabilities(homeserverUrl: string): Promise<AuthCapabilities> {
  // Ask the address itself while the well-known lookup runs, so a dead host costs one timeout.
  const direct = loginFlowsOf(homeserverUrl);
  direct.catch(() => undefined);
  const { baseUrl, delegated } = await resolveBaseUrl(homeserverUrl);
  const client = createClient({ baseUrl });

  const [loginResult, registerResult, authMetadataResult, softwareResult, nameResult] =
    await Promise.allSettled([
      baseUrl === homeserverUrl ? direct : loginFlowsOf(baseUrl),
      withTimeout(client.registerRequest({}), 'register flow discovery'),
      withTimeout(client.getAuthMetadata(), 'auth metadata discovery'),
      detectServerSoftware(baseUrl),
      detectServerName(baseUrl),
    ]);

  const result: AuthCapabilities = {
    resolvedBaseUrl: baseUrl,
    hasPasswordLogin: false,
    hasTokenLogin: false,
    ssoFlow: undefined,
    registerStatus: RegisterStatus.Unavailable,
    discoveryStatus: DiscoveryStatus.Ok,
    delegatedAuth: false,
    accountManagementUri: undefined,
    software: softwareResult.status === 'fulfilled' ? softwareResult.value : undefined,
    serverName:
      (nameResult.status === 'fulfilled' ? nameResult.value : undefined) ??
      (delegated ? hostOf(homeserverUrl) : undefined),
  };

  if (loginResult.status === 'fulfilled') {
    const { flows } = loginResult.value;
    result.hasPasswordLogin = flows.some((f) => f.type === 'm.login.password');
    result.hasTokenLogin = flows.some((f) => f.type === 'm.login.token');
    result.ssoFlow = findSSOFlow(flows);
  } else {
    console.warn('[auth] login flow discovery failed for', baseUrl, loginResult.reason);
    result.discoveryStatus = await classifyFailure(loginResult.reason, baseUrl);
    return result;
  }

  if (registerResult.status === 'fulfilled') {
    result.registerStatus = RegisterStatus.Available;
  } else {
    const err = registerResult.reason;
    if (err instanceof MatrixError) {
      if (err.httpStatus === 401) {
        result.registerStatus = RegisterStatus.Available;
        const flows = (err.data as { flows?: { stages?: unknown }[] } | undefined)?.flows;
        if (Array.isArray(flows)) {
          result.registerFlows = flows
            .map((f) =>
              Array.isArray(f.stages) ? f.stages.filter((s) => typeof s === 'string') : []
            )
            .filter((stages) => stages.length > 0);
        }
      } else if (err.httpStatus === 403) {
        result.registerStatus = RegisterStatus.Disabled;
      } else if (err.httpStatus === 429) {
        result.registerStatus = RegisterStatus.RateLimited;
      }
    } else {
      console.warn('[auth] register flow discovery failed for', baseUrl, err);
    }
  }

  if (authMetadataResult.status === 'fulfilled') {
    const authMetadata = authMetadataResult.value as OidcClientConfig;
    result.delegatedAuth = true;
    result.accountManagementUri = authMetadata.account_management_uri;
    result.authMetadata = authMetadata;
  }

  return result;
}

export function redirectToSso(homeserverUrl: string, action: SSOAction, idpId?: string): void {
  const state = crypto.randomUUID();

  localStorage.setItem(STORAGE_KEY_SSO_HOMESERVER_URL, homeserverUrl);
  localStorage.setItem(STORAGE_KEY_SSO_STATE, state);
  localStorage.setItem(STORAGE_KEY_SSO_ACTION, action);
  if (idpId) {
    localStorage.setItem(STORAGE_KEY_SSO_IDP_ID, idpId);
  } else {
    localStorage.removeItem(STORAGE_KEY_SSO_IDP_ID);
  }

  const redirectUrl = new URL(publicUrl('sso/callback'), window.location.origin);
  redirectUrl.searchParams.set('state', state);

  const client = createClient({ baseUrl: homeserverUrl });
  const ssoUrl = client.getSsoLoginUrl(redirectUrl.toString(), 'sso', idpId, action);
  if (isTauri()) {
    // System browser + native loopback listener; the shell rewrites redirectUrl.
    void openAuthInBrowser(ssoUrl);
    return;
  }
  window.location.href = ssoUrl;
}

export interface PendingSsoFlow {
  homeserverUrl: string;
  state: string;
  action: SSOAction | null;
  idpId?: string;
}

export function readPendingSsoFlow(): PendingSsoFlow | null {
  const homeserverUrl = localStorage.getItem(STORAGE_KEY_SSO_HOMESERVER_URL);
  const state = localStorage.getItem(STORAGE_KEY_SSO_STATE);
  if (!homeserverUrl || !state) return null;

  return {
    homeserverUrl,
    state,
    action: (localStorage.getItem(STORAGE_KEY_SSO_ACTION) as SSOAction | null) ?? null,
    idpId: localStorage.getItem(STORAGE_KEY_SSO_IDP_ID) ?? undefined,
  };
}

export function clearPendingSsoFlow(): void {
  localStorage.removeItem(STORAGE_KEY_SSO_HOMESERVER_URL);
  localStorage.removeItem(STORAGE_KEY_SSO_STATE);
  localStorage.removeItem(STORAGE_KEY_SSO_IDP_ID);
  localStorage.removeItem(STORAGE_KEY_SSO_ACTION);
}

export interface SsoTokenLoginResult {
  userId: string;
  accessToken: string;
  deviceId: string;
  refreshToken?: string;
  expiresInMs?: number;
}

export async function exchangeLoginToken(
  token: string,
  homeserverUrl: string,
  deviceName: string
): Promise<SsoTokenLoginResult> {
  const client = createClient({ baseUrl: homeserverUrl });
  const res = await client.loginRequest({
    type: 'm.login.token',
    token,
    refresh_token: true,
    initial_device_display_name: deviceName,
  });

  return {
    userId: res.user_id,
    accessToken: res.access_token,
    deviceId: res.device_id,
    refreshToken: res.refresh_token,
    expiresInMs: res.expires_in_ms,
  };
}

export function waitForSsoFallback(fallbackUrl: string, homeserverUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const popup = window.open(fallbackUrl, '_blank');
    if (!popup) {
      reject(new Error('popup_blocked'));
      return;
    }

    let expectedOrigin: string | null = null;
    try {
      expectedOrigin = new URL(homeserverUrl).origin;
    } catch {
      expectedOrigin = null;
    }

    let settled = false;
    let closedCheckInterval: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      if (closedCheckInterval) clearInterval(closedCheckInterval);
    };

    const onMessage = (event: MessageEvent) => {
      if (settled) return;
      if (event.source !== popup) return;
      if (expectedOrigin && event.origin !== expectedOrigin) return;
      if (event.data !== 'authDone') return;

      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        // best effort
      }
      resolve();
    };

    window.addEventListener('message', onMessage);

    closedCheckInterval = setInterval(() => {
      if (settled) return;
      if (popup.closed) {
        settled = true;
        cleanup();
        reject(new Error('sso_popup_closed'));
      }
    }, 500);
  });
}

export async function requestPasswordReset(
  homeserverUrl: string,
  email: string,
  clientSecret: string
): Promise<string> {
  const client = createClient({ baseUrl: homeserverUrl });
  const result = await client.requestPasswordEmailToken(email, clientSecret, 1);
  return (result as IRequestTokenResponse).sid;
}

export async function completePasswordReset(
  homeserverUrl: string,
  sid: string,
  clientSecret: string,
  newPassword: string,
  logoutDevices: boolean = true
): Promise<void> {
  const client = createClient({ baseUrl: homeserverUrl });
  await client.setPassword(
    {
      type: 'm.login.email.identity',
      threepid_creds: {
        sid,
        client_secret: clientSecret,
      },
    },
    newPassword,
    logoutDevices
  );
}
