/**
 * Fixtures for the pure rules around updates and link matching. `runBehaviourExamples()` returns
 * the names of the cases that failed (an empty list means all passed).
 */
import type { Integration } from './manifest';
import { findLinkViewer, matchLinkCard } from './matching';
import { assertViewerUrlAllowed } from './widget';
import { reconcile } from './store';
import type { GrantMap, InstalledIntegration } from './types';

const card = (hosts: string[], pathPrefix?: string) => ({
  hosts,
  title: 'Card',
  ...(pathPrefix ? { pathPrefix } : {}),
});

const widget = (events?: string[]) => ({
  url: 'https://widgets.example.com/a',
  capabilities: ['send.message'],
  ...(events ? { events } : {}),
});

const offered = (version: string, permissions: Integration['permissions']): Integration => ({
  id: 'one',
  name: 'One',
  description: 'Test integration',
  version,
  permissions,
});

const installed = (
  version: string,
  permissions: InstalledIntegration['permissions'],
  extra: Partial<InstalledIntegration> = {}
): InstalledIntegration => ({
  id: 'one',
  repoUrl: 'https://repo.example.com/repo.json',
  name: 'One',
  description: 'Test integration',
  version,
  permissions,
  enabled: true,
  approvedAt: 0,
  publisherFingerprint: 'aaaa',
  ...extra,
});

const grants: GrantMap = { one: { linkCards: true } };

