#!/usr/bin/env node
// PRIVATE USE ONLY. This script downloads Discord collectible art and re-uploads it to Matrix, which
// may breach Discord's terms of service. Run it only for your own private server. Never commit or
// redistribute the data or art it fetches or produces (scripts/*-cache.json, scripts/data/, ...).
/**
 * Automated Migration Script: Discord Nameplates & Profile Frames -> Matrix MSC2545 Packs
 *
 * Features:
 * - Migrates Nameplates with palettes and background art to MSC2545 packs (usage: ['nameplate']).
 * - Migrates Profile Frames with multi-layer frame pieces (top, bottom, center; back & front)
 *   to MSC2545 packs (usage: ['profile_frame']).
 * - Uploads media to homeserver media storage (mxc://) and publishes state events to Space/Room.
 * - Resumable with local cache checkpoint (scripts/nameplates-frames-cache.json) to avoid re-uploading.
 *
 * Usage:
 *   node scripts/migrate-nameplates-frames.mjs --homeserver https://matrix.example.com --token syt_... [--space !spaceId:example.com]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, 'nameplates-frames-cache.json');

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
const MIGRATE_TYPE = getArg('--type', 'MIGRATE_TYPE', 'all'); // 'all', 'nameplates', 'frames'

if (!HOMESERVER_URL || !ACCESS_TOKEN) {
  console.log(`
[Info] Running in verification/offline mode or missing credentials.
To execute live migration to Matrix:
  node scripts/migrate-nameplates-frames.mjs \\
    --homeserver https://matrix.example.com \\
    --token syt_abcdef123456... \\
    [--space !spaceId:example.com] \\
    [--type all|nameplates|frames]
`);
}

// Load Checkpoint Cache
let cache = {
  nameplates: {}, // skuId -> mxc
  frames: {}, // skuId -> { thumbnail: mxc, pieces: [...] }
  pieces: {}, // srcUrl -> mxc
  publishedPacks: {}, // stateKey -> true
};

if (fs.existsSync(CACHE_FILE)) {
  try {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (!cache.pieces) cache.pieces = {};
    console.log(`Loaded checkpoint cache from ${CACHE_FILE}`);
  } catch {
    console.warn('Could not parse cache file, starting fresh.');
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function slugify(text) {
  return (
    decodeHtmlEntities(text)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'pack'
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Upload Media to Matrix
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
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.content_uri; // mxc://...
}

// Send State Event to Matrix Room
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
    throw new Error(`Set state failed (${res.status}): ${text}`);
  }

  return await res.json();
}

// Download buffer helper with retry
async function fetchBufferWithRetry(url, retries = 3) {
  const cleanUrl = decodeHtmlEntities(url);
  const targetUrl = encodeURI(cleanUrl);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let res = await fetch(targetUrl);
      if (!res.ok && targetUrl !== cleanUrl) {
        res = await fetch(cleanUrl);
      }
      if (res.ok) {
        const arr = await res.arrayBuffer();
        return Buffer.from(arr);
      }
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(500 * attempt);
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

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

async function main() {
  console.log('=====================================================');
  console.log('  Mudrix Nameplates & Frames -> Matrix Migration     ');
  console.log('=====================================================');

  const nameplatesFile = path.join(__dirname, 'data/nameplates.json');
  const framesFile = path.join(__dirname, 'data/profileFrames.json');

  if (!fs.existsSync(nameplatesFile) || !fs.existsSync(framesFile)) {
    console.error('Data files missing. Please run scrape-nameplates-frames.mjs first.');
    process.exit(1);
  }

  const nameplates = JSON.parse(fs.readFileSync(nameplatesFile, 'utf8')).map((item) => ({
    ...item,
    name: decodeHtmlEntities(item.name),
    collection: decodeHtmlEntities(item.collection),
    img: decodeHtmlEntities(item.img),
    mediaUrl: decodeHtmlEntities(item.mediaUrl),
  }));
  const profileFrames = JSON.parse(fs.readFileSync(framesFile, 'utf8')).map((item) => ({
    ...item,
    name: decodeHtmlEntities(item.name),
    collection: decodeHtmlEntities(item.collection),
    img: decodeHtmlEntities(item.img),
    framePieces: (item.framePieces || []).map((p) => ({
      ...p,
      src: decodeHtmlEntities(p.src),
    })),
  }));

  console.log(`Loaded ${nameplates.length} nameplates and ${profileFrames.length} profile frames.`);

  if (!HOMESERVER_URL || !ACCESS_TOKEN) {
    console.log('\n[Dry Run] Validated dataset and architecture.');
    console.log('Specify --homeserver and --token to upload media and publish Matrix packs.');
    return;
  }

  // 1. Nameplates Migration
  if (MIGRATE_TYPE === 'all' || MIGRATE_TYPE === 'nameplates') {
    console.log(`\n--- 1. Migrating Nameplates (${nameplates.length} items) ---`);

    await runWithConcurrency(nameplates, CONCURRENCY, async (item, i, total) => {
      if (cache.nameplates[item.skuId]) return;

      const mediaUrl = item.mediaUrl || item.img;
      if (!mediaUrl) return;

      try {
        const buf = await fetchBufferWithRetry(mediaUrl);
        const mxc = await uploadMedia(buf, `${item.skuId}_nameplate.png`, 'image/png');
        cache.nameplates[item.skuId] = mxc;
        console.log(`[${i}/${total}] Nameplate: ${item.name} -> ${mxc}`);
        saveCache();
        await sleep(60);
      } catch (err) {
        console.error(`[${i}/${total}] Error on ${item.name}:`, err.message);
      }
    });

    if (TARGET_SPACE_ID) {
      console.log('\nPublishing Nameplate packs to Matrix Space...');
      const byCollection = new Map();
      for (const item of nameplates) {
        const col = item.collection || 'General';
        if (!byCollection.has(col)) byCollection.set(col, []);
        byCollection.get(col).push(item);
      }

      for (const [collection, items] of byCollection.entries()) {
        const stateKey = `nameplate_${slugify(collection)}`;
        if (cache.publishedPacks[stateKey]) {
          console.log(`Pack '${collection}' already published.`);
          continue;
        }

        const packImages = {};
        for (const item of items) {
          const mxc = cache.nameplates[item.skuId];
          if (!mxc) continue;
          const shortcode = slugify(item.name);
          packImages[shortcode] = {
            url: mxc,
            body: item.name,
            usage: ['nameplate'],
            info: {
              mimetype: 'image/png',
              palette: item.palette || 'none',
              skuId: item.skuId,
            },
          };
        }

        if (Object.keys(packImages).length > 0) {
          const content = {
            pack: {
              display_name: collection,
              avatar_url: Object.values(packImages)[0]?.url,
              usage: ['nameplate'],
              attribution: 'Discord Collectibles',
            },
            images: packImages,
          };

          try {
            await sendStateEvent(TARGET_SPACE_ID, 'im.ponies.room_emotes', stateKey, content);
            cache.publishedPacks[stateKey] = true;
            saveCache();
            console.log(
              `Published pack: ${collection} Nameplates (${Object.keys(packImages).length} items)`
            );
          } catch (err) {
            console.error(`Failed to publish pack for ${collection}:`, err.message);
          }
        }
      }
    }
  }

  // 2. Profile Frames Migration
  if (MIGRATE_TYPE === 'all' || MIGRATE_TYPE === 'frames') {
    console.log(`\n--- 2. Migrating Profile Frames (${profileFrames.length} items) ---`);

    await runWithConcurrency(profileFrames, CONCURRENCY, async (item, i, total) => {
      if (cache.frames[item.skuId]) return;

      try {
        // Upload thumbnail
        let thumbMxc = cache.pieces[item.img];
        if (!thumbMxc && item.img) {
          const buf = await fetchBufferWithRetry(item.img);
          thumbMxc = await uploadMedia(buf, `${item.skuId}_thumb.png`, 'image/png');
          cache.pieces[item.img] = thumbMxc;
          saveCache();
        }

        // Upload each frame piece
        const pieces = [];
        for (const piece of item.framePieces || []) {
          let pieceMxc = cache.pieces[piece.src];
          if (!pieceMxc && piece.src) {
            const buf = await fetchBufferWithRetry(piece.src);
            pieceMxc = await uploadMedia(buf, `${item.skuId}_piece.png`, 'image/png');
            cache.pieces[piece.src] = pieceMxc;
            saveCache();
            await sleep(50);
          }
          if (pieceMxc) {
            pieces.push({
              layer: piece.layer,
              pos: piece.pos,
              url: pieceMxc,
            });
          }
        }

        cache.frames[item.skuId] = {
          thumbnail: thumbMxc || pieces[0]?.url,
          pieces,
        };
        console.log(`[${i}/${total}] Frame: ${item.name} (${pieces.length} pieces)`);
        saveCache();
      } catch (err) {
        console.error(`[${i}/${total}] Error on frame ${item.name}:`, err.message);
      }
    });

    if (TARGET_SPACE_ID) {
      console.log('\nPublishing Profile Frame packs to Matrix Space...');
      const byCollection = new Map();
      for (const item of profileFrames) {
        const col = item.collection || 'General';
        if (!byCollection.has(col)) byCollection.set(col, []);
        byCollection.get(col).push(item);
      }

      for (const [collection, items] of byCollection.entries()) {
        const stateKey = `profile_frame_${slugify(collection)}`;
        if (cache.publishedPacks[stateKey]) {
          console.log(`Pack '${collection}' already published.`);
          continue;
        }

        const packImages = {};
        for (const item of items) {
          const frameData = cache.frames[item.skuId];
          if (!frameData || !frameData.thumbnail) continue;
          const shortcode = slugify(item.name);
          packImages[shortcode] = {
            url: frameData.thumbnail,
            body: item.name,
            usage: ['profile_frame'],
            info: {
              mimetype: 'image/png',
              skuId: item.skuId,
              pieces: frameData.pieces,
            },
          };
        }

        if (Object.keys(packImages).length > 0) {
          const content = {
            pack: {
              display_name: `${collection} Profile Frames`,
              avatar_url: Object.values(packImages)[0]?.url,
              usage: ['profile_frame'],
              attribution: 'Discord Collectibles',
            },
            images: packImages,
          };

          try {
            await sendStateEvent(TARGET_SPACE_ID, 'im.ponies.room_emotes', stateKey, content);
            cache.publishedPacks[stateKey] = true;
            saveCache();
            console.log(
              `Published pack: ${collection} Frames (${Object.keys(packImages).length} items)`
            );
          } catch (err) {
            console.error(`Failed to publish pack for ${collection}:`, err.message);
          }
        }
      }
    }
  }

  console.log('\nMigration complete!');
}

main().catch(console.error);
