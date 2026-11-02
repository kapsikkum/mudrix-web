import { BaseKeyProvider } from 'livekit-client';
import { type MatrixRTCSession, MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc';

/**
 * A per-connection key provider that feeds one LiveKit Room + Worker.
 * When the connection is closed, disposing this removes its listeners and
 * prevents updates from posting to dead workers.
 */
export class ConnectionKeyProvider extends BaseKeyProvider {
  private disposed = false;
  private onDisposeCallback?: () => void;

  constructor(onDispose?: () => void) {
    super({ ratchetWindowSize: 10, keyringSize: 256 });
    this.onDisposeCallback = onDispose;
  }

  setKey(material: CryptoKey, identity: string, index: number): void {
    if (this.disposed) return;
    this.onSetEncryptionKey(material, identity, index);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onDisposeCallback?.();
    this.onDisposeCallback = undefined;
    this.removeAllListeners();
  }

  isDisposed(): boolean {
    return this.disposed;
  }
}

/**
 * Central broadcasting key provider. Listens to MatrixRTCSession encryption key changes,
 * caches imported keys, and broadcasts them to all active per-connection providers.
 */
export class MatrixKeyProvider extends BaseKeyProvider {
  private rtcSession?: MatrixRTCSession;
  private disposed = false;
  private childProviders = new Set<ConnectionKeyProvider>();
  private keyCache = new Map<string, { material: CryptoKey; identity: string; index: number }>();

  /** Told when a participant's key has been installed, so a missing-key warning can clear. */
  onKey?: (identity: string, index: number) => void;

  constructor() {
    super({ ratchetWindowSize: 10, keyringSize: 256 });
  }

  setRTCSession(rtcSession: MatrixRTCSession): void {
    if (this.disposed) return;
    this.rtcSession?.off(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onKeyChanged);
    this.rtcSession = rtcSession;
    rtcSession.on(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onKeyChanged);
    rtcSession.reemitEncryptionKeys();
  }

  createConnectionKeyProvider(): ConnectionKeyProvider {
    const child = new ConnectionKeyProvider(() => {
      this.childProviders.delete(child);
    });

    if (this.disposed) {
      child.dispose();
      return child;
    }

    // Seed the child with all keys we have cached so far
    for (const { material, identity, index } of this.keyCache.values()) {
      child.setKey(material, identity, index);
    }

    this.childProviders.add(child);
    return child;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rtcSession?.off(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onKeyChanged);
    this.rtcSession = undefined;
    this.onKey = undefined;

    for (const child of this.childProviders) {
      child.dispose();
    }
    this.childProviders.clear();
    this.keyCache.clear();
    this.removeAllListeners();
  }

  private onKeyChanged = (
    key: Uint8Array<ArrayBuffer>,
    index: number,
    _membership: unknown,
    rtcBackendIdentity: string
  ): void => {
    if (this.disposed) return;
    void crypto.subtle
      .importKey('raw', key, 'HKDF', false, ['deriveBits', 'deriveKey'])
      .then((material) => {
        if (this.disposed) return;
        const cacheKey = `${rtcBackendIdentity}-${index}`;
        this.keyCache.set(cacheKey, { material, identity: rtcBackendIdentity, index });

        // Update self (in case this instance is inspected)
        this.onSetEncryptionKey(material, rtcBackendIdentity, index);

        // Broadcast to all active connection providers
        for (const child of this.childProviders) {
          child.setKey(material, rtcBackendIdentity, index);
        }

        this.onKey?.(rtcBackendIdentity, index);
      })
      .catch((err) => {
        if (!this.disposed) {
          console.error('[mudrix-rtc] importing a media key failed', err);
        }
      });
  };
}