export function runBehaviourExamples(): string[] {
  const failures: string[] = [];
  const check = (name: string, ok: boolean) => {
    if (!ok) failures.push(name);
  };
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  // Narrowing never needs a newer version string.
  const wide = installed('1.0.0', {
    linkCards: [card(['a.example.com']), card(['b.example.com'])],
  });
  const narrowSameVersion = reconcile(
    wide,
    offered('1.0.0', { linkCards: [card(['a.example.com'])] })
  );
  check(
    'narrower update, same version, is taken',
    narrowSameVersion.permissions.linkCards?.length === 1
  );
  const narrowLowerVersion = reconcile(
    wide,
    offered('0.9.0', { linkCards: [card(['a.example.com'])] })
  );
  check(
    'narrower update, lower version, is taken',
    narrowLowerVersion.permissions.linkCards?.length === 1
  );

  // Widening waits for approval and leaves the approved permissions in force.
  const narrow = installed('1.0.0', { linkCards: [card(['a.example.com'])] });
  const widened = reconcile(
    narrow,
    offered('1.1.0', { linkCards: [card(['a.example.com']), card(['b.example.com'])] })
  );
  check('widening becomes a pending update', widened.pendingUpdate !== undefined);
  check('widening keeps the approved permissions', same(widened.permissions, narrow.permissions));
  const widenedSameVersion = reconcile(
    narrow,
    offered('1.0.0', { linkCards: [card(['a.example.com']), card(['b.example.com'])] })
  );
  check(
    'widening with the same version is still pending',
    widenedSameVersion.pendingUpdate !== undefined
  );

  // A widget event type is part of what needs approval.
  const w0 = installed('1.0.0', { widget: widget() });
  const w1 = reconcile(w0, offered('1.0.0', { widget: widget(['com.example.app.sent']) }));
  check('a new widget event type is pending', w1.pendingUpdate !== undefined);
  const w2 = installed('1.0.0', { widget: widget(['com.example.app.sent']) });
  const w3 = reconcile(w2, offered('1.0.0', { widget: widget() }));
  check('dropping a widget event type is taken', w3.permissions.widget?.events === undefined);

  // Nothing changed: the very same object comes back (no needless writes).
  const plain = installed('1.0.0', { linkCards: [card(['a.example.com'])] });
  check(
    'unchanged keeps the same object',
    reconcile(plain, offered('1.0.0', { linkCards: [card(['a.example.com'])] })) === plain
  );

  // Withdrawn by its repository: flagged, still installed, comes back when offered again.
  const gone = reconcile(plain, undefined);
  check('withdrawn integration is flagged', gone.sourceGone === true);
  const back = reconcile(gone, offered('1.0.0', { linkCards: [card(['a.example.com'])] }));
  check('a returning integration is not flagged', back.sourceGone === undefined);

  // Link matching: exact host, default port, path boundary.
  const withPath = [installed('1.0.0', { linkCards: [card(['app.example.com'], '/s')] })];
  const match = (url: string) => matchLinkCard(url, withPath, grants) !== null;
  check('link: exact path', match('https://app.example.com/s'));
  check('link: below the prefix', match('https://app.example.com/s/abc'));
  check('link: not a longer segment', !match('https://app.example.com/sx'));
  check('link: not outside the prefix', !match('https://app.example.com/other'));
  check('link: not another port', !match('https://app.example.com:8443/s/abc'));
  check('link: not http', !match('http://app.example.com/s/abc'));
  check('link: not userinfo', !match('https://user:pw@app.example.com/s/abc'));
  check('link: not a look-alike host', !match('https://app.example.com.evil.example/s/abc'));
  const rootCard = [installed('1.0.0', { linkCards: [card(['app.example.com'])] })];
  check(
    'link: no prefix covers the whole host',
    matchLinkCard('https://app.example.com/anything', rootCard, grants) !== null
  );

  // A card's link opens in a window only on exactly the approved origin.
  const wUrl = 'https://app.example.com/';
  const viewerOk = (link: string) => assertViewerUrlAllowed(wUrl, link).ok;
  check(
    'viewer: fragment link on the host',
    viewerOk('https://app.example.com/r#' + 'a'.repeat(64))
  );
  check('viewer: query link on the host', viewerOk('https://app.example.com/s?x=1'));
  check('viewer: not another host', !viewerOk('https://other.example.com/r#abc'));
  check('viewer: not a look-alike host', !viewerOk('https://app.example.com.evil.example/r#abc'));
  check('viewer: not another port', !viewerOk('https://app.example.com:8443/r#abc'));
  check('viewer: not http', !viewerOk('http://app.example.com/r#abc'));
  check('viewer: not credentials', !viewerOk('https://user:pw@app.example.com/r#abc'));
  check('viewer: not whitespace', !viewerOk('https://app.example.com/a b'));
  check('viewer: not too long', !viewerOk('https://app.example.com/' + 'a'.repeat(1000)));
  check(
    'viewer: not the app origin',
    !assertViewerUrlAllowed(window.location.origin + '/', window.location.origin + '/x').ok
  );

  const viewerInstall = installed('1.0.0', {
    linkCards: [card(['app.example.com'])],
    widget: { url: wUrl, capabilities: [], fromLinks: true, saveFiles: true },
  });
  const widgetGrants: GrantMap = { one: { linkCards: true, widget: true } };
  const found = findLinkViewer('https://app.example.com/r#abc', [viewerInstall], widgetGrants);
  check('viewer found with the grant', found !== null && found.saveFiles === true);
  check(
    'viewer needs the widget grant',
    findLinkViewer('https://app.example.com/r#abc', [viewerInstall], grants) === null
  );
  check(
    'viewer needs the integration enabled',
    findLinkViewer(
      'https://app.example.com/r#abc',
      [{ ...viewerInstall, enabled: false }],
      widgetGrants
    ) === null
  );
  check(
    'viewer ignores other hosts',
    findLinkViewer('https://other.example.com/r#abc', [viewerInstall], widgetGrants) === null
  );

  // Turning on the window or downloads is a widening that needs approval again.
  const plainWidget = installed('1.0.0', { widget: { url: wUrl, capabilities: [] } });
  const withViewer = reconcile(
    plainWidget,
    offered('1.0.0', { widget: { url: wUrl, capabilities: [], fromLinks: true } })
  );
  check('adding fromLinks is pending', withViewer.pendingUpdate !== undefined);
  const withSave = reconcile(
    plainWidget,
    offered('1.0.0', { widget: { url: wUrl, capabilities: [], saveFiles: true } })
  );
  check('adding saveFiles is pending', withSave.pendingUpdate !== undefined);
  const dropped = reconcile(
    viewerInstall,
    offered('1.0.0', {
      linkCards: [card(['app.example.com'])],
      widget: { url: wUrl, capabilities: [] },
    })
  );
  check(
    'dropping fromLinks and saveFiles is taken',
    dropped.permissions.widget?.fromLinks === undefined && dropped.pendingUpdate === undefined
  );

  return failures;
}
