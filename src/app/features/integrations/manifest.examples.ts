/**
 * The repo has no unit test runner, so these fixtures stand in for tests. `runManifestExamples()`
 * returns the names of any fixture that does not behave as labelled (empty array = all good).
 * Wire it into a test runner if one is added later.
 */
import { MAX_MANIFEST_BYTES, parseManifestText, validateManifest } from './manifest';
import { matchLinkCard } from './matching';
import { permissionsWidened } from './permissions';
import { parseRepoUrl } from './repository';
import type { InstalledIntegration } from './types';

const integration = (over: Record<string, unknown> = {}, perms: unknown = undefined) => ({
  id: 'altersend',
  name: 'AlterSend',
  description: 'Sample',
  version: '1.0.0',
  permissions: perms ?? {
    linkCards: [{ hosts: ['altersend.example'], pathPrefix: '/pay', title: 'Pay' }],
    composerActions: [
      {
        id: 'send',
        label: 'Send',
        icon: 'send',
        insert: 'https://altersend.example/s?room={room}',
      },
    ],
  },
  ...over,
});
const repo = (integrations: unknown[] = [integration()], over: Record<string, unknown> = {}) => ({
  schema: 1,
  name: 'Sample',
  integrations,
  ...over,
});
const withPerms = (p: unknown) => repo([integration({}, p)]);

export const GOOD_MANIFESTS: Record<string, unknown> = {
  full: repo(),
  empty: repo([]),
  noPermissions: repo([integration({}, {})]),
  httpsIcon: repo([integration({ icon: 'https://cdn.example/i.png' })]),
};

export const BAD_MANIFESTS: Record<string, unknown> = {
  unknownTopKey: repo([integration()], { extra: 1 }),
  unknownIntegrationKey: repo([integration({ homepage: 'x' })]),
  unknownPermission: withPerms({ network: [] }),
  httpIcon: repo([integration({ icon: 'http://cdn.example/i.png' })]),
  userinfoIcon: repo([integration({ icon: 'https://u:p@cdn.example/i.png' })]),
  bidiInName: repo([integration({ name: 'Alter‮Send' })]),
  zeroWidthInTitle: withPerms({ linkCards: [{ hosts: ['a.example'], title: 'Pa​y' }] }),
  newlineInInsert: withPerms({ composerActions: [{ id: 'a', label: 'A', insert: 'x\ny' }] }),
  badPlaceholder: withPerms({ composerActions: [{ id: 'a', label: 'A', insert: 'x?u={user}' }] }),
  wildcardHost: withPerms({ linkCards: [{ hosts: ['*.example.com'], title: 'x' }] }),
  ipHost: withPerms({ linkCards: [{ hosts: ['10.0.0.1'], title: 'x' }] }),
  uppercaseHost: withPerms({ linkCards: [{ hosts: ['Example.com'], title: 'x' }] }),
  badPathPrefix: withPerms({
    linkCards: [{ hosts: ['a.example'], pathPrefix: 'pay', title: 'x' }],
  }),
  badIcon: withPerms({ composerActions: [{ id: 'a', label: 'A', icon: 'rocket', insert: 'x' }] }),
  duplicateIntegrationId: repo([integration(), integration()]),
  duplicateActionId: withPerms({
    composerActions: [
      { id: 'a', label: 'A', insert: 'x' },
      { id: 'a', label: 'B', insert: 'y' },
    ],
  }),
  wrongType: repo([integration({ version: 1 })]),
  badSchema: repo([], { schema: 2 }),
  badId: repo([integration({ id: 'Bad Id' })]),
  tooLongName: repo([integration({ name: 'x'.repeat(41) })]),
  tooManyActions: withPerms({
    composerActions: Array.from({ length: 7 }, (_, i) => ({
      id: `a${i}`,
      label: 'A',
      insert: 'x',
    })),
  }),
};

export function runManifestExamples(): string[] {
  const problems: string[] = [];
  Object.entries(GOOD_MANIFESTS).forEach(([k, v]) => {
    if (!validateManifest(v).ok) problems.push(`good:${k}`);
  });
  Object.entries(BAD_MANIFESTS).forEach(([k, v]) => {
    if (validateManifest(v).ok) problems.push(`bad:${k}`);
  });
  const oversize = JSON.stringify(repo([], { name: 'x'.repeat(MAX_MANIFEST_BYTES) }));
  if (parseManifestText(oversize).ok) problems.push('bad:oversize');
  if (parseManifestText('{not json').ok) problems.push('bad:notJson');

  const urls: Array<[string, boolean]> = [
    ['https://example.com/repo.json', true],
    ['https://github.com/o/r', true],
    ['https://github.com/o/r/tree/main', true],
    ['http://example.com/repo.json', false],
    ['https://user:pw@example.com/repo.json', false],
    ['https://192.168.1.2/repo.json', false],
    ['https://localhost/repo.json', false],
    ['ftp://example.com/x', false],
  ];
  urls.forEach(([u, expected]) => {
    if (parseRepoUrl(u).ok !== expected) problems.push(`url:${u}`);
  });

  const parsed = validateManifest(repo());
  if (parsed.ok) {
    const p = parsed.value.integrations[0].permissions;
    const widerHost = {
      linkCards: [{ ...p.linkCards![0], hosts: ['altersend.example', 'b.example'] }],
    };
    if (permissionsWidened(p, p)) problems.push('widened:same');
    if (!permissionsWidened({}, p)) problems.push('widened:newCapability');
    if (!permissionsWidened(p, { ...p, ...widerHost })) problems.push('widened:newHost');
    if (permissionsWidened(p, { linkCards: p.linkCards })) problems.push('widened:narrower');

    const installed: InstalledIntegration[] = [
      {
        id: 'altersend',
        repoUrl: 'x',
        name: 'AlterSend',
        description: '',
        version: '1',
        permissions: p,
        enabled: true,
        approvedAt: 0,
      },
    ];
    const on = { altersend: { linkCards: true } };
    if (!matchLinkCard('https://altersend.example/pay/1', installed, on))
      problems.push('match:hit');
    if (matchLinkCard('https://altersend.example/other', installed, on))
      problems.push('match:path');
    if (matchLinkCard('http://altersend.example/pay', installed, on)) problems.push('match:http');
    if (matchLinkCard('https://evil.altersend.example/pay', installed, on))
      problems.push('match:subdomain');
    if (
      matchLinkCard('https://altersend.example/pay', installed, { altersend: { linkCards: false } })
    )
      problems.push('match:revoked');
    if (matchLinkCard('https://altersend.example/pay', [{ ...installed[0], enabled: false }], on))
      problems.push('match:disabled');
  } else problems.push('setup');
  return problems;
}
