import type { ComposerAction, LinkCardRule, Permissions } from './manifest';

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

/**
 * True when `next` lets the integration do anything `prev` did not already allow: a new
 * capability, host, rule or action, a broader path, or changed text the user would see or insert.
 * Pure; the store uses it to decide whether an update needs fresh approval.
 */
export function permissionsWidened(prev: Permissions, next: Permissions): boolean {
  const oldRules = prev.linkCards ?? [];
  if ((next.linkCards ?? []).some((r) => !ruleCovered(r, oldRules))) return true;
  const oldActions = prev.composerActions ?? [];
  return (next.composerActions ?? []).some((a) => !actionCovered(a, oldActions));
}
