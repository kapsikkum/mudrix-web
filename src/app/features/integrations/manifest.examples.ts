/**
 * The repo has no unit test runner, so these fixtures stand in for tests. `runManifestExamples()`
 * returns the names of any fixture that does not behave as labelled (empty array = all good).
 * Wire it into a test runner if one is added later.
 */
import {
  MAX_MANIFEST_BYTES,
  hasCapability,
  parseManifestText,
  runsCode,
  validateManifest,
  type Permissions,
} from './manifest';
import { previewApiRequest } from './api';
import { getApiActions, getCommands, getWidgets, matchLinkCard, renderInsert } from './matching';
import { permissionsWidened } from './permissions';
import {
  WIDGET_ALLOW,
  WIDGET_SANDBOX,
  assertWidgetUrlAllowed,
  buildWidgetUrl,
  resolveCapabilities,
} from './widget';
import { WIDGET_CAPABILITY_CATALOGUE } from './widgetCapabilities';
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
  key: 'BBCkDWX+I1E0LatjaZwEUWCdjQG+roO4/udFi4AhyvM=',
  serial: 1,
  name: 'Sample',
  integrations,
  ...over,
});
const withPerms = (p: unknown) => repo([integration({}, p)]);
const act = (over: Record<string, unknown> = {}) => ({
  id: 'push',
  label: 'Send to Example',
  path: '/v1/push',
  body: { room: '{room}', text: '{text}' },
  insertResultLink: 'url',
  ...over,
});
const api = (actions: unknown[] = [act()], host: unknown = 'api.example.com') => ({
  host,
  actions,
});
const cmd = (over: Record<string, unknown> = {}) => ({
  name: 'send',
  description: 'Send a note',
  usage: '/send <note>',
  insert: 'https://x.example/s?room={room}&q={args}',
  ...over,
});
const wid = (over: Record<string, unknown> = {}) => ({
  url: 'https://app.example.com/mudrix',
  name: 'AlterSend',
  capabilities: ['send.message', 'read.messages'],
  parameters: ['room_id'],
  ...over,
});
const widCmd = (over: Record<string, unknown> = {}) =>
  cmd({ name: 'open', usage: undefined, insert: undefined, widget: true, ...over });
const apiCmd = () => cmd({ name: 'push', usage: undefined, insert: undefined, api: 'push' });

