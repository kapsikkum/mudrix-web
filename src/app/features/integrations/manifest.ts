/**
 * Integration repositories are data only: nothing from a repo.json is ever executed by the
 * client itself. The one exception is `permissions.widget`, which names a page that runs in a
 * sandboxed iframe on its own origin (see `runsCode`). This file
 * holds the types and a strict hand-written validator. Anything unknown is rejected rather than
 * ignored, so a manifest can never carry a capability the client does not know how to show for
 * approval.
 */

import { MAX_SERIAL, isValidKey } from './signature';
import {
  WIDGET_CAPABILITY_IDS,
  WIDGET_PARAMETERS,
  type WidgetParameter,
} from './widgetCapabilities';

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
  /** Plain text inserted into the composer, never sent automatically. `{room}` is the only placeholder. */ insert: string;
}

/** Placeholders usable inside `api` action body values. */
export const API_PLACEHOLDERS = ['room', 'text', 'args'] as const;

export interface ApiAction {
  id: string;
  label: string;
  /** Starts with "/", plain path characters only. The method is always POST. */
  path: string;
  /** JSON body template: string values only, `{room}`, `{text}` and `{args}` are substituted. */
  body?: Record<string, string>;
  /** Name of a string field in the JSON response that holds a link to insert into the composer. */
  insertResultLink?: string;
}

export interface ApiPermission {
  /** One exact lowercase hostname (plus localhost/127.0.0.1 with optional port in dev builds). */
  host: string;
  actions: ApiAction[];
}

export interface SlashCommand {
  /** Without the leading "/". */
  name: string;
  description: string;
  /** Shown as a hint; starts with "/" + name. */
  usage?: string;
  /** Plain text put into the composer. `{room}` and `{args}` are the placeholders. Exclusive with `api`. */
  insert?: string;
  /** Id of an action in this integration's `api.actions`. Exclusive with `insert`. */
  api?: string;
  /** Opens this integration's widget. Exclusive with `insert` and `api`. */
  widget?: true;
}

export interface WidgetPermission {
  /** https (or local http in dev builds), no fragment, no `$` template variables. */
  url: string;
  /** Defaults to the integration name. */
  name?: string;
  /** Ids from WIDGET_CAPABILITY_CATALOGUE. Empty = the widget can only display. */
  capabilities: string[];
  /** Extra URL query parameters Mudrix may add (besides the always-sent theme and lang). */
  parameters?: WidgetParameter[];
}

export interface Permissions {
  linkCards?: LinkCardRule[];
  composerActions?: ComposerAction[];
  commands?: SlashCommand[];
  api?: ApiPermission;
  /** Runs code. The only capability that is not data-only. */
  widget?: WidgetPermission;
}

export type Capability = keyof Permissions;
export const CAPABILITIES: readonly Capability[] = [
  'linkCards',
  'composerActions',
  'commands',
  'api',
  'widget',
];

/** True when approving these permissions lets third-party code run (in a sandboxed iframe). */
export function runsCode(p: Permissions): boolean {
  return p.widget !== undefined;
}

/** True when the permission set actually offers this capability (non-empty). */
export function hasCapability(p: Permissions, c: Capability): boolean {
  if (c === 'api') return (p.api?.actions.length ?? 0) > 0;
  if (c === 'widget') return p.widget !== undefined;
  return (p[c]?.length ?? 0) > 0;
}

/** Hosts that are only accepted by dev builds, for a local mock service. */
export function isLocalDevHost(host: string): boolean {
  const m = /^(localhost|127\.0\.0\.1)(?::(\d{1,5}))?$/.exec(host);
  return !!m && (m[2] === undefined || Number(m[2]) <= 65535);
}

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
  /** Standard base64 of the raw 32-byte Ed25519 public key that signs this file. */
  key: string;
  /** Integer 1..2147483647, raised on every release. */
  serial: number;
  name: string;
  integrations: Integration[];
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ACTION_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const HOST_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const COMMAND_NAME_PATTERN = /^[a-z][a-z0-9-]{1,23}$/;
const API_PATH_PATTERN = /^\/[A-Za-z0-9._~/-]*$/;
const BODY_KEY_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const RESULT_FIELD_PATTERN = /^[A-Za-z0-9_]{1,32}$/;

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
const MAX_API_ACTIONS = 4;
const MAX_API_PATH = 200;
const MAX_BODY_KEYS = 16;
const MAX_BODY_VALUE = 200;
const MAX_COMMANDS = 6;
const MAX_COMMAND_DESCRIPTION = 80;
const MAX_COMMAND_USAGE = 60;

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

const UNSAFE_CHARS_GLOBAL = new RegExp(UNSAFE_CHARS.source, 'g');

