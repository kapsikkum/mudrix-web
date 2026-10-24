#!/usr/bin/env node
/**
 * Fills the test homeserver (up.mjs) with accounts, profiles, cosmetics, rooms and history, for
 * testing and README screenshots. Run once on fresh data; `up.mjs reset` starts over.
 *
 *   node dev/test-server/seed.mjs
 *
 * Every account's password is PASSWORD below. Log in to Mudrix with the homeserver URL from
 * .generated/env.json and e.g. `ash` / PASSWORD.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join as joinPath } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = JSON.parse(readFileSync(joinPath(here, '.generated', 'env.json'), 'utf8'));
export const PASSWORD = 'mudrix-test-password';
const HS = env.homeserver;

// ── tiny PNG writer, for generated avatars ──
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A 256px avatar: a diagonal gradient between two colours with a soft glow in one corner. */
function avatarPng([r1, g1, b1], [r2, g2, b2], seed) {
  const size = 256;
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const gx = 60 + ((seed * 53) % 140);
  const gy = 60 + ((seed * 97) % 140);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const t = (x + y) / (2 * size);
      const d = Math.hypot(x - gx, y - gy) / size;
      const glow = Math.max(0, 0.45 - d) * 1.6;
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.min(255, r1 + (r2 - r1) * t + 255 * glow * 0.5);
      raw[o + 1] = Math.min(255, g1 + (g2 - g1) * t + 255 * glow * 0.5);
      raw[o + 2] = Math.min(255, b1 + (b2 - b1) * t + 255 * glow * 0.5);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Matrix client-server helpers ──
async function api(token, method, path, body, { raw, contentType } = {}) {
  const res = await fetch(`${HS}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': contentType ?? 'application/json' } : {}),
    },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(`${method} ${path}: ${res.status} ${text}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function register(username) {
  try {
    const first = await api(null, 'POST', '/_matrix/client/v3/register', {
      username,
      password: PASSWORD,
      inhibit_login: false,
    }).catch((e) => {
      if (e.status === 401) return e.body;
      throw e;
    });
    if (first.access_token) return first;
    return await api(null, 'POST', '/_matrix/client/v3/register', {
      username,
      password: PASSWORD,
      auth: {
        type: 'm.login.registration_token',
        token: env.registrationToken,
        session: first.session,
      },
    });
  } catch (e) {
    if (e.body?.errcode !== 'M_USER_IN_USE') throw e;
    return api(null, 'POST', '/_matrix/client/v3/login', {
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: username },
      password: PASSWORD,
    });
  }
}

let txn = 0;
const enc = encodeURIComponent;
const send = (u, roomId, content, type = 'm.room.message') =>
  api(
    u.token,
    'PUT',
    `/_matrix/client/v3/rooms/${enc(roomId)}/send/${type}/seed${Date.now()}${(txn += 1)}`,
    content
  );
const text = (u, roomId, body, html) =>
  send(u, roomId, {
    msgtype: 'm.text',
    body,
    ...(html ? { format: 'org.matrix.custom.html', formatted_body: html } : {}),
  });
const join = (u, roomId) => api(u.token, 'POST', `/_matrix/client/v3/join/${enc(roomId)}`, {});

async function profilePrefix() {
  const versions = await api(null, 'GET', '/_matrix/client/versions');
  const stable =
    versions.versions?.includes('v1.16') || versions.unstable_features?.['uk.tcpip.msc4133.stable'];
  return stable ? '/_matrix/client/v3' : '/_matrix/client/unstable/uk.tcpip.msc4133';
}

// ── the cast ──
const PEOPLE = [
  {
    user: 'ash',
    name: 'Ash',
    colours: [
      [94, 53, 177],
      [233, 30, 99],
    ],
    decoration: 'crown',
    nameplate: 'aurora',
    status: { emoji: '🎧', text: 'Listening to lo-fi' },
    bio: 'Testing Mudrix so you do not have to.',
    pronouns: 'they/them',
  },
  {
    user: 'juno',
    name: 'Juno',
    colours: [
      [0, 150, 136],
      [3, 169, 244],
    ],
    decoration: 'cat-ears',
    nameplate: 'sunset',
  },
  // No avatar: shows the mud mound placeholder.
  { user: 'theo', name: 'Theo', decoration: 'headphones' },
  {
    user: 'mira',
    name: 'Mira',
    colours: [
      [255, 152, 0],
      [244, 67, 54],
    ],
    decoration: 'halo',
    nameplate: 'ocean-waves',
  },
  {
    user: 'wren',
    name: 'Wren',
    colours: [
      [76, 175, 80],
      [205, 220, 57],
    ],
  },
  {
    user: 'sable',
    name: 'Sable',
    colours: [
      [33, 33, 33],
      [121, 85, 72],
    ],
    decoration: 'flame',
    nameplate: 'starry-night',
  },
];

const users = {};
const prefix = await profilePrefix();
for (const [i, p] of PEOPLE.entries()) {
  const login = await register(p.user);
  const u = { ...p, token: login.access_token, id: login.user_id };
  users[p.user] = u;
  await api(u.token, 'PUT', `/_matrix/client/v3/profile/${enc(u.id)}/displayname`, {
    displayname: p.name,
  });
  if (p.colours) {
    const png = avatarPng(p.colours[0], p.colours[1], i + 1);
    const { content_uri: mxc } = await api(
      u.token,
      'POST',
      '/_matrix/media/v3/upload?filename=avatar.png',
      png,
      {
        raw: true,
        contentType: 'image/png',
      }
    );
    await api(u.token, 'PUT', `/_matrix/client/v3/profile/${enc(u.id)}/avatar_url`, {
      avatar_url: mxc,
    });
  }
  const fields = {
    'chat.mudrix.is_user': true,
    ...(p.decoration ? { 'chat.mudrix.avatar_decoration': p.decoration } : {}),
    ...(p.nameplate ? { 'chat.mudrix.nameplate': p.nameplate } : {}),
    ...(p.status ? { 'chat.mudrix.status': p.status } : {}),
    ...(p.bio ? { 'm.biography': [{ body: p.bio, mimetype: 'text/plain' }] } : {}),
    ...(p.pronouns ? { 'm.pronouns': [{ summary: p.pronouns, language: 'en' }] } : {}),
  };
  for (const [key, value] of Object.entries(fields)) {
    await api(u.token, 'PUT', `${prefix}/profile/${enc(u.id)}/${enc(key)}`, { [key]: value }).catch(
      (e) => console.warn(`  ${p.user}: could not set ${key}: ${e.message}`)
    );
  }
  console.log(`user ${u.id}`);
}

const { ash, juno, theo, mira, wren, sable } = users;
const marker = await api(
  ash.token,
  'GET',
  `/_matrix/client/v3/user/${enc(ash.id)}/account_data/chat.mudrix.test.seeded`
).catch(() => null);
if (marker?.done) {
  console.log('Rooms were already seeded; run `node dev/test-server/up.mjs reset` to start over.');
  process.exit(0);
}

async function dm(a, b) {
  const { room_id: roomId } = await api(a.token, 'POST', '/_matrix/client/v3/createRoom', {
    preset: 'trusted_private_chat',
    is_direct: true,
    invite: [b.id],
  });
  await join(b, roomId);
  for (const [me, other] of [
    [a, b],
    [b, a],
  ]) {
    const current = await api(
      me.token,
      'GET',
      `/_matrix/client/v3/user/${enc(me.id)}/account_data/m.direct`
    ).catch(() => ({}));
    current[other.id] = [...(current[other.id] ?? []), roomId];
    await api(
      me.token,
      'PUT',
      `/_matrix/client/v3/user/${enc(me.id)}/account_data/m.direct`,
      current
    );
  }
  return roomId;
}

async function room(owner, name, members, extra = {}) {
  const { room_id: roomId } = await api(owner.token, 'POST', '/_matrix/client/v3/createRoom', {
    preset: 'public_chat',
    name,
    // Like Element: anyone in the room may join its calls.
    power_level_content_override: {
      events: { 'org.matrix.msc3401.call.member': 0, 'org.matrix.msc3401.call': 0 },
    },
    ...extra,
  });
  for (const m of members) await join(m, roomId);
  return roomId;
}

// DMs
const dmJuno = await dm(ash, juno);
await text(juno, dmJuno, 'are we still on for tonight?');
await text(ash, dmJuno, 'yes! bringing snacks 🍿');
const q = await text(juno, dmJuno, 'perfect, I will set up the call');
await send(
  ash,
  dmJuno,
  { 'm.relates_to': { rel_type: 'm.annotation', event_id: q.event_id, key: '💜' } },
  'm.reaction'
);

const dmTheo = await dm(ash, theo);
await text(theo, dmTheo, 'did you see the new sound packs?');
await text(ash, dmTheo, 'the NES one is so good');

// A space with text and voice rooms
const everyone = [juno, theo, mira, wren, sable];
const general = await room(ash, 'general', everyone, { topic: 'Say hi 👋' });
const art = await room(ash, 'art-dump', everyone, { topic: 'Show us what you made' });
const voice = await room(ash, 'Hangout', everyone, {
  creation_content: { type: 'org.matrix.msc3417.call' },
  initial_state: [{ type: 'org.matrix.msc3401.call', state_key: '', content: {} }],
});
const space = await room(ash, 'Mud Club', everyone, {
  creation_content: { type: 'm.space' },
  topic: 'A test space for Mudrix',
});
for (const child of [general, art, voice]) {
  await api(
    ash.token,
    'PUT',
    `/_matrix/client/v3/rooms/${enc(space)}/state/m.space.child/${enc(child)}`,
    {
      via: [env.serverName],
      suggested: true,
    }
  );
}

const chat = [
  [mira, 'morning everyone ☀️'],
  [wren, 'morning! who is around for a call later?'],
  [sable, 'me, after 6'],
  [juno, 'same. testing the new call layout'],
  [theo, 'my avatar is still a mud blob 😅'],
  [ash, 'it suits you'],
  [
    mira,
    '```js\nconsole.log("hello from Mudrix");\n```',
    '<pre><code class="language-js">console.log("hello from Mudrix");\n</code></pre>',
  ],
  [wren, 'see you in Hangout at 6 then'],
];
let last;
for (const [who, body, html] of chat) last = await text(who, general, body, html);
for (const [who, key] of [
  [ash, '👍'],
  [juno, '👍'],
  [sable, '🎉'],
]) {
  await send(
    who,
    general,
    { 'm.relates_to': { rel_type: 'm.annotation', event_id: last.event_id, key } },
    'm.reaction'
  );
}
await text(sable, art, 'new wallpaper, thoughts?');
await text(mira, art, 'the colours 😍');

await api(
  ash.token,
  'PUT',
  `/_matrix/client/v3/user/${enc(ash.id)}/account_data/chat.mudrix.test.seeded`,
  { done: true }
);

const summary = {
  password: PASSWORD,
  users: Object.fromEntries(Object.values(users).map((u) => [u.user, u.id])),
  rooms: { dmJuno, dmTheo, general, art, voice, space },
};
writeFileSync(joinPath(here, '.generated', 'seed.json'), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Seeded. Log in at ${HS} as ash / ${PASSWORD}.`);
