/**
 * Fixtures for customEvents.ts and the parts of widget.ts / permissions.ts that use it (the repo
 * has no unit test runner). `runCustomEventExamples()` returns the names of failing cases; empty =
 * all good. The manifest-level cases (what a repo.json may declare) are in manifest.examples.ts.
 */
import {
  MAX_CUSTOM_EVENT_CONTENT,
  checkEventType,
  isDeclaredEventType,
  validateCustomEventContent,
} from './customEvents';
import type { WidgetPermission } from './manifest';
import { permissionsWidened } from './permissions';
import { customEventCapabilities, resolveCapabilities } from './widget';

const TYPE = 'com.example.fileshare.sent';
const OTHER = 'com.example.fileshare.ack';
const ROOM = '!r:x.org';
const TIMELINE = `org.matrix.msc2762.timeline:${ROOM}`;

const GOOD_TYPES = [
  TYPE,
  OTHER,
  'a1.b2.c3',
  'app.example.x-1.y_2',
  `com.example.${'a'.repeat(68)}`, // 80 characters
];
const BAD_TYPES: Array<[string, unknown]> = [
  ['m.foo.bar', 'm.foo.bar'],
  ['m.room.message', 'm.room.message'],
  ['org.matrix.x.y', 'org.matrix.x.y'],
  ['im.vector.a.b', 'im.vector.a.b'],
  ['io.element.a.b', 'io.element.a.b'],
  ['twoSegments', 'com.example'],
  ['uppercase', 'com.Example.app.sent'],
  ['81chars', `com.example.${'a'.repeat(69)}`],
  ['empty', ''],
  ['nonString', 42],
  ['null', null],
  ['undefined', undefined],
  ['leadingDot', '.com.example.app'],
  ['trailingDot', 'com.example.app.'],
  ['emptySegment', 'a..b.c'],
  ['segmentLeadingDash', 'com.-example.app'],
  ['space', 'com.example.a b'],
  ['wildcard', 'com.example.*'],
  ['hash', 'com.example.a#b'],
];

const big = { text: 'x'.repeat(MAX_CUSTOM_EVENT_CONTENT) };
const atLimit = { text: 'x'.repeat(MAX_CUSTOM_EVENT_CONTENT - '{"text":""}'.length) };

const GOOD_CONTENT: Array<[string, unknown]> = [
  ['empty', {}],
  ['plain', { file: 'mxc://x/y', size: 3, nested: { a: [1, 2] } }],
  ['atLimit', atLimit],
  ['nestedRelatesTo', { inner: { 'm.relates_to': {} } }],
];
const BAD_CONTENT: Array<[string, unknown]> = [
  ['array', [{ a: 1 }]],
  ['null', null],
  ['undefined', undefined],
  ['string', 'hello'],
  ['number', 1],
  ['oversize', big],
  ['relatesTo', { 'm.relates_to': { rel_type: 'm.thread', event_id: '$x' } }],
  ['relatesToNull', { 'm.relates_to': null }],
  ['mentions', { 'm.mentions': { room: true } }],
  ['bigint', { n: BigInt(1) }],
];

export function runCustomEventExamples(): string[] {
  const problems: string[] = [];
  const check = (name: string, cond: boolean) => {
    if (!cond) problems.push(name);
  };

  GOOD_TYPES.forEach((t) => check(`type:good:${t}`, checkEventType(t) === null));
  BAD_TYPES.forEach(([name, t]) => check(`type:bad:${name}`, checkEventType(t) !== null));

  // isDeclaredEventType: exact, case-sensitive match against the approved list, and still valid.
  check('declared:hit', isDeclaredEventType(TYPE, [TYPE, OTHER]));
  check('declared:other', !isDeclaredEventType('com.example.fileshare.new', [TYPE, OTHER]));
  check('declared:none', !isDeclaredEventType(TYPE, []));
  check('declared:case', !isDeclaredEventType(TYPE.toUpperCase(), [TYPE]));
  check('declared:prefix', !isDeclaredEventType('com.example.fileshare', [TYPE]));
  check('declared:message', !isDeclaredEventType('m.room.message', [TYPE]));
  check('declared:reservedEvenIfListed', !isDeclaredEventType('m.foo.bar', ['m.foo.bar']));
  check('declared:nonString', !isDeclaredEventType(undefined, [TYPE]));

  GOOD_CONTENT.forEach(([n, c]) =>
    check(`content:good:${n}`, validateCustomEventContent(c) === null)
  );
  BAD_CONTENT.forEach(([n, c]) =>
    check(`content:bad:${n}`, validateCustomEventContent(c) !== null)
  );

  // resolveCapabilities with declared types.
  const [send, read] = customEventCapabilities(TYPE);
  const [sendO, readO] = customEventCapabilities(OTHER);
  const asked = [send, read, sendO, readO, TIMELINE, 'm.sticker'];
  const got = resolveCapabilities(asked, [], ROOM, [TYPE]);
  check('resolve:eventGrantsBoth', got.has(send) && got.has(read));
  check('resolve:eventTimeline', got.has(TIMELINE));
  check('resolve:eventOnlyDeclared', !got.has(sendO) && !got.has(readO) && !got.has('m.sticker'));
  check('resolve:eventExact', got.size === 3);
  check(
    'resolve:eventNoRoomNoTimeline',
    !resolveCapabilities(asked, [], undefined, [TYPE]).has(TIMELINE)
  );
  check(
    'resolve:eventOtherRoom',
    resolveCapabilities(['org.matrix.msc2762.timeline:!o:x'], [], ROOM, [TYPE]).size === 0
  );
  check('resolve:eventNotApproved', resolveCapabilities(asked, ['read.room'], ROOM, []).size === 0);
  check(
    'resolve:eventWithCatalogue',
    resolveCapabilities(asked, ['send.message'], ROOM, [TYPE]).size === 3
  );
  check(
    'resolve:eventReservedIgnored',
    resolveCapabilities(customEventCapabilities('m.foo.bar'), [], ROOM, ['m.foo.bar']).size === 0
  );
  check('resolve:eventDefaultParam', resolveCapabilities(asked, [], ROOM).size === 0);

  // Re-approval: a new or different type widens, removing one does not.
  const widget = (events?: string[]): { widget: WidgetPermission } => ({
    widget: {
      url: 'https://app.example.com/w',
      capabilities: ['send.message'],
      ...(events ? { events } : {}),
    },
  });
  check('widened:sameEvents', !permissionsWidened(widget([TYPE]), widget([TYPE])));
  check('widened:newEvent', permissionsWidened(widget(), widget([TYPE])));
  check('widened:addedEvent', permissionsWidened(widget([TYPE]), widget([TYPE, OTHER])));
  check('widened:changedEvent', permissionsWidened(widget([TYPE]), widget([OTHER])));
  check('widened:removedEvent', !permissionsWidened(widget([TYPE, OTHER]), widget([TYPE])));
  check('widened:removedAll', !permissionsWidened(widget([TYPE]), widget()));
  check('widened:emptyIsNone', !permissionsWidened(widget(), widget([])));

  return problems;
}
