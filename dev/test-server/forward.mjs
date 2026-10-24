#!/usr/bin/env node
/**
 * Forwards the test server's ports on 127.0.0.1 (IPv4) to the Podman VM, so `adb reverse` can hand
 * them to a USB-connected phone or tablet. Use with MUDRIX_TEST_MEDIA_HOST=127.0.0.1 up.mjs.
 *
 *   node dev/test-server/forward.mjs
 *   adb reverse tcp:6167 tcp:6167   # and 8090, 7880, 7881
 */
import net from 'node:net';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const env = JSON.parse(readFileSync(join(here, '.generated', 'env.json'), 'utf8'));
// Homeserver, lk-jwt, LiveKit signalling and LiveKit's TCP media.
const PORTS = [6167, 8090, 7880, 7881];

for (const port of PORTS) {
  net
    .createServer((client) => {
      const upstream = net.connect(port, env.host);
      client.pipe(upstream).pipe(client);
      const end = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on('error', end);
      upstream.on('error', end);
    })
    .on('error', (e) => console.error(`127.0.0.1:${port}: ${e.code} (already forwarded?)`))
    .listen(port, '127.0.0.1', () => console.log(`127.0.0.1:${port} -> ${env.host}:${port}`));
}
