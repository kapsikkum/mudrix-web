interface SSOCapabilities {
  hasSSOLogin: boolean;
  hasSSORegister: boolean;
  identityProviders: IdentityProvider[];
  error: string | null;
}

export interface IdentityProvider {
  id: string;
  name: string;
  icon?: string;
}

export async function discoverSSOCapabilities(homeserverUrl: string): Promise<SSOCapabilities> {
  const result: SSOCapabilities = {
    hasSSOLogin: false,
    hasSSORegister: false,
    identityProviders: [],
    error: null,
  };

  try {
    const loginRes = await fetch(`${homeserverUrl}/_matrix/client/v3/login`);
    if (loginRes.ok) {
      const data = await loginRes.json();
      const ssoFlow = data.flows?.find((f: { type: string }) => f.type === 'm.login.sso');
      if (ssoFlow) {
        result.hasSSOLogin = true;
        result.hasSSORegister = true;
        result.identityProviders = ssoFlow.identity_providers ?? [];
      }
    }

    if (!result.hasSSOLogin) {
      const regRes = await fetch(`${homeserverUrl}/_matrix/client/v3/register`);
      if (regRes.ok) {
        const data = await regRes.json();
        const ssoFlow = data.flows?.find((f: { type: string }) => f.type === 'm.login.sso');
        if (ssoFlow) {
          result.hasSSOLogin = true;
          result.hasSSORegister = true;
          if (!result.identityProviders.length) {
            result.identityProviders = ssoFlow.identity_providers ?? [];
          }
        }
      }
    }
  } catch (err) {
    console.warn('[SSO] discovery failed for', homeserverUrl, err);
    result.error = err instanceof Error ? err.message : String(err);
  }

  return result;
}

export function getSSOLoginUrl(homeserverUrl: string, redirectUrl: string, idpId?: string): string {
  const base = `${homeserverUrl}/_matrix/client/v3/login/sso/redirect`;
  const params = new URLSearchParams({ redirectUrl });
  return idpId ? `${base}/${idpId}?${params}` : `${base}?${params}`;
}

export function redirectToSso(serverUrl: string, idpId?: string): void {
  const redirectUrl = `${window.location.origin}/sso/callback?homeserver=${encodeURIComponent(serverUrl)}`;
  sessionStorage.setItem('sso_redirect_pending', 'true');
  sessionStorage.setItem('sso_homeserver', serverUrl);
  window.location.href = getSSOLoginUrl(serverUrl, redirectUrl, idpId);
}

export async function exchangeLoginToken(
  token: string,
  homeserverUrl: string,
  deviceId: string,
  deviceName: string
): Promise<{ user_id: string; access_token: string; device_id: string }> {
  const res = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.token',
      token,
      device_id: deviceId,
      initial_device_display_name: deviceName,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to exchange SSO token');
  }
  return res.json();
}
