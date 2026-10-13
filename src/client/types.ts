export interface OidcSession {
  issuer: string;
  clientId: string;
  redirectUri: string;
  responseMode: OidcResponseMode;
  revocationEndpoint?: string;
  idTokenClaims: Record<string, unknown>;
}

export type OidcResponseMode = 'query' | 'fragment';

export interface MatrixCredentials {
  userId: string;
  accessToken: string;
  deviceId: string;
  homeserverUrl: string;
  refreshToken?: string;
  expiresInMs?: number;
  oidc?: OidcSession;
}
