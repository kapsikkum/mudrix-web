import type { ComposerAction, LinkCardRule } from './manifest';
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

function active(i: InstalledIntegration, grants: GrantMap, cap: 'linkCards' | 'composerActions') {
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

/** Fills the one allowed placeholder. The result is plain text for the composer. */
export function renderInsert(insert: string, roomId: string): string {
  return insert.split('{room}').join(encodeURIComponent(roomId));
}
