export interface MatrixCredentials {
  userId: string;
  accessToken: string;
  deviceId: string;
  homeserverUrl: string;
  refreshToken?: string;
  expiresInMs?: number;
}
