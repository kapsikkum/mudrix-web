// Encrypted room key export file ("MEGOLM SESSION DATA"), the format shared by
// Element, Cinny and friends. Layout of the decoded payload:
//   version(1) | salt(16) | iv(16) | rounds(4, BE) | ciphertext | hmac-sha256(32)
// Key material: PBKDF2-HMAC-SHA512(passphrase, salt, rounds) -> 64 bytes,
// first half AES-256-CTR key, second half HMAC-SHA256 key.

const HEADER_LINE = '-----BEGIN MEGOLM SESSION DATA-----';
const TRAILER_LINE = '-----END MEGOLM SESSION DATA-----';
const VERSION = 1;
const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const HMAC_LENGTH = 32;
const HEADER_LENGTH = 1 + SALT_LENGTH + IV_LENGTH + 4;
const DEFAULT_KDF_ROUNDS = 500_000;
const MAX_KDF_ROUNDS = 10_000_000;
const LINE_WIDTH = 96;

export class MegolmKeyFileError extends Error {
  constructor(public readonly code: 'format' | 'version' | 'password' | 'rounds') {
    super(`Megolm key file error: ${code}`);
    this.name = 'MegolmKeyFileError';
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKeys(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  rounds: number
): Promise<{ aesKey: CryptoKey; hmacKey: CryptoKey }> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: rounds, hash: 'SHA-512' },
    base,
    512
  );
  const [aesBits, hmacBits] = [bits.slice(0, 32), bits.slice(32)];
  const aesKey = await crypto.subtle.importKey('raw', aesBits, 'AES-CTR', false, [
    'encrypt',
    'decrypt',
  ]);
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    hmacBits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  return { aesKey, hmacKey };
}

function armour(payload: Uint8Array): string {
  const b64 = toBase64(payload);
  const lines: string[] = [HEADER_LINE];
  for (let i = 0; i < b64.length; i += LINE_WIDTH) lines.push(b64.slice(i, i + LINE_WIDTH));
  lines.push(TRAILER_LINE);
  return `${lines.join('\n')}\n`;
}

function unarmour(file: string): Uint8Array<ArrayBuffer> {
  const lines = file
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const start = lines.indexOf(HEADER_LINE);
  const end = lines.indexOf(TRAILER_LINE);
  if (start === -1 || end === -1 || end <= start) throw new MegolmKeyFileError('format');
  try {
    return fromBase64(lines.slice(start + 1, end).join(''));
  } catch {
    throw new MegolmKeyFileError('format');
  }
}

export async function encryptMegolmKeyFile(
  plaintext: string,
  passphrase: string,
  rounds = DEFAULT_KDF_ROUNDS
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  // Clear bit 63 of the counter so a 64-bit counter wrap can never overflow into the nonce.
  iv[8] &= 0x7f;

  const { aesKey, hmacKey } = await deriveKeys(passphrase, salt, rounds);
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-CTR', counter: iv, length: 64 },
      aesKey,
      new TextEncoder().encode(plaintext)
    )
  );

  const body = new Uint8Array(HEADER_LENGTH + cipher.length + HMAC_LENGTH);
  body[0] = VERSION;
  body.set(salt, 1);
  body.set(iv, 1 + SALT_LENGTH);
  new DataView(body.buffer).setUint32(1 + SALT_LENGTH + IV_LENGTH, rounds, false);
  body.set(cipher, HEADER_LENGTH);

  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, body.subarray(0, HEADER_LENGTH + cipher.length))
  );
  body.set(mac, HEADER_LENGTH + cipher.length);
  return armour(body);
}

export async function decryptMegolmKeyFile(file: string, passphrase: string): Promise<string> {
  const data = unarmour(file);
  if (data.length < HEADER_LENGTH + HMAC_LENGTH) throw new MegolmKeyFileError('format');
  if (data[0] !== VERSION) throw new MegolmKeyFileError('version');

  const salt = data.slice(1, 1 + SALT_LENGTH);
  const iv = data.slice(1 + SALT_LENGTH, 1 + SALT_LENGTH + IV_LENGTH);
  const rounds = new DataView(data.buffer).getUint32(1 + SALT_LENGTH + IV_LENGTH, false);
  if (rounds < 1 || rounds > MAX_KDF_ROUNDS) throw new MegolmKeyFileError('rounds');

  const macStart = data.length - HMAC_LENGTH;
  const { aesKey, hmacKey } = await deriveKeys(passphrase, salt, rounds);
  const valid = await crypto.subtle.verify(
    'HMAC',
    hmacKey,
    data.slice(macStart),
    data.slice(0, macStart)
  );
  if (!valid) throw new MegolmKeyFileError('password');

  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: iv, length: 64 },
    aesKey,
    data.slice(HEADER_LENGTH, macStart)
  );
  return new TextDecoder().decode(plain);
}