export const GOOD_MANIFESTS: Record<string, unknown> = {
  full: repo(),
  empty: repo([]),
  noPermissions: repo([integration({}, {})]),
  httpsIcon: repo([integration({ icon: 'https://cdn.example/i.png' })]),
  apiAndCommands: withPerms({ api: api(), commands: [cmd(), apiCmd()] }),
  apiNoBody: withPerms({ api: api([act({ body: undefined, insertResultLink: undefined })]) }),
  commandInsertOnly: withPerms({ commands: [cmd()] }),
  widgetFull: withPerms({ widget: wid(), commands: [widCmd()] }),
  widgetDisplayOnly: withPerms({ widget: { url: 'https://app.example.com/', capabilities: [] } }),
  widgetQueryKept: withPerms({ widget: wid({ url: 'https://app.example.com/w?mode=a' }) }),
  widgetOneEvent: withPerms({ widget: wid({ events: ['com.example.fileshare.sent'] }) }),
  widgetThreeEvents: withPerms({
    widget: wid({
      events: ['com.example.fileshare.sent', 'com.example.fileshare.ack', 'app.example.x-1.y_2'],
    }),
  }),
  widgetEventMaxLength: withPerms({
    widget: wid({ events: [`com.example.${'a'.repeat(68)}`] }),
  }),
  widgetEventsEmptyList: withPerms({ widget: wid({ events: [] }) }),
  widgetFromLinksViewer: withPerms({
    widget: wid({ capabilities: [], fromLinks: true, linkLabel: 'Download', saveFiles: true }),
  }),
  widgetFromLinksNoLabel: withPerms({ widget: wid({ capabilities: [], fromLinks: true }) }),
  widgetSaveFilesOnly: withPerms({ widget: wid({ saveFiles: true }) }),
  widgetEventsNoOtherCapability: withPerms({
    widget: wid({ capabilities: [], events: ['com.example.fileshare.sent'] }),
  }),
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
  apiUnknownKey: withPerms({ api: { ...api(), headers: {} } }),
  apiActionUnknownKey: withPerms({ api: api([act({ method: 'GET' })]) }),
  apiHeaderField: withPerms({ api: api([act({ headers: { A: 'b' } })]) }),
  apiQueryInPath: withPerms({ api: api([act({ path: '/v1/push?x=1' })]) }),
  apiPercentInPath: withPerms({ api: api([act({ path: '/v1/%2e%2e' })]) }),
  apiDotDotPath: withPerms({ api: api([act({ path: '/v1/../x' })]) }),
  apiRelativePath: withPerms({ api: api([act({ path: 'v1/push' })]) }),
  apiWildcardHost: withPerms({ api: api([act()], '*.example.com') }),
  apiHostPort: withPerms({ api: api([act()], 'api.example.com:8443') }),
  apiHostUppercase: withPerms({ api: api([act()], 'API.example.com') }),
  apiHostIp: withPerms({ api: api([act()], '10.0.0.1') }),
  apiHostWithScheme: withPerms({ api: api([act()], 'https://api.example.com') }),
  apiNoActions: withPerms({ api: api([]) }),
  apiTooManyActions: withPerms({
    api: api(Array.from({ length: 5 }, (_, i) => act({ id: `a${i}` }))),
  }),
  apiDuplicateActionId: withPerms({ api: api([act(), act()]) }),
  apiBadPlaceholder: withPerms({ api: api([act({ body: { u: '{user}' } })]) }),
  apiNestedBrace: withPerms({ api: api([act({ body: { u: '{{room}' } })]) }),
  apiBodyNonString: withPerms({ api: api([act({ body: { n: 1 } })]) }),
  apiBodyNested: withPerms({ api: api([act({ body: { n: { a: 'b' } } })]) }),
  apiBodyBadKey: withPerms({ api: api([act({ body: { 'a b': 'x' } })]) }),
  apiBodyProtoKey: withPerms({ api: api([act({ body: JSON.parse('{"__proto__":"x"}') })]) }),
  apiBodyLongValue: withPerms({ api: api([act({ body: { a: 'x'.repeat(201) } })]) }),
  apiBodyTooManyKeys: withPerms({
    api: api([
      act({ body: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`k${i}`, 'x'])) }),
    ]),
  }),
  apiBadResultField: withPerms({ api: api([act({ insertResultLink: 'a.b' })]) }),
  apiLongLabel: withPerms({ api: api([act({ label: 'x'.repeat(25) })]) }),
  commandBothInsertAndApi: withPerms({ api: api(), commands: [cmd({ api: 'push' })] }),
  commandNeither: withPerms({ commands: [cmd({ insert: undefined })] }),
  commandApiTargetMissing: withPerms({
    api: api(),
    commands: [cmd({ insert: undefined, api: 'nope' })],
  }),
  commandApiWithoutApiPermission: withPerms({
    commands: [cmd({ insert: undefined, api: 'push' })],
  }),
  commandDuplicateNames: withPerms({ commands: [cmd(), cmd()] }),
  commandBadName: withPerms({ commands: [cmd({ name: 'Send', usage: undefined })] }),
  commandNameWithSlash: withPerms({ commands: [cmd({ name: '/send', usage: undefined })] }),
  commandShortName: withPerms({ commands: [cmd({ name: 'a', usage: undefined })] }),
  commandBadPlaceholder: withPerms({ commands: [cmd({ insert: 'x {text}' })] }),
  commandUsageMismatch: withPerms({ commands: [cmd({ usage: '/other <x>' })] }),
  commandUsageNoSlash: withPerms({ commands: [cmd({ usage: 'send <x>' })] }),
  commandLongDescription: withPerms({ commands: [cmd({ description: 'x'.repeat(81) })] }),
  commandUnknownKey: withPerms({ commands: [cmd({ icon: 'send' })] }),
  commandNewlineInInsert: withPerms({ commands: [cmd({ insert: 'a\nb' })] }),
  widgetUnknownKey: withPerms({ widget: wid({ allow: 'camera' }) }),
  widgetUnknownCapability: withPerms({ widget: wid({ capabilities: ['send.event'] }) }),
  widgetRawCapabilityString: withPerms({
    widget: wid({ capabilities: ['org.matrix.msc2762.send.event:m.room.message'] }),
  }),
  widgetDuplicateCapability: withPerms({
    widget: wid({ capabilities: ['send.message', 'send.message'] }),
  }),
  widgetCapabilitiesMissing: withPerms({ widget: { url: 'https://app.example.com/' } }),
  widgetBadParameter: withPerms({ widget: wid({ parameters: ['access_token'] }) }),
  widgetDuplicateParameter: withPerms({ widget: wid({ parameters: ['room_id', 'room_id'] }) }),
  widgetTemplateVariable: withPerms({
    widget: wid({ url: 'https://app.example.com/w?u=$matrix_user_id' }),
  }),
  widgetHttpUrl: withPerms({ widget: wid({ url: 'http://app.example.com/w' }) }),
  widgetCredentialsUrl: withPerms({ widget: wid({ url: 'https://u:p@app.example.com/w' }) }),
  widgetFragmentUrl: withPerms({ widget: wid({ url: 'https://app.example.com/w#x' }) }),
  widgetThemeInQuery: withPerms({ widget: wid({ url: 'https://app.example.com/w?theme=dark' }) }),
  widgetLangInQuery: withPerms({ widget: wid({ url: 'https://app.example.com/w?lang=en' }) }),
  widgetIpUrl: withPerms({ widget: wid({ url: 'https://10.0.0.1/w' }) }),
  widgetLongName: withPerms({ widget: wid({ name: 'x'.repeat(41) }) }),
  widgetFourEvents: withPerms({
    widget: wid({
      events: [
        'com.example.a.one',
        'com.example.a.two',
        'com.example.a.three',
        'com.example.a.four',
      ],
    }),
  }),
  widgetDuplicateEvents: withPerms({
    widget: wid({ events: ['com.example.a.one', 'com.example.a.one'] }),
  }),
  widgetEventMNamespace: withPerms({ widget: wid({ events: ['m.foo.bar'] }) }),
  widgetEventOrgMatrix: withPerms({ widget: wid({ events: ['org.matrix.x.y'] }) }),
  widgetEventImVector: withPerms({ widget: wid({ events: ['im.vector.a.b'] }) }),
  widgetEventIoElement: withPerms({ widget: wid({ events: ['io.element.a.b'] }) }),
  widgetEventTwoSegments: withPerms({ widget: wid({ events: ['com.example'] }) }),
  widgetEventUppercase: withPerms({ widget: wid({ events: ['com.Example.app.sent'] }) }),
  widgetEventTooLong: withPerms({ widget: wid({ events: [`com.example.${'a'.repeat(69)}`] }) }),
  widgetFromLinksFalse: withPerms({ widget: wid({ fromLinks: false }) }),
  widgetFromLinksString: withPerms({ widget: wid({ fromLinks: 'yes' }) }),
  widgetSaveFilesFalse: withPerms({ widget: wid({ saveFiles: false }) }),
  widgetLinkLabelAlone: withPerms({ widget: wid({ linkLabel: 'Download' }) }),
  widgetLinkLabelTooLong: withPerms({
    widget: wid({ fromLinks: true, linkLabel: 'x'.repeat(25) }),
  }),
  widgetEventEmptyString: withPerms({ widget: wid({ events: [''] }) }),
  widgetEventNonString: withPerms({ widget: wid({ events: [42] }) }),
  widgetEventNull: withPerms({ widget: wid({ events: [null] }) }),
  widgetEventLeadingDot: withPerms({ widget: wid({ events: ['.com.example.app'] }) }),
  widgetEventEmptySegment: withPerms({ widget: wid({ events: ['a..b.c'] }) }),
  widgetEventTrailingDot: withPerms({ widget: wid({ events: ['com.example.app.'] }) }),
  widgetEventSegmentStartsWithDash: withPerms({ widget: wid({ events: ['com.-example.app'] }) }),
  widgetEventSpace: withPerms({ widget: wid({ events: ['com.example.a b'] }) }),
  widgetEventWildcard: withPerms({ widget: wid({ events: ['com.example.*'] }) }),
  widgetEventsNotArray: withPerms({ widget: wid({ events: 'com.example.app.sent' }) }),
  widgetCommandWithoutPermission: withPerms({ commands: [widCmd()] }),
  widgetCommandFalse: withPerms({ widget: wid(), commands: [widCmd({ widget: false })] }),
  widgetCommandAndInsert: withPerms({ widget: wid(), commands: [widCmd({ insert: 'x' })] }),
  widgetCommandAndApi: withPerms({
    widget: wid(),
    api: api(),
    commands: [widCmd({ api: 'push' })],
  }),
  tooManyCommands: withPerms({
    commands: Array.from({ length: 7 }, (_, i) => cmd({ name: `cmd-${i}`, usage: undefined })),
  }),
  wrongType: repo([integration({ version: 1 })]),
  badSchema: repo([], { schema: 2 }),
  missingKey: repo([], { key: undefined }),
  shortKey: repo([], { key: 'AAAA' }),
  garbageKey: repo([], { key: '!'.repeat(44) }),
  missingSerial: repo([], { serial: undefined }),
  zeroSerial: repo([], { serial: 0 }),
  hugeSerial: repo([], { serial: 2147483648 }),
  fractionalSerial: repo([], { serial: 1.5 }),
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
    // Local hosts are accepted by dev builds only.
    ['https://localhost/repo.json', import.meta.env.DEV],
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

  // Local api hosts: valid in dev builds only.
  ['localhost', 'localhost:8080', '127.0.0.1:3000'].forEach((h) => {
    if (validateManifest(withPerms({ api: api([act()], h) })).ok !== import.meta.env.DEV)
      problems.push(`apiHost:${h}`);
  });
  if (validateManifest(withPerms({ api: api([act()], 'localhost:99999') })).ok)
    problems.push('apiHost:badPort');

  // The same local-http url is a dev-only exception.
  if (
    validateManifest(withPerms({ widget: wid({ url: 'http://localhost:8080/w' }) })).ok !==
    import.meta.env.DEV
  )
    problems.push('widgetUrl:localhost');
  if (validateManifest(withPerms({ widget: wid({ url: 'https://localhost/w' }) })).ok)
    problems.push('widgetUrl:httpsLocalhost');

  checkApiAndCommands(problems);
  checkWidget(problems);
  return problems;
}

