#!/usr/bin/env node
// PRIVATE USE ONLY. This script downloads Discord collectible art and re-uploads it to Matrix, which
// may breach Discord's terms of service. Run it only for your own private server. Never commit or
// redistribute the data or art it fetches or produces (scripts/*-cache.json, scripts/data/, ...).
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
 *   --homeserver <url>                                   Matrix homeserver (default: HOMESERVER_URL in .env.local)
 *   --token <token>                                      Matrix access token (default: from .env.local)
 *   --room <id> / --space <id>                           Target room/space ID (default: TARGET_SPACE_ID or COSMETICS_SPACE in .env.local)
 *   --concurrency <num>                                  Upload concurrency limit (default: 4)
 *   --discord-token <token>                              Your Discord token (default: DISCORD_TOKEN in .env.local)
 *
 * Packs are updated in place: images from this run replace their old entries, and anything else already
 * in the pack (art Discord no longer lists) is left alone. Nothing is ever removed.
 *
 * Profile effects have two layers in Discord: a one-shot intro, then a loop. Both are uploaded; the loop
 * is the pack image and the intro's mxc goes in its `info` under io.github.kapsikkum.mudrix.effect_intro,
 * which the client plays first. With a Discord token the effect and decoration lists are read from
 * Discord itself (saved to scripts/data/); without one they come from scripts/data/ or src/util/*.json.
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

// Where the packs go has no default: it comes from .env.local or the command line.
const HOMESERVER_URL = getArg('--homeserver', 'HOMESERVER_URL').replace(/\/+$/, '');
const ACCESS_TOKEN = getArg('--token', 'ACCESS_TOKEN') || process.env.MATRIX_ACCESS_TOKEN || '';
const TARGET_ROOM_ID =
  getArg('--room', 'TARGET_SPACE_ID') ||
  getArg('--space', 'TARGET_SPACE_ID') ||
  process.env.COSMETICS_SPACE ||
  '';
const CONCURRENCY = parseInt(getArg('--concurrency', 'CONCURRENCY', '4'), 10);
const COSMETIC_TYPE = getArg('--type', 'COSMETIC_TYPE', 'all').toLowerCase();
const FORCE_SCRAPE = hasFlag('--scrape');
const SCRAPE_ONLY = hasFlag('--scrape-only');
const UPLOAD_ONLY = hasFlag('--upload-only');
// Optional: your own Discord token, used to read the live decoration and profile effect catalog.
const DISCORD_TOKEN = getArg('--discord-token', 'DISCORD_TOKEN');
// The pack image `info` key the client reads an effect's intro layer from. Keep it in step with
// EFFECT_INTRO_INFO_KEY in src/app/hooks/useUserPacks.ts.
const EFFECT_INTRO_INFO_KEY = 'io.github.kapsikkum.mudrix.effect_intro';

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
  --homeserver <url>                                   Matrix homeserver (default: HOMESERVER_URL in .env.local)
  --token <token>                                      Matrix access token (default: from .env.local)
  --room <id> / --space <id>                           Target room/space ID (default: TARGET_SPACE_ID or COSMETICS_SPACE in .env.local)
  --concurrency <num>                                  Upload concurrency limit (default: 4)
  --discord-token <token>                              Your Discord token, to read the live effect and decoration catalog
                                                       (default: DISCORD_TOKEN in .env.local)
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
  // The one-shot intro layer of a profile effect, uploaded beside its loop (cache.effects).
  effectIntros: {},
  // The layer URLs each effect was last uploaded from, to tell when Discord changes one.
  effectSources: {},
  publishedPacks: {},
};

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      cache = { ...cache, ...JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) };
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

/** The pack a state key holds in the target room, or null when there is none yet. */
async function readPack(stateKey) {
  const url = `${HOMESERVER_URL}/_matrix/client/v3/rooms/${encodeURIComponent(TARGET_ROOM_ID)}/state/im.ponies.room_emotes/${encodeURIComponent(stateKey)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Reading pack ${stateKey} failed (${res.status})`);
  return res.json();
}

/**
 * Updates a pack in place: the images this run has replace their old entries, and every other image
 * already in the pack (one Discord no longer lists, or one added by hand) is kept. If the existing pack
 * can't be read the pack is left alone rather than overwritten.
 */