/** Removes the characters `hasUnsafeChars` rejects (for text that did not come from a manifest). */
export function stripUnsafeChars(value: string): string {
  return value.replace(UNSAFE_CHARS_GLOBAL, '');
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

/** A string whose only braces are complete, allowed `{name}` placeholders. */
function asTemplate(
  v: unknown,
  path: string,
  max: number,
  allowed: readonly string[],
  min = 1
): string {
  const s = asString(v, path, max, min);
  const rest = s.replace(/\{(\w+)\}/g, (m, name: string) => (allowed.includes(name) ? '' : m));
  if (rest.includes('{') || rest.includes('}'))
    fail(path, `only the ${allowed.map((a) => `{${a}}`).join(', ')} placeholder(s) are allowed`);
  return s;
}

const validateInsert = (v: unknown, path: string): string =>
  asTemplate(v, path, MAX_INSERT, ['room']);

function asApiHost(v: unknown, path: string): string {
  const s = asString(v, path, 253);
  if (import.meta.env.DEV && isLocalDevHost(s)) return s;
  return asHost(s, path);
}

function validateApiAction(v: unknown, path: string): ApiAction {
  const o = asObject(v, path, ['id', 'label', 'path', 'body', 'insertResultLink']);
  const id = asString(o.id, `${path}.id`, 32);
  if (!ACTION_ID_PATTERN.test(id)) fail(`${path}.id`, 'invalid id');
  const apiPath = asString(o.path, `${path}.path`, MAX_API_PATH);
  if (!API_PATH_PATTERN.test(apiPath) || apiPath.split('/').some((s) => s === '..' || s === '.'))
    fail(`${path}.path`, 'must start with "/" and be a plain path (letters, digits, . _ ~ / -)');
  const action: ApiAction = {
    id,
    label: asString(o.label, `${path}.label`, MAX_LABEL),
    path: apiPath,
  };
  const body = optional(o, 'body', (x) => {
    if (typeof x !== 'object' || x === null || Array.isArray(x))
      return fail(`${path}.body`, 'must be an object');
    const keys = Object.keys(x);
    if (keys.length > MAX_BODY_KEYS) fail(`${path}.body`, `at most ${MAX_BODY_KEYS} keys`);
    const out: Record<string, string> = {};
    keys.forEach((k) => {
      if (!BODY_KEY_PATTERN.test(k) || k === '__proto__') fail(`${path}.body.${k}`, 'invalid key');
      out[k] = asTemplate((x as Obj)[k], `${path}.body.${k}`, MAX_BODY_VALUE, API_PLACEHOLDERS, 0);
    });
    return out;
  });
  if (body !== undefined) action.body = body;
  const link = optional(o, 'insertResultLink', (x) => {
    if (typeof x !== 'string' || !RESULT_FIELD_PATTERN.test(x))
      fail(`${path}.insertResultLink`, 'must be a plain JSON field name');
    return x as string;
  });
  if (link !== undefined) action.insertResultLink = link;
  return action;
}

function validateApi(v: unknown, path: string): ApiPermission {
  const o = asObject(v, path, ['host', 'actions']);
  const host = asApiHost(o.host, `${path}.host`);
  const actions = asArray(o.actions, `${path}.actions`, MAX_API_ACTIONS).map((a, i) =>
    validateApiAction(a, `${path}.actions[${i}]`)
  );
  if (actions.length === 0) fail(`${path}.actions`, 'needs at least one action');
  if (new Set(actions.map((a) => a.id)).size !== actions.length)
    fail(`${path}.actions`, 'duplicate action id');
  return { host, actions };
}

function validateWidget(v: unknown, path: string): WidgetPermission {
  const o = asObject(v, path, ['url', 'name', 'capabilities', 'parameters']);
  const raw = asString(o.url, `${path}.url`, MAX_URL);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return fail(`${path}.url`, 'not a valid URL');
  }
  const devLocal = import.meta.env.DEV && u.protocol === 'http:' && isLocalDevHost(u.host);
  if (u.protocol !== 'https:' && !devLocal) fail(`${path}.url`, 'must be an https URL');
  if (u.username || u.password) fail(`${path}.url`, 'must not contain credentials');
  if (!devLocal) asHost(u.hostname, `${path}.url`);
  if (raw.includes('#')) fail(`${path}.url`, 'must not have a fragment');
  if (raw.includes('$')) fail(`${path}.url`, 'template variables are not supported');
  if (u.searchParams.has('theme') || u.searchParams.has('lang'))
    fail(`${path}.url`, 'theme and lang are added by the client');
  const capabilities = asArray(
    o.capabilities,
    `${path}.capabilities`,
    WIDGET_CAPABILITY_IDS.length
  ).map((c, i) => {
    if (typeof c !== 'string' || !WIDGET_CAPABILITY_IDS.includes(c))
      return fail(
        `${path}.capabilities[${i}]`,
        `must be one of ${WIDGET_CAPABILITY_IDS.join(', ')}`
      );
    return c;
  });
  if (new Set(capabilities).size !== capabilities.length)
    fail(`${path}.capabilities`, 'duplicate capability');
  const widget: WidgetPermission = { url: raw, capabilities };
  const name = optional(o, 'name', (x) => asString(x, `${path}.name`, MAX_NAME));
  if (name !== undefined) widget.name = name;
  const parameters = optional(o, 'parameters', (x) => {
    const list = asArray(x, `${path}.parameters`, WIDGET_PARAMETERS.length).map((p, i) => {
      if (typeof p !== 'string' || !(WIDGET_PARAMETERS as readonly string[]).includes(p))
        return fail(`${path}.parameters[${i}]`, `must be one of ${WIDGET_PARAMETERS.join(', ')}`);
      return p as WidgetParameter;
    });
    if (new Set(list).size !== list.length) fail(`${path}.parameters`, 'duplicate parameter');
    return list;
  });
  if (parameters !== undefined) widget.parameters = parameters;
  return widget;
}

