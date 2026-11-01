import { validateManifest, MAX_MANIFEST_BYTES, type RepoManifest } from './manifest';
import { fetchLimited } from './net';
import { fingerprintKey, isOfficialKey, isValidKey, verifyRepoSignature } from './signature';

/** Cap on the detached signature file (a 64-byte signature is 88 base64 characters). */
const MAX_SIGNATURE_BYTES = 1024;

export type UrlResult = { ok: true; url: string } | { ok: false; error: string };
export type RepoFetchResult =
  | {
      ok: true;
      value: RepoManifest;
      key: string;
      fingerprint: string;
      serial: number;
      official: boolean;
      bytes?: Uint8Array;
    }
  | { ok: false; error: string };

const DEV_HOSTS = ['localhost', '127.0.0.1'];

function isPrivateIpv4(host: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** True for hosts we never talk to: IP literals, single-label and local-looking names. */
function isForbiddenHost(host: string): boolean {
  if (host.startsWith('[') || host.includes(':')) return true;
  // URL normalises odd IPv4 spellings to dotted form, so any numeric host is an IP.
  if (/^[0-9.]+$/.test(host) || isPrivateIpv4(host)) return true;
  if (!host.includes('.')) return true;
  return /\.(local|localhost|internal|lan|home|corp|intranet)$/.test(host);
}

/**
 * Normalises what the user typed into the URL to fetch. A github.com repo URL becomes the raw
 * repo.json at its root. Rejects http, credentials and local/private hosts (localhost and
 * 127.0.0.1 are allowed in development builds only).
 */
export function parseRepoUrl(input: string): UrlResult {
  const text = (input ?? '').trim();
  if (!text) return { ok: false, error: 'Enter a repository URL' };
  if (text.length > 500) return { ok: false, error: 'URL is too long' };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }
  if (u.username || u.password)
    return { ok: false, error: 'URLs with credentials are not allowed' };
  const host = u.hostname.toLowerCase();
  const devOk = import.meta.env.DEV && DEV_HOSTS.includes(host);
  if (u.protocol !== 'https:' && !(devOk && u.protocol === 'http:'))
    return { ok: false, error: 'Only https URLs are allowed' };
  if (!devOk && isForbiddenHost(host)) return { ok: false, error: 'That host is not allowed' };
  u.hash = '';

  if (host === 'github.com' || host === 'www.github.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    const [owner, repoRaw] = parts;
    const repo = repoRaw?.replace(/\.git$/, '');
    const safe = /^[A-Za-z0-9._-]+$/;
    if (!owner || !repo || !safe.test(owner) || !safe.test(repo))
      return { ok: false, error: 'Use https://github.com/<owner>/<repo>' };
    let ref = 'HEAD';
    if (parts.length > 2) {
      if (parts[2] !== 'tree' || parts.length < 4)
        return { ok: false, error: 'Use https://github.com/<owner>/<repo>[/tree/<ref>]' };
      // Branch names may contain "/", so everything after /tree/ is the ref.
      ref = parts.slice(3).join('/');
      if (!/^[A-Za-z0-9._\-/]+$/.test(ref) || ref.split('/').includes('..'))
        return { ok: false, error: 'Invalid branch or tag name' };
    }
    return {
      ok: true,
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/repo.json`,
    };
  }
  return { ok: true, url: u.toString() };
}

/** The detached signature lives next to repo.json: same URL plus ".sig". */
function signatureUrl(repoUrl: string): string {
  const u = new URL(repoUrl);
  u.pathname += '.sig';
  return u.toString();
}

/**
 * Downloads repo.json and repo.json.sig, checks the signature over the exact bytes with the key
 * the file carries, and only then runs the strict validator. Never throws.
 */
export async function fetchRepo(url: string): Promise<RepoFetchResult> {
  const checked = parseRepoUrl(url);
  if (!checked.ok) return checked;
  const [res, sigRes] = await Promise.all([
    fetchLimited(checked.url, MAX_MANIFEST_BYTES, 'application/json'),
    fetchLimited(signatureUrl(checked.url), MAX_SIGNATURE_BYTES, 'text/plain'),
  ]);
  if (!res.ok) return res;
  if (!sigRes.ok) {
    if (/ answered 404$/.test(sigRes.error))
      return { ok: false, error: 'This repository is not signed, so it cannot be added.' };
    return { ok: false, error: `Could not load the signature file: ${sigRes.error}` };
  }
  let json: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(res.bytes);
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'repository file is not valid JSON text' };
  }
  const keyField = (json as { key?: unknown } | null)?.key;
  if (typeof keyField !== 'string' || !isValidKey(keyField))
    return { ok: false, error: 'The repository carries a malformed or missing signing key.' };
  let sigText: string;
  try {
    sigText = new TextDecoder('utf-8', { fatal: true }).decode(sigRes.bytes);
  } catch {
    return { ok: false, error: 'The signature file is malformed.' };
  }
  const verified = await verifyRepoSignature(res.bytes, sigText, keyField);
  if (!verified.ok) return verified;
  const parsed = validateManifest(json);
  if (!parsed.ok) return parsed;
  const fingerprint = await fingerprintKey(parsed.value.key);
  if (!fingerprint) return { ok: false, error: 'This device cannot compute the key fingerprint.' };
  return {
    ok: true,
    value: parsed.value,
    key: parsed.value.key,
    fingerprint,
    serial: parsed.value.serial,
    official: isOfficialKey(parsed.value.key),
    bytes: res.bytes,
  };
}
