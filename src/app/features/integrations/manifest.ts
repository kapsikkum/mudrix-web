/**
 * Integration repositories are data only: nothing from a repo.json is ever executed. This file
 * holds the types and a strict hand-written validator. Anything unknown is rejected rather than
 * ignored, so a manifest can never carry a capability the client does not know how to show for
 * approval.
 */

export const MANIFEST_SCHEMA = 1;
/** Cap on the raw repo.json text, in bytes. */
export const MAX_MANIFEST_BYTES = 256 * 1024;

export const COMPOSER_ICON_NAMES = ['send', 'download', 'link', 'plus'] as const;
export type ComposerIconName = (typeof COMPOSER_ICON_NAMES)[number];

export interface LinkCardRule {
  /** Exact lowercase hostnames. No wildcards, no IPs. */
  hosts: string[];
  /** Only links whose path starts with this match. Starts with "/". */
  pathPrefix?: string;
  title: string;
  subtitle?: string;
  buttonLabel?: string;
  icon?: string;
}

export interface ComposerAction {
  id: string;
  label: string;
  icon?: ComposerIconName;
  /** Plain text inserted into the composer, never sent automatically. `{room}` is the only placeholder. */
  insert: string;
}

export interface Permissions {
  linkCards?: LinkCardRule[];
  composerActions?: ComposerAction[];
}

export type Capability = keyof Permissions;
export const CAPABILITIES: readonly Capability[] = ['linkCards', 'composerActions'];

export interface Integration {
  id: string;
  name: string;
  description: string;
  version: string;
  icon?: string;
  permissions: Permissions;
}

export interface RepoManifest {
  schema: typeof MANIFEST_SCHEMA;
  name: string;
  integrations: Integration[];
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ACTION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const HOST_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const ROOM_PLACEHOLDER = '{room}';

const MAX_REPO_NAME = 60;
const MAX_INTEGRATIONS = 50;
const MAX_NAME = 40;
const MAX_DESCRIPTION = 400;
const MAX_VERSION = 20;
const MAX_URL = 500;
const MAX_LINK_RULES = 10;
const MAX_HOSTS = 10;
const MAX_ACTIONS = 6;
const MAX_LABEL = 24;
const MAX_INSERT = 500;
const MAX_TEXT = 120;
const MAX_PATH_PREFIX = 200;

// Control characters (newlines included) and invisible/bidi formatting characters that can make
// text read differently from what it is.
/* eslint-disable no-control-regex */
const UNSAFE_CHARS = new RegExp(
  '[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u180E\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF\uFFF9-\uFFFB]'
);
/* eslint-enable no-control-regex */

export function hasUnsafeChars(value: string): boolean {
  return UNSAFE_CHARS.test(value);
}

class Fail extends Error {}
const fail = (path: string, msg: string): never => {
  throw new Fail(`${path}: ${msg}`);
};

type Obj = Record<string, unknown>;

function asObject(v: unknown, path: string, allowed: readonly string[]): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    return fail(path, 'must be an object');
  const obj = v as Obj;
  Object.keys(obj).forEach((k) => {
    if (!allowed.includes(k)) fail(`${path}.${k}`, 'unknown key');
  });
  return obj;
}

function asArray(v: unknown, path: string, max: number): unknown[] {
  if (!Array.isArray(v)) return fail(path, 'must be an array');
  if (v.length > max) return fail(path, `at most ${max} entries`);
  return v;
}

function asString(v: unknown, path: string, max: number, min = 1): string {
  if (typeof v !== 'string') return fail(path, 'must be a string');
  if (v.length < min) return fail(path, 'must not be empty');
  if (v.length > max) return fail(path, `at most ${max} characters`);
  if (hasUnsafeChars(v)) return fail(path, 'contains control or invisible characters');
  return v;
}

/** https only, no credentials, a real hostname. Returns the string unchanged. */
function asHttpsUrl(v: unknown, path: string): string {
  const s = asString(v, path, MAX_URL);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return fail(path, 'not a valid URL');
  }
  if (u.protocol !== 'https:') return fail(path, 'must be an https URL');
  if (u.username || u.password) return fail(path, 'must not contain credentials');
  if (!u.hostname) return fail(path, 'missing host');
  return s;
}

function isIpLike(host: string): boolean {
  return host.includes(':') || host.startsWith('[') || /^[0-9.]+$/.test(host);
}

function asHost(v: unknown, path: string): string {
  const s = asString(v, path, 253);
  if (s !== s.toLowerCase()) return fail(path, 'must be lowercase');
  if (isIpLike(s)) return fail(path, 'IP addresses are not allowed');
  const labels = s.split('.');
  if (labels.length < 2 || !labels.every((l) => HOST_LABEL.test(l)))
    return fail(path, 'not a valid hostname (no wildcards or ports)');
  return s;
}

function optional<T>(obj: Obj, key: string, read: (v: unknown) => T): T | undefined {
  return obj[key] === undefined ? undefined : read(obj[key]);
}

