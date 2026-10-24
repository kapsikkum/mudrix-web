#!/usr/bin/env node
/**
 * Pokes a browser started by participants.mjs over CDP.
 *
 *   node dev/test-server/cdp.mjs <port|user> shot <out.png> [width height]
 *   node dev/test-server/cdp.mjs <port|user> eval <file.js | expression>
 *   node dev/test-server/cdp.mjs <port|user> goto <path> [out.png]
 *
 * MUDRIX_TOUCH=1 adds touch emulation to the viewport. MUDRIX_VIEWPORT=WxH emulates that viewport for any command; an override only lasts while this
 * script is connected, so measuring after a separate `shot` would see the default size.
 * A user name looks its port up in .generated/bots.json. `eval` runs the code as an async
 * function body and prints what it returns.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [who, cmd, ...rest] = process.argv.slice(2);
const bots = JSON.parse(readFileSync(join(here, '.generated', 'bots.json'), 'utf8'));
const port = /^\d+$/.test(who) ? Number(who) : bots.find((b) => b.user === who)?.port;
if (!port || !cmd) {
  console.error('usage: cdp.mjs <port|user> <shot|eval|goto> ...');
  process.exit(1);
}

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
// participants.mjs drives the tab it opened on the app; skip extension and welcome tabs.
const page =
  targets.find((t) => t.type === 'page' && t.url.startsWith('http://localhost')) ??
  targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools'));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = (id += 1);
    const onMessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id !== n) return;
      ws.removeEventListener('message', onMessage);
      if (d.error) reject(new Error(`${method}: ${d.error.message}`));
      else resolve(d.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

async function setViewport(width, height) {
  await call('Emulation.setDeviceMetricsOverride', {
    width: Number(width),
    height: Number(height),
    deviceScaleFactor: 1,
    // MUDRIX_TOUCH=1 emulates a touch screen (a tablet: coarse pointer, but wider than a phone).
    mobile: Number(width) < 700 || process.env.MUDRIX_TOUCH === '1',
  });
  if (process.env.MUDRIX_TOUCH === '1') {
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  }
  await new Promise((r) => setTimeout(r, 800));
}
if (process.env.MUDRIX_VIEWPORT) await setViewport(...process.env.MUDRIX_VIEWPORT.split('x'));

if (cmd === 'shot') {
  const [out, width, height] = rest;
  if (width && height) await setViewport(width, height);
  const { data } = await call('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(out);
} else if (cmd === 'eval') {
  const src = existsSync(rest[0]) ? readFileSync(rest[0], 'utf8') : rest.join(' ');
  const res = await call('Runtime.evaluate', {
    expression: `(async () => { ${src} })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails)
    console.error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
  const v = res.result?.value;
  console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
  // MUDRIX_SHOT=out.png: screenshot after the code ran, still under any viewport override.
  if (process.env.MUDRIX_SHOT) {
    await new Promise((r) => setTimeout(r, 900));
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(process.env.MUDRIX_SHOT, Buffer.from(data, 'base64'));
  }
} else if (cmd === 'goto') {
  await call('Page.navigate', { url: new URL(rest[0], 'http://localhost:8080').href });
  console.log('ok');
  // goto <path> <out.png>: wait for the page, then shoot while the viewport override still applies.
  if (rest[1]) {
    await new Promise((r) => setTimeout(r, 7000));
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(rest[1], Buffer.from(data, 'base64'));
    console.log(rest[1]);
  }
}
process.exit(0);