async function publishPack(stateKey, content) {
  const existing = await readPack(stateKey);
  const images = { ...(existing?.images ?? {}) };
  // The same art under a new name replaces its old entry instead of sitting beside it.
  const newUrls = new Set(Object.values(content.images).map((img) => img.url));
  for (const [shortcode, img] of Object.entries(images)) {
    if (newUrls.has(img.url) && !(shortcode in content.images)) delete images[shortcode];
  }
  Object.assign(images, content.images);
  return sendStateEvent(TARGET_ROOM_ID, 'im.ponies.room_emotes', stateKey, {
    ...existing,
    ...content,
    pack: { ...existing?.pack, ...content.pack },
    images,
  });
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

// Discord answers in snake_case; older hand-made data files use camelCase.
const pick = (obj, ...keys) => {
  for (const key of keys) if (obj?.[key] != null) return obj[key];
  return undefined;
};

/** Every object under `node` that `match` accepts, tagged with the name of the top-level category. */
function collectCatalogItems(categories, match) {
  const found = [];
  const walk = (node, category) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, category);
    } else if (node && typeof node === 'object') {
      if (match(node)) found.push({ item: node, category });
      for (const child of Object.values(node)) walk(child, category);
    }
  };
  for (const cat of categories) walk(cat, cat?.name || 'General');
  return found;
}

function toEffect({ item, category }) {
  return {
    id: String(item.id ?? item.sku_id),
    title: item.title || item.name || String(item.id),
    category,
    thumbnail: pick(item, 'thumbnail_preview_src', 'thumbnailPreviewSrc'),
    effects: item.effects.map((layer) => ({
      src: layer.src,
      loop: !!layer.loop,
    })),
  };
}

function toDecoration({ item, category }) {
  return {
    id: item.asset,
    name: item.label || item.name || item.asset,
    category,
  };
}

/** Reads the live decoration and profile effect lists with the user's own Discord token. */
async function fetchDiscordCosmetics() {
  const res = await fetch('https://discord.com/api/v9/collectibles-categories', {
    headers: { Authorization: DISCORD_TOKEN },
  });
  if (!res.ok) throw new Error(`Discord answered ${res.status}`);
  const categories = await res.json();

  const effects = new Map();
  for (const entry of collectCatalogItems(
    categories,
    (n) => Array.isArray(n.effects) && n.effects.some((x) => x?.src)
  )) {
    const effect = toEffect(entry);
    effects.set(effect.id, effect);
  }
  const decorations = new Map();
  for (const entry of collectCatalogItems(
    categories,
    (n) => typeof n.asset === 'string' && n.asset.startsWith('a_')
  )) {
    const deco = toDecoration(entry);
    decorations.set(deco.id, deco);
  }
  return { effects: [...effects.values()], decorations: [...decorations.values()] };
}