function validateLinkCard(v: unknown, path: string): LinkCardRule {
  const o = asObject(v, path, ['hosts', 'pathPrefix', 'title', 'subtitle', 'buttonLabel', 'icon']);
  const hosts = asArray(o.hosts, `${path}.hosts`, MAX_HOSTS).map((h, i) =>
    asHost(h, `${path}.hosts[${i}]`)
  );
  if (hosts.length === 0) fail(`${path}.hosts`, 'needs at least one host');
  if (new Set(hosts).size !== hosts.length) fail(`${path}.hosts`, 'duplicate host');
  const rule: LinkCardRule = { hosts, title: asString(o.title, `${path}.title`, MAX_TEXT) };
  const pathPrefix = optional(o, 'pathPrefix', (x) => {
    const p = asString(x, `${path}.pathPrefix`, MAX_PATH_PREFIX);
    if (!p.startsWith('/')) fail(`${path}.pathPrefix`, 'must start with "/"');
    if (/[?#\s\\]/.test(p)) fail(`${path}.pathPrefix`, 'must be a plain path');
    return p;
  });
  if (pathPrefix !== undefined) rule.pathPrefix = pathPrefix;
  const subtitle = optional(o, 'subtitle', (x) => asString(x, `${path}.subtitle`, MAX_TEXT));
  if (subtitle !== undefined) rule.subtitle = subtitle;
  const buttonLabel = optional(o, 'buttonLabel', (x) =>
    asString(x, `${path}.buttonLabel`, MAX_LABEL)
  );
  if (buttonLabel !== undefined) rule.buttonLabel = buttonLabel;
  const icon = optional(o, 'icon', (x) => asHttpsUrl(x, `${path}.icon`));
  if (icon !== undefined) rule.icon = icon;
  return rule;
}

function validateInsert(v: unknown, path: string): string {
  const s = asString(v, path, MAX_INSERT);
  const rest = s.split(ROOM_PLACEHOLDER).join('');
  if (rest.includes('{') || rest.includes('}'))
    fail(path, `only the ${ROOM_PLACEHOLDER} placeholder is allowed`);
  return s;
}

function validateAction(v: unknown, path: string): ComposerAction {
  const o = asObject(v, path, ['id', 'label', 'icon', 'insert']);
  const id = asString(o.id, `${path}.id`, 32);
  if (!ACTION_ID_PATTERN.test(id)) fail(`${path}.id`, 'invalid id');
  const action: ComposerAction = {
    id,
    label: asString(o.label, `${path}.label`, MAX_LABEL),
    insert: validateInsert(o.insert, `${path}.insert`),
  };
  const icon = optional(o, 'icon', (x) => {
    if (typeof x !== 'string' || !(COMPOSER_ICON_NAMES as readonly string[]).includes(x))
      fail(`${path}.icon`, `must be one of ${COMPOSER_ICON_NAMES.join(', ')}`);
    return x as ComposerIconName;
  });
  if (icon !== undefined) action.icon = icon;
  return action;
}

function validatePermissions(v: unknown, path: string): Permissions {
  const o = asObject(v, path, CAPABILITIES as readonly string[]);
  const out: Permissions = {};
  if (o.linkCards !== undefined) {
    out.linkCards = asArray(o.linkCards, `${path}.linkCards`, MAX_LINK_RULES).map((r, i) =>
      validateLinkCard(r, `${path}.linkCards[${i}]`)
    );
  }
  if (o.composerActions !== undefined) {
    const actions = asArray(o.composerActions, `${path}.composerActions`, MAX_ACTIONS).map((a, i) =>
      validateAction(a, `${path}.composerActions[${i}]`)
    );
    if (new Set(actions.map((a) => a.id)).size !== actions.length)
      fail(`${path}.composerActions`, 'duplicate action id');
    out.composerActions = actions;
  }
  return out;
}

function validateIntegration(v: unknown, path: string): Integration {
  const o = asObject(v, path, ['id', 'name', 'description', 'version', 'icon', 'permissions']);
  const id = asString(o.id, `${path}.id`, 64);
  if (!ID_PATTERN.test(id)) fail(`${path}.id`, 'invalid id');
  const integration: Integration = {
    id,
    name: asString(o.name, `${path}.name`, MAX_NAME),
    description: asString(o.description, `${path}.description`, MAX_DESCRIPTION),
    version: asString(o.version, `${path}.version`, MAX_VERSION),
    permissions: validatePermissions(o.permissions, `${path}.permissions`),
  };
  const icon = optional(o, 'icon', (x) => asHttpsUrl(x, `${path}.icon`));
  if (icon !== undefined) integration.icon = icon;
  return integration;
}

/** Validates an already parsed value. Never throws. */
export function validateManifest(raw: unknown): ValidationResult<RepoManifest> {
  try {
    const o = asObject(raw, 'repo', ['schema', 'name', 'integrations']);
    if (o.schema !== MANIFEST_SCHEMA) fail('repo.schema', `must be ${MANIFEST_SCHEMA}`);
    const name = asString(o.name, 'repo.name', MAX_REPO_NAME);
    const integrations = asArray(o.integrations, 'repo.integrations', MAX_INTEGRATIONS).map(
      (it, i) => validateIntegration(it, `repo.integrations[${i}]`)
    );
    if (new Set(integrations.map((i) => i.id)).size !== integrations.length)
      fail('repo.integrations', 'duplicate integration id');
    return { ok: true, value: { schema: MANIFEST_SCHEMA, name, integrations } };
  } catch (e) {
    return { ok: false, error: e instanceof Fail ? e.message : 'invalid repository file' };
  }
}

/** Size-checks and parses raw repo.json text, then validates it. Never throws. */
export function parseManifestText(text: string): ValidationResult<RepoManifest> {
  try {
    if (new TextEncoder().encode(text).length > MAX_MANIFEST_BYTES)
      return { ok: false, error: 'repository file is too large (max 256 KB)' };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: 'repository file is not valid JSON' };
    }
    return validateManifest(json);
  } catch {
    return { ok: false, error: 'invalid repository file' };
  }
}
