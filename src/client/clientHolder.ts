import type { MatrixClient } from 'matrix-js-sdk';

let _activeClient: MatrixClient | null = null;

export function setActiveMatrixClient(client: MatrixClient | null): void {
  _activeClient = client;
}

export function getMatrixClientOrNull(): MatrixClient | null {
  return _activeClient;
}
