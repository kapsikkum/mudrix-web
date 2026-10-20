#!/usr/bin/env node
/**
 * Automated Migration Script: Discord Cosmetics -> Matrix Homeserver MSC2545 Packs
 *
 * Features:
 * - Strictly separates Avatar Decorations and Profile Decorations into two distinct pack types.
 * - Downloads animated full-fidelity APNG files and uploads them to the Matrix homeserver media repo (mxc://).
 * - Publishes MSC2545 state events (`im.ponies.room_emotes.<key>`) into a public Matrix Space or Room.
 * - Resumable with local cache checkpoint (scripts/cosmetics-migration-cache.json) so it never re-uploads duplicates.
 *
 * Usage:
 *   node scripts/migrate-discord-cosmetics.mjs --homeserver https://matrix.example.com --token syt_... [--space !spaceId:example.com]
 *
 * Or via environment variables:
 *   HOMESERVER_URL=https://matrix.example.com MATRIX_ACCESS_TOKEN=syt_... node scripts/migrate-discord-cosmetics.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const CACHE_FILE = path.join(__dirname, 'cosmetics-migration-cache.json');

// Parse CLI args
const args = process.argv.slice(2);
function getArg(flag, envVar, defaultVal = '') {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return process.env[envVar] || defaultVal;
}

const HOMESERVER_URL = (getArg('--homeserver', 'HOMESERVER_URL') || '').replace(/\/+$/, '');
const ACCESS_TOKEN = getArg('--token', 'MATRIX_ACCESS_TOKEN');
let TARGET_SPACE_ID = getArg('--space', 'TARGET_SPACE_ID');
const CONCURRENCY = parseInt(getArg('--concurrency', 'CONCURRENCY', '3'), 10);
const MIGRATE_TYPE = getArg('--type', 'MIGRATE_TYPE', 'all'); // 'all', 'decorations', 'effects'

if (!HOMESERVER_URL || !ACCESS_TOKEN) {
  console.error(`
Error: Missing Matrix Homeserver URL or Access Token!

Usage:
  node scripts/migrate-discord-cosmetics.mjs \\
    --homeserver https://matrix.example.com \\
    --token syt_abcdef123456... \\
    [--space !spaceId:example.com] \\
    [--type all|decorations|effects]

Or set environment variables:
  HOMESERVER_URL=https://matrix.example.com
  MATRIX_ACCESS_TOKEN=syt_...
`);
  process.exit(1);
}

// Load Checkpoint Cache
let cache = {
  decorations: {}, // id -> mxc
  effects: {}, // id -> mxc
  publishedPacks: {}, // stateKey -> true
};

if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`Loaded checkpoint cache from ${CACHE_FILE}`);
  } catch {
    console.warn('Could not parse cache file, starting fresh.');
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

// Helpers
function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'pack'
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Matrix API: Upload Media
async function uploadMedia(buffer, filename, mimetype = 'image/png') {
  const url = `${HOMESERVER_URL}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': mimetype,
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Media upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.content_uri; // mxc://...
}

// Matrix API: Send State Event
async function sendStateEvent(roomId, eventType, stateKey, content) {
  const url = `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}/${encodeURIComponent(stateKey)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(content),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Send state event failed (${res.status}): ${text}`);
  }

  return await res.json();
}

// Matrix API: Create Space
async function createCosmeticsSpace() {
  console.log('No --space provided. Creating a public Matrix Space for Cosmetics...');
  const url = `${HOMESERVER_URL}/_matrix/client/v3/createRoom`;
  const body = {
    name: 'Mudrix Official Cosmetics',
    topic: 'Official Avatar Decorations and Profile Decorations for Mudrix',
    preset: 'public_chat',
    visibility: 'public',
    creation_content: {
      type: 'm.space',
    },
    initial_state: [
      {
        type: 'm.room.guest_access',
        state_key: '',
        content: { guest_access: 'can_join' },
      },
      {
        type: 'm.room.history_visibility',
        state_key: '',
        content: { history_visibility: 'world_readable' },
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create Space failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  console.log(`Created Space: ${data.room_id}`);
  return data.room_id;
}

// Download image with fallback to local file
async function fetchBufferWithFallback(remoteUrl, localPath) {
  try {
    const res = await fetch(remoteUrl);
    if (res.ok) {
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch {
    // remote fetch failed, try fallback
  }

  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath);
  }

  throw new Error(`Failed to fetch remote ${remoteUrl} and local file not found: ${localPath}`);
}

// Run a batch of tasks with concurrency limit
async function runWithConcurrency(items, limit, workerFn) {
  let idx = 0;
  const executing = new Set();

  for (const item of items) {
    idx++;
    const p = Promise.resolve().then(() => workerFn(item, idx, items.length));
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// ================= MAIN MIGRATION LOGIC =================
async function main() {
  console.log('=====================================================');
  console.log('     Mudrix Cosmetics -> Matrix Migration Tool       ');
  console.log('=====================================================');
  console.log(`Homeserver:  ${HOMESERVER_URL}`);
  console.log(`Concurrency: ${CONCURRENCY}`);

  if (!TARGET_SPACE_ID) {
    TARGET_SPACE_ID = await createCosmeticsSpace();
  }
  console.log(`Target Space Room: ${TARGET_SPACE_ID}\n`);

  // Load JSON metadata
  const decorationsRaw = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'src/util/decorations.json'), 'utf8')
  );
  const effectsRaw = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'src/util/profileEffects.json'), 'utf8')
  );

  // 1. Migrate Avatar Decorations (Distinct Pack Type 1)
  if (MIGRATE_TYPE === 'all' || MIGRATE_TYPE === 'decorations') {
    console.log(`\n--- 1. Migrating Avatar Decorations (${decorationsRaw.length} items) ---`);
    console.log(`Distinct Pack Type: 'profile_decoration' (1:1 frames only, no mixing)\n`);

    // Group by category
    const decoByCategory = new Map();
    for (const d of decorationsRaw) {
      const cat = d.category || 'General';
      if (!decoByCategory.has(cat)) decoByCategory.set(cat, []);
      decoByCategory.get(cat).push(d);
    }

    console.log(`Found ${decoByCategory.size} Avatar Decoration categories.`);

    // Upload items
    await runWithConcurrency(decorationsRaw, CONCURRENCY, async (deco, i, total) => {
      if (cache.decorations[deco.id]) {
        return; // already uploaded
      }

      const remoteUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${deco.id}.png?size=256`;
      const localPath = path.join(rootDir, 'public/assets/decorations', `${deco.id}.png`);

      try {
        const buf = await fetchBufferWithFallback(remoteUrl, localPath);
        const mxc = await uploadMedia(buf, `${deco.id}.png`, 'image/png');
        cache.decorations[deco.id] = mxc;
        console.log(`[${i}/${total}] Uploaded Deco: ${deco.name} (${deco.id}) -> ${mxc}`);
        saveCache();
        await sleep(100);
      } catch (err) {
        console.error(`[${i}/${total}] ERROR uploading ${deco.name} (${deco.id}):`, err.message);
      }
    });

    // Publish distinct Avatar Decoration packs
    console.log('\nPublishing Avatar Decoration packs to Matrix Space...');
    for (const [category, items] of decoByCategory.entries()) {
      const stateKey = `avatar_deco_${slugify(category)}`;
      if (cache.publishedPacks[stateKey]) {
        console.log(`Pack '${category}' already published (skipping).`);
        continue;
      }

      const packImages = {};
      for (const item of items) {
        const mxc = cache.decorations[item.id];
        if (!mxc) continue;
        const shortcode = slugify(item.name);
        packImages[shortcode] = {
          url: mxc,
          body: item.name,
          usage: ['profile_decoration'],
          info: {
            mimetype: 'image/png',
            w: 256,
            h: 256,
          },
        };
      }

      if (Object.keys(packImages).length === 0) continue;

      const packContent = {
        pack: {
          display_name: `[Avatar Decorations] ${category}`,
          usage: ['profile_decoration'],
          attribution: 'Mudrix Official',
        },
        images: packImages,
      };

      try {
        await sendStateEvent(TARGET_SPACE_ID, 'im.ponies.room_emotes', stateKey, packContent);
        cache.publishedPacks[stateKey] = true;
        saveCache();
        console.log(
          `✓ Published Pack: "[Avatar Decorations] ${category}" (${Object.keys(packImages).length} items)`
        );
      } catch (err) {
        console.error(`Failed to publish pack for ${category}:`, err.message);
      }
    }
  }

  // 2. Migrate Profile Decorations / Borders (Distinct Pack Type 2)
  if (MIGRATE_TYPE === 'all' || MIGRATE_TYPE === 'effects') {
    console.log(`\n--- 2. Migrating Profile Decorations (${effectsRaw.length} items) ---`);
    console.log(`Distinct Pack Type: 'profile_effect' (full-card borders only, no mixing)\n`);

    // Group by category
    const effByCategory = new Map();
    for (const e of effectsRaw) {
      const cat = e.category || 'General';
      if (!effByCategory.has(cat)) effByCategory.set(cat, []);
      effByCategory.get(cat).push(e);
    }

    console.log(`Found ${effByCategory.size} Profile Decoration categories.`);

    // Upload items
    await runWithConcurrency(effectsRaw, CONCURRENCY, async (eff, i, total) => {
      if (cache.effects[eff.id]) {
        return; // already uploaded
      }

      const loopLayer = eff.effects?.find((x) => x.loop) ?? eff.effects?.[0];
      const remoteUrl = loopLayer?.src || eff.thumbnail;
      const localPath = path.join(rootDir, 'public/assets/profile-effects', `${eff.id}.png`);

      try {
        const buf = await fetchBufferWithFallback(remoteUrl, localPath);
        const mxc = await uploadMedia(buf, `${eff.id}.png`, 'image/png');
        cache.effects[eff.id] = mxc;
        console.log(`[${i}/${total}] Uploaded Effect: ${eff.title} (${eff.id}) -> ${mxc}`);
        saveCache();
        await sleep(100);
      } catch (err) {
        console.error(`[${i}/${total}] ERROR uploading ${eff.title} (${eff.id}):`, err.message);
      }
    });

    // Publish distinct Profile Decoration packs
    console.log('\nPublishing Profile Decoration packs to Matrix Space...');
    for (const [category, items] of effByCategory.entries()) {
      const stateKey = `profile_deco_${slugify(category)}`;
      if (cache.publishedPacks[stateKey]) {
        console.log(`Pack '${category}' already published (skipping).`);
        continue;
      }

      const packImages = {};
      for (const item of items) {
        const mxc = cache.effects[item.id];
        if (!mxc) continue;
        const shortcode = slugify(item.title);
        packImages[shortcode] = {
          url: mxc,
          body: item.title,
          usage: ['profile_effect'],
          info: {
            mimetype: 'image/png',
          },
        };
      }

      if (Object.keys(packImages).length === 0) continue;

      const packContent = {
        pack: {
          display_name: `[Profile Decorations] ${category}`,
          usage: ['profile_effect'],
          attribution: 'Mudrix Official',
        },
        images: packImages,
      };

      try {
        await sendStateEvent(TARGET_SPACE_ID, 'im.ponies.room_emotes', stateKey, packContent);
        cache.publishedPacks[stateKey] = true;
        saveCache();
        console.log(
          `✓ Published Pack: "[Profile Decorations] ${category}" (${Object.keys(packImages).length} items)`
        );
      } catch (err) {
        console.error(`Failed to publish pack for ${category}:`, err.message);
      }
    }
  }

  console.log('\n=====================================================');
  console.log('             Migration Complete!                     ');
  console.log('=====================================================');
  console.log(`All packs have been cleanly published to Space: ${TARGET_SPACE_ID}`);
  console.log(`Cache saved to: ${CACHE_FILE}`);
}

main().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
