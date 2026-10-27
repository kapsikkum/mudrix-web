import type { UserIdentifier } from 'matrix-js-sdk/lib/@types/auth';
import { normalizeUrl } from '@/client/initMatrix';

/** `matrix.org`, `chat.example.org:8448`: an address as people write it, without the scheme. */
export function displayHost(url: string): string {
  try {
    const u = new URL(normalizeUrl(url));
    const path = u.pathname.replace(/\/+$/, '');
    // Keep an explicit http:// visible: it matters, and it is what the person typed.
    return `${u.protocol === 'http:' ? 'http://' : ''}${u.host}${path}`;
  } catch {
    return url.trim();
  }
}

/** The host:port of an address, for comparing it with the server part of a user id. */
export function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).host.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Whether a typed address is complete enough to be worth asking about. While someone is still
 * typing `matrix.o` there is no point checking (and showing a red "not found" for) every prefix.
 */
export function isCompleteAddress(input: string): boolean {
  const url = normalizeUrl(input);
  if (!url) return false;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === 'localhost') return true;
  if (host.startsWith('[')) return host.endsWith(']');
  const labels = host.split('.');
  if (labels.every((l) => /^\d+$/.test(l))) {
    return labels.length === 4 && labels.every((l) => Number(l) <= 255);
  }
  if (labels.length < 2 || labels.some((l) => !l)) return false;
  const tld = labels[labels.length - 1];
  return /^[a-z][a-z0-9-]+$/.test(tld) || /^xn--/.test(tld);
}

export type SignInIdentifier =
  | { kind: 'user'; user: string }
  | { kind: 'mxid'; user: string; localpart: string; server: string }
  | { kind: 'email'; address: string }
  | { kind: 'phone'; address: string };

const EMAIL_RE = /^[^\s@:]+@[^\s@:]+\.[^\s@:]{2,}$/;
const MXID_RE = /^@([^:\s]+):([^\s]+)$/;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

/**
 * Reads what someone typed into "Email or username". Matrix accepts an email (or phone number)
 * bound to the account, a bare username, or a full user id `@name:server`.
 */
export function parseIdentifier(raw: string): SignInIdentifier | null {
  const value = raw.trim();
  if (!value) return null;
  const mxid = MXID_RE.exec(value);
  if (mxid) {
    return { kind: 'mxid', user: value, localpart: mxid[1], server: mxid[2].toLowerCase() };
  }
  if (EMAIL_RE.test(value)) return { kind: 'email', address: value };
  if (PHONE_RE.test(value) && /\d{7,}/.test(value.replace(/\D/g, ''))) {
    return { kind: 'phone', address: value.replace(/\D/g, '') };
  }
  // "@name" without a server: the server wants just the name.
  return { kind: 'user', user: value.replace(/^@/, '') };
}

/**
 * Like parseIdentifier, knowing which server is selected: `ash@mudrix.test` while signing in to
 * mudrix.test is somebody writing their user id email-style (nobody has a mailbox on a Matrix
 * server name), so it means the user `ash`.
 */
export function interpretIdentifier(raw: string, serverName: string): SignInIdentifier | null {
  const id = parseIdentifier(raw);
  if (id?.kind === 'email' && serverName) {
    const at = id.address.lastIndexOf('@');
    if (id.address.slice(at + 1).toLowerCase() === serverName.toLowerCase()) {
      return { kind: 'user', user: id.address.slice(0, at) };
    }
  }
  return id;
}

/** The `identifier` object of a Matrix `m.login.password` request. */
export function toLoginIdentifier(id: SignInIdentifier): UserIdentifier {
  switch (id.kind) {
    case 'email':
      return { type: 'm.id.thirdparty', medium: 'email', address: id.address };
    case 'phone':
      return { type: 'm.id.thirdparty', medium: 'msisdn', address: id.address };
    default:
      return { type: 'm.id.user', user: id.user };
  }
}
