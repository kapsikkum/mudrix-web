import type { MatrixClient } from 'matrix-js-sdk';

export interface EncryptionSetupStatus {
  secretStorageReady: boolean;
  secretStorageDefaultKey: string | null;
  crossSigningIdentityExists: boolean;
  crossSigningPrivateKeysInSecretStorage: boolean;
  hasLocalCrossSigningPrivateKeys: boolean;
  keyBackupVersion: string | null;
}

const emptyStatus: EncryptionSetupStatus = {
  secretStorageReady: false,
  secretStorageDefaultKey: null,
  crossSigningIdentityExists: false,
  crossSigningPrivateKeysInSecretStorage: false,
  hasLocalCrossSigningPrivateKeys: false,
  keyBackupVersion: null,
};

export async function getEncryptionSetupStatus(
  client: MatrixClient
): Promise<EncryptionSetupStatus> {
  if (!client) return { ...emptyStatus };

  const crypto = client.getCrypto();
  if (!crypto) return { ...emptyStatus };

  const [ssStatus, csStatus, backupInfo] = await Promise.all([
    crypto.getSecretStorageStatus(),
    crypto.getCrossSigningStatus(),
    crypto.getKeyBackupInfo(),
  ]);

  return {
    secretStorageReady: ssStatus.ready,
    secretStorageDefaultKey: ssStatus.defaultKeyId,
    crossSigningIdentityExists: csStatus.publicKeysOnDevice,
    crossSigningPrivateKeysInSecretStorage: csStatus.privateKeysInSecretStorage,
    hasLocalCrossSigningPrivateKeys: csStatus.privateKeysCachedLocally.masterKey,
    keyBackupVersion: backupInfo?.version ?? null,
  };
}

export function hasExistingEncryptionSetup(status: EncryptionSetupStatus): boolean {
  return (
    status.secretStorageDefaultKey !== null ||
    status.crossSigningIdentityExists ||
    status.crossSigningPrivateKeysInSecretStorage ||
    status.hasLocalCrossSigningPrivateKeys
  );
}
