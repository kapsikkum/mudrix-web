#!/usr/bin/env node
/**
 * Unified Discord Cosmetics Pipeline: Scrape & Upload to Matrix
 *
 * Features:
 * - Scrapes cosmetics from Dripcord / Discord CDN:
 *     * Animated Nameplates (high-fidelity APNG from Discord Collectibles CDN)
 *     * Multi-layer Profile Frames (thumbnails and top/bottom/center piece layers)
 *     * Avatar Decorations (preserves 1:1 frames and animations)
 *     * Profile Effects (card background loop animations)
 * - Uploads media files directly to the Matrix homeserver media repo (mxc://).
 * - Publishes MSC2545 packs (`im.ponies.room_emotes.<key>`) with clean Discord collection naming.
 * - Resumable with local unified cache checkpoint (scripts/cosmetics-cache.json).
 * - Automatically loads credentials from .env.local without logging or leaking secrets.
 *
 * Usage:
 *   node scripts/sync-discord-cosmetics.mjs [options]
 *
 * Options:
 *   --type <all|nameplates|frames|decorations|effects>   Cosmetics to process (default: all)
 *   --scrape                                             Force re-scraping from source
 *   --scrape-only                                        Only scrape and save data, skip upload
 *   --upload-only                                        Only upload from cached data, skip scrape
 *   --homeserver <url>                                   Matrix homeserver (default: from .env.local or https://vore.party)
 *   --token <token>                                      Matrix access token (default: from .env.local)
 *   --room <id> / --space <id>                           Target room/space ID (default: !FU6DlwI97KdI3HkKZF:vore.party)
 *   --concurrency <num>                                  Upload concurrency limit (default: 4)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ----------------------------------------------------
// 1. Environment & Credential Loading (Secure)
// ----------------------------------------------------
if (fs.existsSync(path.resolve(rootDir, '.env.local'))) {
  const envContent = fs.readFileSync(path.resolve(rootDir, '.env.local'), 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let val = (match[2] || '').trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const args = process.argv.slice(2);
function getArg(flag, envVar, defaultVal = '') {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return process.env[envVar] || defaultVal;
}
function hasFlag(flag) {
  return args.includes(flag);
}

const HOMESERVER_URL = (getArg('--homeserver', 'HOMESERVER_URL') || 'https://vore.party').replace(
  /\/+$/,
  ''
);
const ACCESS_TOKEN = getArg('--token', 'ACCESS_TOKEN') || process.env.MATRIX_ACCESS_TOKEN || '';
const TARGET_ROOM_ID =
  getArg('--room', 'TARGET_SPACE_ID') ||
  getArg('--space', 'TARGET_SPACE_ID') ||
  '!FU6DlwI97KdI3HkKZF:vore.party';
const CONCURRENCY = parseInt(getArg('--concurrency', 'CONCURRENCY', '4'), 10);
const COSMETIC_TYPE = getArg('--type', 'COSMETIC_TYPE', 'all').toLowerCase();
const FORCE_SCRAPE = hasFlag('--scrape');
const SCRAPE_ONLY = hasFlag('--scrape-only');

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Unified Discord Cosmetics Pipeline: Scrape & Upload to Matrix

Usage:
  node scripts/sync-discord-cosmetics.mjs [options]

Options:
  --type <all|nameplates|frames|decorations|effects>   Cosmetics to process (default: all)
  --scrape                                             Force re-scraping from source
  --scrape-only                                        Only scrape and save data, skip upload
  --upload-only                                        Only upload from cached data, skip scrape
  --homeserver <url>                                   Matrix homeserver (default: from .env.local or https://vore.party)
  --token <token>                                      Matrix access token (default: from .env.local)
  --room <id> / --space <id>                           Target room/space ID (default: !FU6DlwI97KdI3HkKZF:vore.party)
  --concurrency <num>                                  Upload concurrency limit (default: 4)
  --help, -h                                           Show this help message
`);
  process.exit(0);
}

// ----------------------------------------------------
// 2. Checkpoint Cache Management
// ----------------------------------------------------
const CACHE_FILE = path.join(__dirname, 'cosmetics-cache.json');
let cache = {
  nameplates: {},
  frames: {},
  pieces: {},
  decorations: {},
  effects: {},
  publishedPacks: {},
};

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
      console.warn('Could not parse unified cache file, starting fresh.');
    }
  }

  // Import from legacy checkpoint caches if present
  const legacyFiles = [
    path.join(__dirname, 'animated-nameplates-cache.json'),
    path.join(__dirname, 'nameplates-frames-cache.json'),
    path.join(__dirname, 'cosmetics-migration-cache.json'),
  ];
  for (const file of legacyFiles) {
    if (fs.existsSync(file)) {
      try {
        const legacy = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (legacy.nameplates) cache.nameplates = { ...legacy.nameplates, ...cache.nameplates };
        if (legacy.frames) cache.frames = { ...legacy.frames, ...cache.frames };
        if (legacy.pieces) cache.pieces = { ...legacy.pieces, ...cache.pieces };
        if (legacy.decorations) cache.decorations = { ...legacy.decorations, ...cache.decorations };
        if (legacy.effects) cache.effects = { ...legacy.effects, ...cache.effects };
        if (legacy.publishedPacks)
          cache.publishedPacks = { ...legacy.publishedPacks, ...cache.publishedPacks };
        if (legacy.updatedPacks) {
          for (const k of Object.keys(legacy.updatedPacks)) cache.publishedPacks[k] = true;
        }
      } catch {
        // ignore legacy read errors
      }
    }
  }
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');

  // Also sync back to legacy cache files for compatibility
  const npFramesFile = path.join(__dirname, 'nameplates-frames-cache.json');
  if (fs.existsSync(npFramesFile)) {
    try {
      const npCache = {
        nameplates: cache.nameplates,
        frames: cache.frames,
        pieces: cache.pieces,
        publishedPacks: cache.publishedPacks,
      };
      fs.writeFileSync(npFramesFile, JSON.stringify(npCache, null, 2), 'utf8');
    } catch {
      // best-effort
    }
  }
}

// ----------------------------------------------------
// 3. String & Utility Helpers
// ----------------------------------------------------
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
      .replace(/^_|_$/g, '') || 'item'
  );
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ----------------------------------------------------
// 4. Matrix & HTTP API Helpers
// ----------------------------------------------------
async function fetchBufferWithRetry(url, localFallback = null, retries = 3) {
  const cleanUrl = decodeHtmlEntities(url);
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(cleanUrl);
      if (res.ok) {
        const arr = await res.arrayBuffer();
        return Buffer.from(arr);
      }
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
        console.warn(`Rate limited on ${cleanUrl}, waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }
    } catch (err) {
      if (attempt === retries) {
        if (localFallback && fs.existsSync(localFallback)) {
          return fs.readFileSync(localFallback);
        }
        throw err;
      }
      await sleep(1000 * attempt);
    }
  }

  if (localFallback && fs.existsSync(localFallback)) {
    return fs.readFileSync(localFallback);
  }
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

async function uploadMedia(buffer, filename, mimetype = 'image/png') {
  const url = `${HOMESERVER_URL}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}`;
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': mimetype,
      },
      body: buffer,
    });

    if (res.ok) {
      const json = await res.json();
      return json.content_uri; // mxc://...
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      console.warn(`Rate limited on media upload, waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    const text = await res.text();
    if (attempts === 3) {
      throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    await sleep(1000 * attempts);
  }
}

async function sendStateEvent(roomId, eventType, stateKey, content) {
  const url = `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${encodeURIComponent(eventType)}/${encodeURIComponent(stateKey)}`;
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(content),
    });

    if (res.ok) {
      return await res.json();
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') || '2', 10);
      console.warn(`Rate limited on state event ${stateKey}, waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    const text = await res.text();
    if (attempts === 3) {
      throw new Error(`Set state failed (${res.status}): ${text}`);
    }
    await sleep(1000 * attempts);
  }
}

async function runWithConcurrency(items, limit, workerFn) {
  let idx = 0;
  const executing = new Set();

  for (const item of items) {
    idx++;
    const currentIdx = idx;
    const p = Promise.resolve().then(() => workerFn(item, currentIdx, items.length));
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// ----------------------------------------------------
// 5. Scrapers (Dripcord / Discord)
// ----------------------------------------------------
async function scrapeNameplates(force = false) {
  const outFile = path.join(dataDir, 'nameplates.json');
  if (!force && fs.existsSync(outFile)) {
    console.log(`Loading cached nameplates from ${outFile}`);
    return JSON.parse(fs.readFileSync(outFile, 'utf8'));
  }

  console.log('\n--- Scraping Nameplates from Dripcord ---');
  let page = 1;
  const items = new Map();

  while (page <= 25) {
    const url = `https://dripcord.me/catalog/nameplates/?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const html = await res.text();

    const itemRegex = /<a[^>]+href="\/item\/([0-9]+)\/"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    let countOnPage = 0;
    while ((m = itemRegex.exec(html)) !== null) {
      const skuId = m[1];
      const title = m[2];
      const itemContent = m[3];

      const imgMatch = itemContent.match(/src="([^"]+)"/);
      const img = imgMatch ? imgMatch[1] : '';

      const palMatch = itemContent.match(/np-pal-([a-z0-9_-]+)/);
      const palette = palMatch ? palMatch[1] : 'none';

      if (!items.has(skuId)) {
        items.set(skuId, {
          skuId,
          name: decodeHtmlEntities(title),
          img: decodeHtmlEntities(img),
          palette,
          mediaUrl: `https://cdn.discordapp.com/media/v1/collectibles-shop/${skuId}/animated`,
          animatedUrl: `https://cdn.discordapp.com/media/v1/collectibles-shop/${skuId}/animated`,
        });
      }
      countOnPage++;
    }

    console.log(`[Nameplates] Page ${page}: found ${countOnPage} items. (Total: ${items.size})`);
    if (countOnPage === 0 || !html.includes(`page=${page + 1}`)) break;
    page++;
    await sleep(200);
  }

  console.log(`Fetching collection metadata for ${items.size} nameplates...`);
  const list = Array.from(items.values());
  let idx = 0;
  for (const item of list) {
    idx++;
    try {
      const res = await fetch(`https://dripcord.me/item/${item.skuId}/`);
      if (res.ok) {
        const html = await res.text();
        const colMatch = html.match(/href="\/catalog\/collection\/[^/]+\/">([^<]+)<\/a>/);
        item.collection = colMatch ? decodeHtmlEntities(colMatch[1].trim()) : 'General';
        const palMatch = html.match(/data-media-palette="([^"]+)"/);
        if (palMatch) item.palette = palMatch[1];
        const zoomMatch = html.match(/data-media-zoom="([^"]+)"/);
        if (zoomMatch) item.staticUrl = decodeHtmlEntities(zoomMatch[1]);
      }
    } catch (err) {
      console.error(`Error on nameplate ${item.skuId}:`, err.message);
    }
    if (idx % 25 === 0 || idx === list.length) {
      console.log(`Processed details ${idx}/${list.length}...`);
      await sleep(100);
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(list, null, 2), 'utf8');
  console.log(`Saved ${list.length} nameplates to ${outFile}`);
  return list;
}

async function scrapeProfileFrames(force = false) {
  const outFile = path.join(dataDir, 'profileFrames.json');
  if (!force && fs.existsSync(outFile)) {
    console.log(`Loading cached profile frames from ${outFile}`);
    return JSON.parse(fs.readFileSync(outFile, 'utf8'));
  }

  console.log('\n--- Scraping Profile Frames from Dripcord ---');
  let page = 1;
  const items = new Map();

  while (page <= 10) {
    const url = `https://dripcord.me/catalog/profile-frames/?page=${page}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const html = await res.text();

    const itemRegex = /<a[^>]+href="\/item\/([0-9]+)\/"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let m;
    let countOnPage = 0;
    while ((m = itemRegex.exec(html)) !== null) {
      const skuId = m[1];
      const title = m[2];
      const itemContent = m[3];

      const imgMatch = itemContent.match(/src="([^"]+)"/);
      const img = imgMatch ? imgMatch[1] : '';

      if (!items.has(skuId)) {
        items.set(skuId, {
          skuId,
          name: decodeHtmlEntities(title),
          img: decodeHtmlEntities(img),
        });
      }
      countOnPage++;
    }

    console.log(
      `[Profile Frames] Page ${page}: found ${countOnPage} items. (Total: ${items.size})`
    );
    if (countOnPage === 0 || !html.includes(`page=${page + 1}`)) break;
    page++;
    await sleep(200);
  }

  console.log(`Fetching multi-layer piece metadata for ${items.size} profile frames...`);
  const list = Array.from(items.values());
  let idx = 0;
  for (const item of list) {
    idx++;
    try {
      const res = await fetch(`https://dripcord.me/item/${item.skuId}/`);
      if (res.ok) {
        const html = await res.text();
        const colMatch = html.match(/href="\/catalog\/collection\/[^/]+\/">([^<]+)<\/a>/);
        item.collection = colMatch ? decodeHtmlEntities(colMatch[1].trim()) : 'Profile Frames';

        const framePieces = [];
        const cardStart = html.indexOf('<div class="thumb-frame-card">');
        const cardEnd = html.indexOf('<span class="cat-item-type">Profile Frame</span>');
        if (cardStart !== -1 && cardEnd !== -1) {
          const cardHtml = html.substring(cardStart, cardEnd);
          const layerRegex = /<div class="thumb-frame-layer\s+([^"]+)">([\s\S]*?)<\/div>/g;
          let lm;
          while ((lm = layerRegex.exec(cardHtml)) !== null) {
            const layer = lm[1].includes('is-back') ? 'back' : 'front';
            const imgRegex = /<img[^>]+class="frame-piece\s+([^"]+)"[^>]+src="([^"]+)"/g;
            let im;
            while ((im = imgRegex.exec(lm[2])) !== null) {
              const posClass = im[1];
              const pos = posClass.includes('is-top')
                ? 'top'
                : posClass.includes('is-bottom')
                  ? 'bottom'
                  : 'center';
              framePieces.push({
                layer,
                pos,
                src: decodeHtmlEntities(im[2]),
              });
            }
          }
        }
        item.framePieces = framePieces;
      }
    } catch (err) {
      console.error(`Error on frame ${item.skuId}:`, err.message);
    }
    if (idx % 15 === 0 || idx === list.length) {
      console.log(`Processed details ${idx}/${list.length}...`);
      await sleep(100);
    }
  }

  fs.writeFileSync(outFile, JSON.stringify(list, null, 2), 'utf8');
  console.log(`Saved ${list.length} profile frames to ${outFile}`);
  return list;
}

function loadAvatarDecorations() {
  const decPath = path.join(rootDir, 'src/util/decorations.json');
  if (fs.existsSync(decPath)) {
    return JSON.parse(fs.readFileSync(decPath, 'utf8'));
  }
  return [];
}

function loadProfileEffects() {
  const effPath = path.join(rootDir, 'src/util/profileEffects.json');
  if (fs.existsSync(effPath)) {
    return JSON.parse(fs.readFileSync(effPath, 'utf8'));
  }
  return [];
}

// ----------------------------------------------------
// 6. Migrators & Server Updaters
// ----------------------------------------------------
async function migrateNameplates(nameplates) {
  console.log(`\n=====================================================`);
  console.log(`  Processing Nameplates (${nameplates.length} items)`);
  console.log(`=====================================================`);

  // Step 1: Upload Media
  let uploaded = 0;
  await runWithConcurrency(nameplates, CONCURRENCY, async (item, i, total) => {
    if (cache.nameplates[item.skuId]) return;

    const animatedUrl =
      item.animatedUrl ||
      `https://cdn.discordapp.com/media/v1/collectibles-shop/${item.skuId}/animated`;
    try {
      const buf = await fetchBufferWithRetry(animatedUrl);
      const mxc = await uploadMedia(buf, `${item.skuId}_nameplate.png`, 'image/png');
      cache.nameplates[item.skuId] = mxc;
      uploaded++;
      if (uploaded % 10 === 0 || i === total) {
        console.log(
          `[${i}/${total}] Uploaded Nameplate: ${item.name} (${item.collection}) -> ${mxc}`
        );
        saveCache();
      }
      await sleep(50);
    } catch (err) {
      console.error(`[${i}/${total}] Error uploading nameplate ${item.name}:`, err.message);
    }
  });

  saveCache();

  // Step 2: Publish State Events
  console.log('\nUpdating Nameplate packs in Matrix Room State...');
  const byCollection = new Map();
  for (const item of nameplates) {
    const col = item.collection || 'General';
    if (!byCollection.has(col)) byCollection.set(col, []);
    byCollection.get(col).push(item);
  }

  let count = 0;
  for (const [collection, items] of byCollection.entries()) {
    count++;
    const stateKey = `nameplate_${slugify(collection)}`;

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

    if (Object.keys(packImages).length === 0) continue;

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
      await sendStateEvent(TARGET_ROOM_ID, 'im.ponies.room_emotes', stateKey, content);
      cache.publishedPacks[stateKey] = true;
      saveCache();
      console.log(
        `[${count}/${byCollection.size}] Published Nameplates: "${collection}" (${Object.keys(packImages).length} items)`
      );
      await sleep(80);
    } catch (err) {
      console.error(`Failed to publish pack for ${collection}:`, err.message);
    }
  }
}

async function migrateProfileFrames(frames) {
  console.log(`\n=====================================================`);
  console.log(`  Processing Profile Frames (${frames.length} items)`);
  console.log(`=====================================================`);

  await runWithConcurrency(frames, CONCURRENCY, async (item, i, total) => {
    if (cache.frames[item.skuId]) return;

    try {
      let thumbMxc = cache.pieces[item.img];
      if (!thumbMxc && item.img) {
        const buf = await fetchBufferWithRetry(item.img);
        thumbMxc = await uploadMedia(buf, `${item.skuId}_thumb.png`, 'image/png');
        cache.pieces[item.img] = thumbMxc;
        saveCache();
        await sleep(50);
      }

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
      saveCache();
      console.log(`[${i}/${total}] Uploaded Frame: ${item.name} (${pieces.length} pieces)`);
    } catch (err) {
      console.error(`[${i}/${total}] Error on frame ${item.name}:`, err.message);
    }
  });

  console.log('\nUpdating Profile Frame packs in Matrix Room State...');
  const byCollection = new Map();
  for (const item of frames) {
    const col = item.collection || 'General';
    if (!byCollection.has(col)) byCollection.set(col, []);
    byCollection.get(col).push(item);
  }

  let count = 0;
  for (const [collection, items] of byCollection.entries()) {
    count++;
    const stateKey = `profile_frame_${slugify(collection)}`;

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

    if (Object.keys(packImages).length === 0) continue;

    const content = {
      pack: {
        display_name: collection,
        avatar_url: Object.values(packImages)[0]?.url,
        usage: ['profile_frame'],
        attribution: 'Discord Collectibles',
      },
      images: packImages,
    };

    try {
      await sendStateEvent(TARGET_ROOM_ID, 'im.ponies.room_emotes', stateKey, content);
      cache.publishedPacks[stateKey] = true;
      saveCache();
      console.log(
        `[${count}/${byCollection.size}] Published Frames: "${collection}" (${Object.keys(packImages).length} items)`
      );
      await sleep(80);
    } catch (err) {
      console.error(`Failed to publish frame pack for ${collection}:`, err.message);
    }
  }
}

async function migrateAvatarDecorations(decorations) {
  console.log(`\n=====================================================`);
  console.log(`  Processing Avatar Decorations (${decorations.length} items)`);
  console.log(`=====================================================`);

  await runWithConcurrency(decorations, CONCURRENCY, async (deco, i, total) => {
    if (cache.decorations[deco.id]) return;

    const remoteUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${deco.id}.png?size=256`;
    const localPath = path.join(rootDir, 'public/assets/decorations', `${deco.id}.png`);

    try {
      const buf = await fetchBufferWithRetry(remoteUrl, localPath);
      const mxc = await uploadMedia(buf, `${deco.id}.png`, 'image/png');
      cache.decorations[deco.id] = mxc;
      console.log(`[${i}/${total}] Uploaded Decoration: ${deco.name} (${deco.id}) -> ${mxc}`);
      saveCache();
      await sleep(60);
    } catch (err) {
      console.error(`[${i}/${total}] Error on decoration ${deco.name}:`, err.message);
    }
  });

  console.log('\nUpdating Avatar Decoration packs in Matrix Room State...');
  const decoByCategory = new Map();
  for (const d of decorations) {
    const cat = d.category || 'General';
    if (!decoByCategory.has(cat)) decoByCategory.set(cat, []);
    decoByCategory.get(cat).push(d);
  }

  let count = 0;
  for (const [category, items] of decoByCategory.entries()) {
    count++;
    const stateKey = `avatar_deco_${slugify(category)}`;

    const packImages = {};
    for (const item of items) {
      const mxc = cache.decorations[item.id];
      if (!mxc) continue;
      const shortcode = slugify(item.name);
      packImages[shortcode] = {
        url: mxc,
        body: item.name,
        usage: ['avatar_decoration', 'profile_decoration'],
        info: {
          mimetype: 'image/png',
          w: 256,
          h: 256,
        },
      };
    }

    if (Object.keys(packImages).length === 0) continue;

    const content = {
      pack: {
        display_name: category,
        avatar_url: Object.values(packImages)[0]?.url,
        usage: ['avatar_decoration', 'profile_decoration'],
        attribution: 'Discord Collectibles',
      },
      images: packImages,
    };

    try {
      await sendStateEvent(TARGET_ROOM_ID, 'im.ponies.room_emotes', stateKey, content);
      cache.publishedPacks[stateKey] = true;
      saveCache();
      console.log(
        `[${count}/${decoByCategory.size}] Published Avatar Decos: "${category}" (${Object.keys(packImages).length} items)`
      );
      await sleep(80);
    } catch (err) {
      console.error(`Failed to publish decoration pack for ${category}:`, err.message);
    }
  }
}

async function migrateProfileEffects(effects) {
  console.log(`\n=====================================================`);
  console.log(`  Processing Profile Effects (${effects.length} items)`);
  console.log(`=====================================================`);

  await runWithConcurrency(effects, CONCURRENCY, async (eff, i, total) => {
    if (cache.effects[eff.id]) return;

    const loopLayer = eff.effects?.find((x) => x.loop) ?? eff.effects?.[0];
    const remoteUrl = loopLayer?.src || eff.thumbnail;
    const localPath = path.join(rootDir, 'public/assets/profile-effects', `${eff.id}.png`);

    try {
      const buf = await fetchBufferWithRetry(remoteUrl, localPath);
      const mxc = await uploadMedia(buf, `${eff.id}.png`, 'image/png');
      cache.effects[eff.id] = mxc;
      console.log(`[${i}/${total}] Uploaded Profile Effect: ${eff.title} (${eff.id}) -> ${mxc}`);
      saveCache();
      await sleep(60);
    } catch (err) {
      console.error(`[${i}/${total}] Error on effect ${eff.title}:`, err.message);
    }
  });

  console.log('\nUpdating Profile Effect packs in Matrix Room State...');
  const effByCategory = new Map();
  for (const e of effects) {
    const cat = e.category || 'General';
    if (!effByCategory.has(cat)) effByCategory.set(cat, []);
    effByCategory.get(cat).push(e);
  }

  let count = 0;
  for (const [category, items] of effByCategory.entries()) {
    count++;
    const stateKey = `profile_deco_${slugify(category)}`;

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

    const content = {
      pack: {
        display_name: category,
        avatar_url: Object.values(packImages)[0]?.url,
        usage: ['profile_effect'],
        attribution: 'Discord Collectibles',
      },
      images: packImages,
    };

    try {
      await sendStateEvent(TARGET_ROOM_ID, 'im.ponies.room_emotes', stateKey, content);
      cache.publishedPacks[stateKey] = true;
      saveCache();
      console.log(
        `[${count}/${effByCategory.size}] Published Profile Effects: "${category}" (${Object.keys(packImages).length} items)`
      );
      await sleep(80);
    } catch (err) {
      console.error(`Failed to publish effect pack for ${category}:`, err.message);
    }
  }
}

async function clearGhostStateKeys() {
  const ghostKeys = [
    'nameplate_dungeons_amp_dragons',
    'nameplate_mickey_amp_friends',
    'nameplate_it_x27_s_showtime',
    'nameplate_it_x27_s_gametime',
    'profile_frame_profile_frames',
  ];
  for (const ghostKey of ghostKeys) {
    try {
      await sendStateEvent(TARGET_ROOM_ID, 'im.ponies.room_emotes', ghostKey, {});
      await sleep(60);
    } catch {
      // best-effort
    }
  }
}

// ----------------------------------------------------
// 7. Main Entry Point
// ----------------------------------------------------
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Unified Discord Cosmetics Pipeline & Matrix Sync       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Target Homeserver: ${HOMESERVER_URL}`);
  console.log(`Target Room/Space: ${TARGET_ROOM_ID}`);
  console.log(`Selected Type:     ${COSMETIC_TYPE}`);
  console.log(`Upload Limit:      ${CONCURRENCY} concurrent`);

  if (!SCRAPE_ONLY && (!HOMESERVER_URL || !ACCESS_TOKEN)) {
    console.error(
      '\nError: Missing Matrix Homeserver or Access Token in .env.local / CLI arguments.'
    );
    process.exit(1);
  }

  loadCache();

  // 1. Nameplates
  if (['all', 'nameplates', 'nameplate'].includes(COSMETIC_TYPE)) {
    const nameplates = await scrapeNameplates(FORCE_SCRAPE);
    if (!SCRAPE_ONLY) {
      await migrateNameplates(nameplates);
    }
  }

  // 2. Profile Frames
  if (['all', 'frames', 'frame', 'profile_frames'].includes(COSMETIC_TYPE)) {
    const frames = await scrapeProfileFrames(FORCE_SCRAPE);
    if (!SCRAPE_ONLY) {
      await migrateProfileFrames(frames);
    }
  }

  // 3. Avatar Decorations
  if (['all', 'decorations', 'avatar_decorations'].includes(COSMETIC_TYPE)) {
    const decorations = loadAvatarDecorations();
    if (decorations.length > 0 && !SCRAPE_ONLY) {
      await migrateAvatarDecorations(decorations);
    }
  }

  // 4. Profile Effects
  if (['all', 'effects', 'profile_effects'].includes(COSMETIC_TYPE)) {
    const effects = loadProfileEffects();
    if (effects.length > 0 && !SCRAPE_ONLY) {
      await migrateProfileEffects(effects);
    }
  }

  // 5. Cleanup
  if (!SCRAPE_ONLY) {
    await clearGhostStateKeys();
  }

  console.log('\n✓ All requested operations completed successfully!');
}

main().catch((err) => {
  console.error('\nFatal error during sync:', err);
  process.exit(1);
});