type Perms = Permissions;

const installedOf = (id: string, permissions: Perms, enabled = true): InstalledIntegration => ({
  id,
  repoUrl: 'x',
  name: id,
  description: '',
  version: '1',
  permissions,
  enabled,
  approvedAt: 0,
});

function checkWidening(p: Perms, problems: string[]) {
  const a0 = p.api!.actions[0];
  const cmds = p.commands!;
  const withActions = (actions: NonNullable<Perms['api']>['actions']) => ({
    ...p,
    api: { ...p.api!, actions },
  });
  const widened = (n: Perms) => permissionsWidened(p, n);
  if (widened(p)) problems.push('api:widenedSame');
  if (!permissionsWidened({ ...p, api: undefined }, p)) problems.push('api:widenedNew');
  if (!widened({ ...p, api: { ...p.api!, host: 'other.example.com' } }))
    problems.push('api:widenedHost');
  if (!widened(withActions([...p.api!.actions, { ...a0, id: 'two' }])))
    problems.push('api:widenedAction');
  if (!widened(withActions([{ ...a0, path: '/v2/push' }]))) problems.push('api:widenedPath');
  if (!widened(withActions([{ ...a0, body: { room: '{room}' } }])))
    problems.push('api:widenedBody');
  if (!widened(withActions([{ ...a0, body: undefined }]))) problems.push('api:widenedBodyDropped');
  if (!widened(withActions([{ ...a0, insertResultLink: 'link' }])))
    problems.push('api:widenedLinkField');
  if (!widened(withActions([{ ...a0, label: 'Other' }]))) problems.push('api:widenedLabel');
  if (widened(withActions([{ ...a0, body: { text: '{text}', room: '{room}' } }])))
    problems.push('api:widenedKeyOrder');
  if (widened({ ...p, api: undefined })) problems.push('api:removalIsNarrowing');
  if (!widened({ ...p, commands: [...cmds, { name: 'more', description: 'm', insert: 'x' }] }))
    problems.push('commands:widenedNew');
  if (!widened({ ...p, commands: [{ ...cmds[0], description: 'Changed' }, ...cmds.slice(1)] }))
    problems.push('commands:widenedDescription');
  if (
    !widened({
      ...p,
      commands: [{ ...cmds[0], insert: 'https://evil.example/{args}' }, ...cmds.slice(1)],
    })
  )
    problems.push('commands:widenedInsert');
  if (!widened({ ...p, commands: [{ ...cmds[0], usage: '/send changed' }, ...cmds.slice(1)] }))
    problems.push('commands:widenedUsage');
  if (!widened({ ...p, commands: [cmds[0], { ...cmds[1], api: 'other' }] }))
    problems.push('commands:widenedApiTarget');
  if (widened({ ...p, commands: cmds.slice(0, 1) })) problems.push('commands:removalIsNarrowing');
  if (!permissionsWidened({ linkCards: p.linkCards }, p)) problems.push('commands:widenedFromNone');
}

