import { useCallback, useEffect, useRef } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useSyncReady } from '@/app/hooks/useSync';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import {
  FAVOURITES_CHANGED_EVENT,
  parseFavourite,
  readFavourites,
  readFavouritesUpdatedAt,
  writeFavourites,
} from '@/app/features/timeline/composer/gifFavourites';

/**
 * Account data is readable by the homeserver, and an encrypted GIF favourite carries its media
 * decryption key, so the list is encrypted before it is stored. The AES key is derived from the
 * session-backup key, which every verified device of the account holds. A device without it
 * simply keeps its own local list.
 */
export const GIF_FAVOURITES_ACCOUNT_DATA = 'chat.mudrix.gif_favourites';
/** Where earlier versions kept it (a domain Mudrix does not own); still read, never written. */
const LEGACY_GIF_FAVOURITES_ACCOUNT_DATA = 'io.mudrix.gif_favourites';

const PUSH_DEBOUNCE_MS = 1000;
const KDF_INFO = 'mudrix.gif-favourites.v1';

type AccountDataKey = Parameters<MatrixClient['setAccountData']>[0];

interface Payload {
  v: 1;
  updated_at: number;
  iv: string;
  ct: string;
}

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...Array.from(bytes)));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(client: MatrixClient): Promise<CryptoKey | null> {
  const secret = await client.getCrypto()?.getSessionBackupPrivateKey();
  if (!secret) return null;
  const base = await crypto.subtle.importKey(
    'raw',
    secret as Uint8Array<ArrayBuffer>,
    'HKDF',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(KDF_INFO),
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptList(key: CryptoKey, json: string, updatedAt: number): Promise<Payload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(json)
  );
  return { v: 1, updated_at: updatedAt, iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

async function decryptList(key: CryptoKey, payload: Payload): Promise<unknown[]> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(payload.iv) },
    key,
    fromB64(payload.ct)
  );
  const parsed = JSON.parse(new TextDecoder().decode(plain));
  return Array.isArray(parsed) ? parsed : [];
}

function readPayloadAt(client: MatrixClient, type: string): Payload | null {
  const content = client
    .getAccountData(type as Parameters<MatrixClient['getAccountData']>[0])
    ?.getContent() as Partial<Payload> | undefined;
  if (
    !content ||
    content.v !== 1 ||
    typeof content.iv !== 'string' ||
    typeof content.ct !== 'string' ||
    typeof content.updated_at !== 'number'
  ) {
    return null;
  }
  return content as Payload;
}

/** The newer of the current list and one an older version left under the legacy key. */
function readPayload(client: MatrixClient): Payload | null {
  const current = readPayloadAt(client, GIF_FAVOURITES_ACCOUNT_DATA);
  const legacy = readPayloadAt(client, LEGACY_GIF_FAVOURITES_ACCOUNT_DATA);
  if (!current || !legacy) return current ?? legacy;
  return legacy.updated_at > current.updated_at ? legacy : current;
}

/** Keeps the GIF favourites in sync across this account's devices, encrypted. */
export function useGifFavouritesSync(client: MatrixClient | null): void {
  const syncReady = useSyncReady();
  const busy = useRef(false);
  const again = useRef(false);

  const reconcile = useCallback(async () => {
    if (!client) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    try {
      const key = await deriveKey(client);
      if (!key) return;
      const remote = readPayload(client);
      const localAt = readFavouritesUpdatedAt();
      if (remote && remote.updated_at > localAt) {
        const items = (await decryptList(key, remote))
          .map(parseFavourite)
          .filter((i): i is NonNullable<typeof i> => i !== null);
        writeFavourites(items, remote.updated_at);
      } else if (!remote || remote.updated_at < localAt) {
        const local = readFavourites();
        if (local.length === 0 && !remote) return;
        const payload = await encryptList(key, JSON.stringify(local), localAt || Date.now());
        await client.setAccountData(GIF_FAVOURITES_ACCOUNT_DATA as AccountDataKey, payload);
      }
    } catch {
      // Non-fatal: the local list keeps working and the next change retries.
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        reconcile();
      }
    }
  }, [client]);

  useEffect(() => {
    if (client && syncReady) reconcile();
  }, [client, syncReady, reconcile]);

  useMatrixEvent(client, 'accountData', (event: MatrixEvent) => {
    const type = event.getType();
    if (type === GIF_FAVOURITES_ACCOUNT_DATA || type === LEGACY_GIF_FAVOURITES_ACCOUNT_DATA) {
      reconcile();
    }
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(reconcile, PUSH_DEBOUNCE_MS);
    };
    window.addEventListener(FAVOURITES_CHANGED_EVENT, onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(FAVOURITES_CHANGED_EVENT, onChange);
    };
  }, [reconcile]);
}