function validateCommand(
  v: unknown,
  path: string,
  api: ApiPermission | undefined,
  widget: WidgetPermission | undefined
): SlashCommand {
  const o = asObject(v, path, ['name', 'description', 'usage', 'insert', 'api', 'widget']);
  const name = asString(o.name, `${path}.name`, 24);
  if (!COMMAND_NAME_PATTERN.test(name)) fail(`${path}.name`, 'invalid command name');
  const cmd: SlashCommand = {
    name,
    description: asString(o.description, `${path}.description`, MAX_COMMAND_DESCRIPTION),
  };
  const usage = optional(o, 'usage', (x) => {
    const u = asString(x, `${path}.usage`, MAX_COMMAND_USAGE);
    if (u !== `/${name}` && !u.startsWith(`/${name} `))
      fail(`${path}.usage`, `must start with "/${name}"`);
    return u;
  });
  if (usage !== undefined) cmd.usage = usage;
  if ([o.insert, o.api, o.widget].filter((x) => x !== undefined).length !== 1)
    fail(path, 'needs exactly one of "insert", "api" or "widget"');
  if (o.widget !== undefined) {
    if (o.widget !== true) fail(`${path}.widget`, 'must be true');
    if (!widget) fail(`${path}.widget`, 'requires permissions.widget');
    cmd.widget = true;
  } else if (o.insert !== undefined)
    cmd.insert = asTemplate(o.insert, `${path}.insert`, MAX_INSERT, ['room', 'args']);
  else {
    const target = asString(o.api, `${path}.api`, 32);
    if (!api?.actions.some((a) => a.id === target))
      fail(`${path}.api`, 'no such action in permissions.api.actions');
    cmd.api = target;
  }
  return cmd;
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
  // api and widget first: commands cross-check their targets against them.
  if (o.api !== undefined) out.api = validateApi(o.api, `${path}.api`);
  if (o.widget !== undefined) out.widget = validateWidget(o.widget, `${path}.widget`);
  if (o.commands !== undefined) {
    const commands = asArray(o.commands, `${path}.commands`, MAX_COMMANDS).map((c, i) =>
      validateCommand(c, `${path}.commands[${i}]`, out.api, out.widget)
    );
    if (new Set(commands.map((c) => c.name)).size !== commands.length)
      fail(`${path}.commands`, 'duplicate command name');
    out.commands = commands;
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
    const o = asObject(raw, 'repo', ['schema', 'key', 'serial', 'name', 'integrations']);
    if (o.schema !== MANIFEST_SCHEMA) fail('repo.schema', `must be ${MANIFEST_SCHEMA}`);
    const key = asString(o.key, 'repo.key', 44, 44);
    if (!isValidKey(key)) fail('repo.key', 'must be base64 of a 32-byte public key');
    const serial = o.serial;
    if (
      typeof serial !== 'number' ||
      !Number.isInteger(serial) ||
      serial < 1 ||
      serial > MAX_SERIAL
    )
      fail('repo.serial', `must be an integer from 1 to ${MAX_SERIAL}`);
    const name = asString(o.name, 'repo.name', MAX_REPO_NAME);
    const integrations = asArray(o.integrations, 'repo.integrations', MAX_INTEGRATIONS).map(
      (it, i) => validateIntegration(it, `repo.integrations[${i}]`)
    );
    if (new Set(integrations.map((i) => i.id)).size !== integrations.length)
      fail('repo.integrations', 'duplicate integration id');
    return {
      ok: true,
      value: { schema: MANIFEST_SCHEMA, key, serial: serial as number, name, integrations },
    };
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
