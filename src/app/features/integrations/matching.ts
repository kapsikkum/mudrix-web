import {
  stripUnsafeChars,
  type ApiAction,
  type Capability,
  type ComposerAction,
  type LinkCardRule,
  type WidgetPermission,
} from './manifest';
import type { GrantMap, InstalledIntegration } from './types';

export interface LinkCardMatch {
  integrationId: string;
  integrationName: string;
  rule: LinkCardRule;
}

export interface ActiveComposerAction extends ComposerAction {
  integrationId: string;
  integrationName: string;
}

export interface ActiveApiAction extends ApiAction {
  integrationId: string;
  integrationName: string;
  host: string;
}

export interface ActiveCommand {
  name: string;
  description: string;
  usage?: string;
  kind: 'insert' | 'api' | 'widget';
  /** Template, for kind insert. */
  insert?: string;
  /** Id of an action in the same integration's api actions, for kind api. */
  api?: string;
  integrationId: string;
  integrationName: string;
}

function active(i: InstalledIntegration, grants: GrantMap, cap: Capability) {
  return i.enabled && grants[i.id]?.[cap] === true;
}

/** First enabled, granted link-card rule matching this link by exact host and path prefix. */
export function matchLinkCard(
  url: string,
  installed: readonly InstalledIntegration[],
  grants: GrantMap
): LinkCardMatch | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  const host = u.hostname.toLowerCase();
  for (const i of installed) {
    if (active(i, grants, 'linkCards')) {
      const rule = (i.permissions.linkCards ?? []).find(
        (r) => r.hosts.includes(host) && u.pathname.startsWith(r.pathPrefix ?? '/')
      );
      if (rule) return { integrationId: i.id, integrationName: i.name, rule };
    }
  }
  return null;
}

/** Composer actions of every enabled integration whose composerActions grant is still on. */
export function getComposerActions(
  installed: readonly InstalledIntegration[],
  grants: GrantMap
): ActiveComposerAction[] {
  return installed
    .filter((i) => active(i, grants, 'composerActions'))
    .flatMap((i) =>
      (i.permissions.composerActions ?? []).map((a) => ({
        ...a,
        integrationId: i.id,
        integrationName: i.name,
      }))
    );
}

/** API actions of every enabled integration whose api grant is still on. */
export function getApiActions(
  installed: readonly InstalledIntegration[],
  grants: GrantMap
): ActiveApiAction[] {
  return installed
    .filter((i) => active(i, grants, 'api') && i.permissions.api)
    .flatMap((i) => {
      const { host, actions } = i.permissions.api!;
      return actions.map((a) => ({ ...a, integrationId: i.id, integrationName: i.name, host }));
    });
}

export interface ActiveWidget extends WidgetPermission {
  integrationId: string;
  integrationName: string;
}

/** Widgets of every enabled integration whose widget grant is still on. */
export function getWidgets(
  installed: readonly InstalledIntegration[],
  grants: GrantMap
): ActiveWidget[] {
  return installed.flatMap((i) =>
    active(i, grants, 'widget') && i.permissions.widget
      ? [{ ...i.permissions.widget, integrationId: i.id, integrationName: i.name }]
      : []
  );
}

/**
 * Slash commands of enabled, granted integrations. Names in `reserved` (built-in commands and
 * aliases) are dropped so an integration can never shadow them; between integrations the first
 * installed wins. Api commands also need the api grant and an existing target action.
 */
export function getCommands(
  installed: readonly InstalledIntegration[],
  grants: GrantMap,
  reserved: ReadonlySet<string>
): ActiveCommand[] {
  const seen = new Set<string>();
  const out: ActiveCommand[] = [];
  installed.forEach((i) => {
    if (!active(i, grants, 'commands')) return;
    (i.permissions.commands ?? []).forEach((c) => {
      const name = c.name.toLowerCase();
      if (reserved.has(name) || seen.has(name)) return;
      const kind: ActiveCommand['kind'] =
        c.widget === true ? 'widget' : c.api !== undefined ? 'api' : 'insert';
      if (kind === 'api') {
        if (!active(i, grants, 'api')) return;
        if (!i.permissions.api?.actions.some((a) => a.id === c.api)) return;
      } else if (kind === 'widget') {
        if (!active(i, grants, 'widget') || !i.permissions.widget) return;
      } else if (c.insert === undefined) return;
      seen.add(name);
      const { widget: _w, ...rest } = c;
      out.push({ ...rest, kind, integrationId: i.id, integrationName: i.name });
    });
  });
  return out;
}

const MAX_ARGS = 500;
const TEMPLATE_PLACEHOLDER = /\{(room|args)\}/g;

/**
 * Fills `{room}` (URL-encoded) and `{args}` (what was typed after the command, as plain text
 * minus control/invisible characters, capped). The result is plain text for the composer.
 * One pass, so substituted text is never re-expanded.
 */
export function renderInsert(insert: string, roomId: string, args = ''): string {
  const cleanArgs = stripUnsafeChars(args).slice(0, MAX_ARGS);
  return insert.replace(TEMPLATE_PLACEHOLDER, (_m, name: string) =>
    name === 'room' ? encodeURIComponent(roomId) : cleanArgs
  );
}