let discordCosmetics = null;
async function loadDiscordCosmetics() {
  if (discordCosmetics) return discordCosmetics;
  const effectsFile = path.join(dataDir, 'profile-effects.json');
  const decorationsFile = path.join(dataDir, 'avatar-decorations.json');

  if (DISCORD_TOKEN && (FORCE_SCRAPE || !fs.existsSync(effectsFile)) && !UPLOAD_ONLY) {
    try {
      discordCosmetics = await fetchDiscordCosmetics();
      fs.writeFileSync(effectsFile, JSON.stringify(discordCosmetics.effects, null, 2), 'utf8');
      fs.writeFileSync(
        decorationsFile,
        JSON.stringify(discordCosmetics.decorations, null, 2),
        'utf8'
      );
      console.log(
        `Read ${discordCosmetics.effects.length} profile effects and ${discordCosmetics.decorations.length} avatar decorations from Discord.`
      );
      return discordCosmetics;
    } catch (err) {
      console.warn(`Could not read the Discord catalog (${err.message}); using saved data.`);
    }
  }

  const readList = (...files) => {
    for (const file of files) {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  };
  discordCosmetics = {
    effects: readList(effectsFile, path.join(rootDir, 'src/util/profileEffects.json')),
    decorations: readList(decorationsFile, path.join(rootDir, 'src/util/decorations.json')),
  };
  if (!DISCORD_TOKEN && discordCosmetics.effects.length === 0) {
    console.warn(
      'No profile effects or avatar decorations to upload: set DISCORD_TOKEN (or --discord-token) to read them from Discord.'
    );
  }
  return discordCosmetics;
}

function loadAvatarDecorations() {
  return loadDiscordCosmetics().then((c) => c.decorations);
}

function loadProfileEffects() {
  return loadDiscordCosmetics().then((c) => c.effects);
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
      await publishPack(stateKey, content);
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
      await publishPack(stateKey, content);
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
      await publishPack(stateKey, content);
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
    // Discord plays an effect in two layers: a one-shot intro, then a loop. A lone layer is the loop.
    const layers = (eff.effects ?? []).filter((x) => x?.src);
    const loopLayer = layers.find((x) => x.loop) ?? layers[layers.length - 1];
    const introLayer = layers.find((x) => !x.loop && x !== loopLayer);

    if (!loopLayer) {
      // The thumbnail is a still preview, not the effect, so there is nothing right to upload.
      console.warn(`[${i}/${total}] Skipping ${eff.title}: no animation layers listed.`);
      return;
    }

    // An effect is uploaded again when the art it points at is not the art uploaded last time. Effects
    // uploaded before sources were recorded have no record, so they are checked once.
    // (Signed URLs change their query on every request, so only the path counts.)
    const stable = (url) => url.split('?')[0];
    const uploaded = cache.effectSources[eff.id];
    const loopStale = !cache.effects[eff.id] || uploaded?.loop !== stable(loopLayer.src);
    const introStale = introLayer
      ? !cache.effectIntros[eff.id] || uploaded?.intro !== stable(introLayer.src)
      : false;

    try {
      if (loopStale) {
        const buf = await fetchBufferWithRetry(loopLayer.src);
        const mxc = await uploadMedia(buf, `${eff.id}.png`, 'image/png');
        cache.effects[eff.id] = mxc;
        console.log(`[${i}/${total}] Uploaded Profile Effect: ${eff.title} (${eff.id}) -> ${mxc}`);
        await sleep(60);
      }
      if (introStale) {
        const buf = await fetchBufferWithRetry(introLayer.src);
        const mxc = await uploadMedia(buf, `${eff.id}_intro.png`, 'image/png');
        cache.effectIntros[eff.id] = mxc;
        console.log(`[${i}/${total}] Uploaded Profile Effect intro: ${eff.title} -> ${mxc}`);
        await sleep(60);
      } else if (!introLayer) {
        delete cache.effectIntros[eff.id];
      }
      cache.effectSources[eff.id] = {
        loop: stable(loopLayer.src),
        intro: introLayer ? stable(introLayer.src) : null,
      };
      saveCache();
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
      const introMxc = cache.effectIntros[item.id];
      packImages[shortcode] = {
        url: mxc,
        body: item.title,
        usage: ['profile_effect'],
        info: {
          mimetype: 'image/png',
          ...(introMxc ? { [EFFECT_INTRO_INFO_KEY]: introMxc } : {}),
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
      await publishPack(stateKey, content);
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

  if (!SCRAPE_ONLY && (!HOMESERVER_URL || !ACCESS_TOKEN || !TARGET_ROOM_ID)) {
    console.error(
      '\nError: Missing Matrix homeserver, access token or target space. Set HOMESERVER_URL, ACCESS_TOKEN and COSMETICS_SPACE in .env.local, or pass --homeserver, --token and --space.'
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
    const decorations = await loadAvatarDecorations();
    if (decorations.length > 0 && !SCRAPE_ONLY) {
      await migrateAvatarDecorations(decorations);
    }
  }

  // 4. Profile Effects
  if (['all', 'effects', 'profile_effects'].includes(COSMETIC_TYPE)) {
    const effects = await loadProfileEffects();
    if (effects.length > 0 && !SCRAPE_ONLY) {
      await migrateProfileEffects(effects);
    }
  }

  console.log('\n✓ All requested operations completed successfully!');
}

main().catch((err) => {
  console.error('\nFatal error during sync:', err);
  process.exit(1);
});
