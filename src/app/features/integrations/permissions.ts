import type {
  ApiAction,
  ApiPermission,
  ComposerAction,
  LinkCardRule,
  Permissions,
  SlashCommand,
  WidgetPermission,
} from './manifest';

/** An old rule already allowed everything the new rule would: same or fewer hosts, same or deeper path. */
function ruleCovered(next: LinkCardRule, old: LinkCardRule[]): boolean {
  return old.some(
    (o) =>
      next.hosts.every((h) => o.hosts.includes(h)) &&
      (o.pathPrefix === undefined || (next.pathPrefix ?? '').startsWith(o.pathPrefix)) &&
      o.title === next.title &&
      o.subtitle === next.subtitle &&
      o.buttonLabel === next.buttonLabel &&
      o.icon === next.icon
  );
}

function actionCovered(next: ComposerAction, old: ComposerAction[]): boolean {
  return old.some((o) => o.id === next.id && o.insert === next.insert && o.label === next.label);
}

function sameBody(a: Record<string, string> | undefined, b: Record<string, string> | undefined) {
  if (a === undefined || b === undefined) return a === b;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/** Any difference at all counts: the user approved this exact request. */
function apiActionCovered(next: ApiAction, old: ApiAction[]): boolean {
  return old.some(
    (o) =>
      o.id === next.id &&
      o.label === next.label &&
      o.path === next.path &&
      o.insertResultLink === next.insertResultLink &&
      sameBody(o.body, next.body)
  );
}

function apiCovered(next: ApiPermission, old: ApiPermission | undefined): boolean {
  return (
    old !== undefined &&
    old.host === next.host &&
    next.actions.every((a) => apiActionCovered(a, old.actions))
  );
}

function commandCovered(next: SlashCommand, old: SlashCommand[]): boolean {
  return old.some(
    (o) =>
      o.name === next.name &&
      o.description === next.description &&
      o.usage === next.usage &&
      o.insert === next.insert &&
      o.api === next.api &&
      o.widget === next.widget
  );
}

/** Code that runs: any change at all (url, name, a new capability or parameter) needs approval. */
function widgetCovered(next: WidgetPermission, old: WidgetPermission | undefined): boolean {
  return (
    old !== undefined &&
    old.url === next.url &&
    old.name === next.name &&
    next.capabilities.every((c) => old.capabilities.includes(c)) &&
    (next.parameters ?? []).every((p) => (old.parameters ?? []).includes(p))
  );
}

/**
 * True when `next` lets the integration do anything `prev` did not already allow: a new
 * capability, host, rule, action or command, a broader path, or changed text, request or body
 * the user would see, insert or send. Pure; the store uses it to decide whether an update needs
 * fresh approval.
 */
export function permissionsWidened(prev: Permissions, next: Permissions): boolean {
  const oldRules = prev.linkCards ?? [];
  if ((next.linkCards ?? []).some((r) => !ruleCovered(r, oldRules))) return true;
  const oldActions = prev.composerActions ?? [];
  if ((next.composerActions ?? []).some((a) => !actionCovered(a, oldActions))) return true;
  if (next.api && !apiCovered(next.api, prev.api)) return true;
  if (next.widget && !widgetCovered(next.widget, prev.widget)) return true;
  const oldCommands = prev.commands ?? [];
  return (next.commands ?? []).some((c) => !commandCovered(c, oldCommands));
}