function checkApiAndCommands(problems: string[]) {
  const parsed = validateManifest(
    withPerms({
      api: api(),
      linkCards: [{ hosts: ['api.example.com'], title: 'T' }],
      commands: [cmd(), apiCmd(), cmd({ name: 'kick', usage: undefined })],
    })
  );
  if (!parsed.ok) {
    problems.push('api:setup');
    return;
  }
  const p = parsed.value.integrations[0].permissions;
  const a0 = p.api!.actions[0];
  const inst = [installedOf('one', p)];
  const all = { one: { api: true, commands: true } };
  checkWidening({ ...p, commands: p.commands!.slice(0, 2) }, problems);

  // matching
  const apiActions = getApiActions(inst, all);
  if (apiActions.length !== 1 || apiActions[0].host !== 'api.example.com')
    problems.push('getApiActions:hit');
  if (getApiActions(inst, { one: { api: false } }).length) problems.push('getApiActions:revoked');
  if (getApiActions([installedOf('one', p, false)], all).length)
    problems.push('getApiActions:disabled');
  if (getApiActions(inst, { one: { commands: true } }).length)
    problems.push('getApiActions:noGrant');

  const reserved = new Set(['kick', 'ban']);
  const found = getCommands(inst, all, reserved);
  if (found.map((c) => c.name).join() !== 'send,push') problems.push('getCommands:reservedDropped');
  if (found.map((c) => c.kind).join() !== 'insert,api') problems.push('getCommands:kinds');
  if (
    getCommands(inst, { one: { commands: true } }, reserved)
      .map((c) => c.name)
      .join() !== 'send'
  )
    problems.push('getCommands:apiNeedsApiGrant');
  if (getCommands(inst, { one: { api: true } }, reserved).length)
    problems.push('getCommands:noGrant');
  const grants2 = { ...all, two: all.one };
  const dup = getCommands([installedOf('one', p), installedOf('two', p)], grants2, reserved);
  if (dup.length !== 2 || dup.some((c) => c.integrationId !== 'one'))
    problems.push('getCommands:firstWins');
  const skip = getCommands(
    [installedOf('one', p, false), installedOf('two', p)],
    grants2,
    reserved
  );
  if (skip.length !== 2 || skip.some((c) => c.integrationId !== 'two'))
    problems.push('getCommands:disabledDoesNotShadow');

  // renderInsert
  const tpl = 'https://x.example/s?room={room}&q={args}';
  if (renderInsert(tpl, '!a:b.c', 'hi there') !== 'https://x.example/s?room=!a%3Ab.c&q=hi there')
    problems.push('render:basic');
  if (renderInsert('{args}', 'r', 'a\nb‮c') !== 'abc') problems.push('render:stripped');
  if (renderInsert('{args}', 'r', 'x'.repeat(600)).length !== 500) problems.push('render:capped');
  if (renderInsert('{args}', 'r', '{room}') !== '{room}') problems.push('render:noReexpand');

  // previewApiRequest
  const ctx = { roomId: '!r:x.org', text: '', args: '' };
  const nasty = 'say "hi"\nline2 \\ {room} {"a":1}';
  const prev = previewApiRequest({ permissions: p }, a0, { ...ctx, text: nasty });
  if (!prev.ok) problems.push('preview:ok');
  else {
    const body = JSON.parse(prev.body ?? 'null') as Record<string, string>;
    if (body.text !== nasty || body.room !== '!r:x.org') problems.push('preview:roundTrip');
    if (Object.keys(body).length !== 2) problems.push('preview:keys');
    if (prev.body?.includes('\n')) problems.push('preview:rawNewline');
    if (prev.url !== 'https://api.example.com/v1/push' || prev.host !== 'api.example.com')
      problems.push('preview:url');
    if (prev.path !== '/v1/push') problems.push('preview:path');
  }
  if (previewApiRequest({ permissions: p }, a0, { ...ctx, text: 'x'.repeat(9000) }).ok)
    problems.push('preview:tooBig');
  const nobody = previewApiRequest({ permissions: p }, { ...a0, body: undefined }, ctx);
  if (!nobody.ok || nobody.body !== null) problems.push('preview:noBody');
  if (previewApiRequest({ permissions: {} }, a0, ctx).ok) problems.push('preview:noApi');
}

