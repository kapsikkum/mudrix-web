// PRIVATE USE ONLY. This script downloads Discord collectible art and re-uploads it to Matrix, which
// may breach Discord's terms of service. Run it only for your own private server. Never commit or
// redistribute the data or art it fetches or produces (scripts/*-cache.json, scripts/data/, ...).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, 'data');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

// 1. Crawl all nameplates
async function crawlNameplates() {
  console.log('--- Crawling Nameplates ---');
  let page = 1;
  const items = new Map();

  while (page <= 20) {
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
        });
      }
      countOnPage++;
    }
    console.log(`[Nameplates] Page ${page}: found ${countOnPage} items. Total: ${items.size}`);
    if (countOnPage === 0 || !html.includes(`page=${page + 1}`)) break;
    page++;
    await sleep(200);
  }

  // Fetch full details (collection, mediaUrl) for each nameplate
  console.log(`Fetching detailed metadata for ${items.size} nameplates...`);
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
        item.mediaUrl = `https://cdn.discordapp.com/media/v1/collectibles-shop/${item.skuId}/animated`;
        item.animatedUrl = `https://cdn.discordapp.com/media/v1/collectibles-shop/${item.skuId}/animated`;
      }
    } catch (err) {
      console.error(`Error on nameplate ${item.skuId}:`, err.message);
    }
    if (idx % 25 === 0) {
      console.log(`Processed details ${idx}/${list.length}...`);
      await sleep(150);
    }
  }

  fs.writeFileSync(path.join(outDir, 'nameplates.json'), JSON.stringify(list, null, 2), 'utf8');
  console.log(`Saved ${list.length} nameplates to scripts/data/nameplates.json`);
  return list;
}

// 2. Crawl all profile frames
async function crawlProfileFrames() {
  console.log('\n--- Crawling Profile Frames ---');
  let page = 1;
  const items = new Map();

  while (page <= 5) {
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
    console.log(`[Profile Frames] Page ${page}: found ${countOnPage} items. Total: ${items.size}`);
    if (countOnPage === 0 || !html.includes(`page=${page + 1}`)) break;
    page++;
    await sleep(200);
  }

  console.log(`Fetching detailed metadata for ${items.size} profile frames...`);
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
    if (idx % 15 === 0) {
      console.log(`Processed details ${idx}/${list.length}...`);
      await sleep(150);
    }
  }

  fs.writeFileSync(path.join(outDir, 'profileFrames.json'), JSON.stringify(list, null, 2), 'utf8');
  console.log(`Saved ${list.length} profile frames to scripts/data/profileFrames.json`);
  return list;
}

async function main() {
  await crawlNameplates();
  await crawlProfileFrames();
  console.log('\nAll Nameplates and Profile Frames scraped successfully!');
}

main().catch(console.error);
