import {
  AutoDiscovery,
  AutoDiscoveryAction,
  createClient,
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
  Unreachable = 'unreachable',
  WellKnownInvalid = 'wellKnownInvalid',
}

export interface ServerSoftware {
  name: string;
  version?: string;
}

export interface AuthCapabilities {
  resolvedBaseUrl: string;
  /** What the server says it runs (Synapse, Tuwunel...), when it says. */
  software?: ServerSoftware;
  hasPasswordLogin: boolean;
  hasTokenLogin: boolean;
  ssoFlow?: ISSOFlow;
  registerStatus: RegisterStatus;
  discoveryStatus: DiscoveryStatus;
  delegatedAuth: boolean;
  accountManagementUri?: string;
  authMetadata?: OidcClientConfig;
}

async function resolveBaseUrl(homeserverUrl: string): Promise<{
  baseUrl: string;
  wellKnownInvalid: boolean;
}> {
  let domain: string;
  try {
    domain = new URL(homeserverUrl).host;
  } catch {
    domain = homeserverUrl;
  }

  try {
    const config = await AutoDiscovery.findClientConfig(domain);
    const hs = config['m.homeserver'];
    if (hs.state === AutoDiscoveryAction.SUCCESS && hs.base_url) {
      return { baseUrl: hs.base_url, wellKnownInvalid: false };
    }
    if (
      hs.state === AutoDiscoveryAction.FAIL_PROMPT ||
      hs.state === AutoDiscoveryAction.FAIL_ERROR
    ) {
      return { baseUrl: homeserverUrl, wellKnownInvalid: true };
    }
  } catch (err) {
    console.warn('[auth] well-known discovery failed for', homeserverUrl, err);
  }

  return { baseUrl: homeserverUrl, wellKnownInvalid: false };
}

const DISCOVERY_TIMEOUT_MS = 8000;

/** Rejects if a discovery request hangs, so the login page is never stuck on "checking server". */
function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out`)), DISCOVERY_TIMEOUT_MS);
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
 * The software a homeserver reports, from the federation version endpoint. Best effort: a server
 * that keeps federation elsewhere, or blocks it from browsers, just has no name. The reply is
 * untrusted, so only short plain strings are kept.
 */
async function detectServerSoftware(baseUrl: string): Promise<ServerSoftware | undefined> {
  const url = `${baseUrl.replace(/\/+$/, '')}/_matrix/federation/v1/version`;
  try {
    const res = await withTimeout(fetch(url), 'server software detection');
    if (!res.ok) return undefined;
    const body = (await res.json()) as { server?: { name?: unknown; version?: unknown } };
    const server = body.server;
    if (typeof server?.name !== 'string' || !server.name.trim()) return undefined;
    return {
      name: server.name.trim().slice(0, 40),
      version: typeof server.version === 'string' ? server.version.trim().slice(0, 40) : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function discoverAuthCapabilities(homeserverUrl: string): Promise<AuthCapabilities> {
  const { baseUrl, wellKnownInvalid } = await resolveBaseUrl(homeserverUrl);
  const client = createClient({ baseUrl });

  const [loginResult, registerResult, authMetadataResult, softwareResult] =
    await Promise.allSettled([
      withTimeout(client.loginFlows(), 'login flow discovery'),
      withTimeout(client.registerRequest({}), 'register flow discovery'),
      withTimeout(client.getAuthMetadata(), 'auth metadata discovery'),
      detectServerSoftware(baseUrl),
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
  };

  if (loginResult.status === 'fulfilled') {
    const { flows } = loginResult.value;
    result.hasPasswordLogin = flows.some((f) => f.type === 'm.login.password');
    result.hasTokenLogin = flows.some((f) => f.type === 'm.login.token');
    result.ssoFlow = findSSOFlow(flows);
  } else {
    console.warn('[auth] login flow discovery failed for', baseUrl, loginResult.reason);
    result.discoveryStatus = wellKnownInvalid
      ? DiscoveryStatus.WellKnownInvalid
      : DiscoveryStatus.Unreachable;
  }

  if (registerResult.status === 'fulfilled') {
    result.registerStatus = RegisterStatus.Available;
  } else {
    const err = registerResult.reason;
    if (err instanceof MatrixError) {
      if (err.httpStatus === 401) {
        result.registerStatus = RegisterStatus.Available;
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