function checkWidget(problems: string[]) {
  const parsed = validateManifest(
    withPerms({ widget: wid(), commands: [widCmd(), cmd({ name: 'note', usage: undefined })] })
  );
  if (!parsed.ok) {
    problems.push('widget:setup');
    return;
  }
  const p = parsed.value.integrations[0].permissions;
  const w = p.widget!;
  if (!runsCode(p) || runsCode({ api: undefined })) problems.push('widget:runsCode');
  if (!hasCapability(p, 'widget') || hasCapability({}, 'widget')) problems.push('widget:has');

  // widening: anything that changes what the code may do or where it comes from
  const widened = (n: Permissions) => permissionsWidened(p, n);
  const withW = (over: Partial<NonNullable<Permissions['widget']>>): Permissions => ({
    ...p,
    widget: { ...w, ...over },
  });
  if (widened(p)) problems.push('widget:widenedSame');
  if (!permissionsWidened({ ...p, widget: undefined }, p)) problems.push('widget:widenedNew');
  if (!widened(withW({ capabilities: [...w.capabilities, 'read.room'] })))
    problems.push('widget:widenedCapability');
  if (!widened(withW({ url: 'https://app.example.com/other' })))
    problems.push('widget:widenedPath');
  if (!widened(withW({ url: 'https://evil.example.org/mudrix' })))
    problems.push('widget:widenedOrigin');
  if (!widened(withW({ parameters: ['room_id', 'user_id'] })))
    problems.push('widget:widenedParameter');
  if (!widened(withW({ name: 'Other' }))) problems.push('widget:widenedName');
  if (widened(withW({ capabilities: ['send.message'] }))) problems.push('widget:narrowCaps');
  if (widened(withW({ parameters: [] }))) problems.push('widget:narrowParams');
  if (widened({ ...p, widget: undefined, commands: undefined })) problems.push('widget:removal');
  if (
    !widened({ ...p, commands: [...p.commands!, { name: 'go', description: 'g', widget: true }] })
  )
    problems.push('widget:widenedCommand');

  // commands
  const inst = [installedOf('one', p)];
  const kinds = (g: Record<string, Record<string, boolean>>) =>
    getCommands(inst, g, new Set<string>())
      .map((c) => `${c.name}:${c.kind}`)
      .join();
  if (kinds({ one: { commands: true, widget: true } }) !== 'open:widget,note:insert')
    problems.push('widget:commandKinds');
  if (kinds({ one: { commands: true } }) !== 'note:insert')
    problems.push('widget:commandNeedsGrant');
  if (getWidgets(inst, { one: { widget: true } }).length !== 1) problems.push('getWidgets:hit');
  if (getWidgets(inst, { one: { commands: true } }).length) problems.push('getWidgets:noGrant');
  if (getWidgets([installedOf('one', p, false)], { one: { widget: true } }).length)
    problems.push('getWidgets:disabled');

  // buildWidgetUrl
  const ctx = {
    roomId: '!r:x.org',
    userId: '@a b:x.org',
    displayName: 'Ünï & "co" ?x=1#h',
    theme: 'dark' as const,
    lang: 'en-GB',
  };
  const bare = new URL(buildWidgetUrl({ url: 'https://app.example.com/mudrix' }, ctx));
  if (bare.pathname !== '/mudrix' || [...bare.searchParams.keys()].join() !== 'theme,lang')
    problems.push('buildWidgetUrl:bare');
  const some = new URL(buildWidgetUrl(w, ctx));
  if (some.searchParams.get('room_id') !== '!r:x.org' || some.searchParams.has('user_id'))
    problems.push('buildWidgetUrl:subset');
  const all = new URL(
    buildWidgetUrl(
      {
        url: 'https://app.example.com/w?mode=a',
        parameters: ['room_id', 'user_id', 'display_name'],
      },
      ctx
    )
  );
  if (
    all.searchParams.get('display_name') !== ctx.displayName ||
    all.searchParams.get('user_id') !== ctx.userId ||
    all.searchParams.get('mode') !== 'a' ||
    all.hash !== '' ||
    all.host !== 'app.example.com'
  )
    problems.push('buildWidgetUrl:encoding');

  // resolveCapabilities
  const cap = (id: string) => WIDGET_CAPABILITY_CATALOGUE.find((c) => c.id === id)!.capabilities[0];
  const send = cap('send.message');
  const asked = [send, cap('read.messages'), 'org.matrix.msc3819.send.to_device:m.x', 'm.sticker'];
  const got = resolveCapabilities(asked, ['send.message']);
  if (got.size !== 1 || !got.has(send)) problems.push('resolve:dropsUnapproved');
  if (resolveCapabilities(asked, []).size) problems.push('resolve:none');
  if (resolveCapabilities(asked, ['nonsense']).size) problems.push('resolve:unknownId');
  const tl = 'org.matrix.msc2762.timeline:!r:x.org';
  const tlOther = 'org.matrix.msc2762.timeline:!other:x';
  if (resolveCapabilities([tl], ['send.message']).size) problems.push('resolve:timelineNoRoom');
  const inRoom = resolveCapabilities([tl, tlOther], ['send.message'], '!r:x.org');
  if (inRoom.size !== 1 || !inRoom.has(tl)) problems.push('resolve:timelineRoom');
  if (resolveCapabilities([tl], ['read.room'], '!r:x.org').size)
    problems.push('resolve:timelineNotNeeded');

  // assertWidgetUrlAllowed
  const origin = window.location.origin;
  if (assertWidgetUrlAllowed(`${origin}/x`).ok) problems.push('allowed:sameOrigin');
  if (assertWidgetUrlAllowed(origin).ok) problems.push('allowed:sameOriginRoot');
  if (assertWidgetUrlAllowed('http://app.example.com/x').ok) problems.push('allowed:http');
  if (assertWidgetUrlAllowed('https://u:p@app.example.com/x').ok) problems.push('allowed:creds');
  if (assertWidgetUrlAllowed('not a url').ok) problems.push('allowed:invalid');
  if (origin !== 'https://app.example.com' && !assertWidgetUrlAllowed(w.url).ok)
    problems.push('allowed:otherOrigin');

  if (WIDGET_ALLOW !== '' || WIDGET_SANDBOX.includes('allow-top-navigation'))
    problems.push('widget:sandboxConstants');
}
