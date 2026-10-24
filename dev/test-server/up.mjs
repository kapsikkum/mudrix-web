#!/usr/bin/env node
/**
 * Local Matrix + MatrixRTC stack for testing Mudrix: tuwunel, LiveKit and lk-jwt-service in
 * Podman. Nothing here is for production (open registration, fixed LiveKit secret).
 *
 *   node dev/test-server/up.mjs          start (or restart) the stack
 *   node dev/test-server/up.mjs down     stop it, keep the data
 *   node dev/test-server/up.mjs reset    stop it and delete the homeserver's data
 *
 * Podman on Windows runs in a WSL VM whose port forwarding (netavark) does not work with the WSL
 * kernel, so the containers use host networking and are reached on the VM's own IP. That IP can
 * change when WSL restarts, which is why the configs are templates filled in here. The values
 * the other scripts need are written to .generated/env.json.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '.generated');
const PREFIX = 'mudrix-test';
const VOLUME = `${PREFIX}-tuwunel`;
const SECRET = 'mudrix-test-secret-not-for-production-use';

const podman = (...args) => execFileSync('podman', args, { encoding: 'utf8' }).trim();
const tryPodman = (...args) => {
  try {
    return podman(...args);
  } catch {
    return null;
  }
};

function vmHost() {
  if (process.env.MUDRIX_TEST_HOST) return process.env.MUDRIX_TEST_HOST;
  if (process.platform !== 'win32' && process.platform !== 'darwin') return '127.0.0.1';
  const ip = podman('machine', 'ssh', 'ip -4 -o addr show eth0').match(/inet (\d+\.\d+\.\d+\.\d+)/);
  if (!ip) throw new Error('Could not find the Podman VM address; set MUDRIX_TEST_HOST');
  return ip[1];
}

function stop() {
  for (const name of ['lk-jwt', 'federation-tls', 'livekit', 'tuwunel']) {
    tryPodman('rm', '-f', `${PREFIX}-${name}`);
  }
}

async function waitFor(label, url) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not come up at ${url}`);
}

const mode = process.argv[2] ?? 'up';
stop();
if (mode === 'down') process.exit(0);
if (mode === 'reset') {
  tryPodman('volume', 'rm', VOLUME);
  process.exit(0);
}

const host = vmHost();
// Where clients are told to reach LiveKit. A phone or tablet cannot reach the VM's address, so
// MUDRIX_TEST_MEDIA_HOST=127.0.0.1 plus forward.mjs and `adb reverse` lets one through USB.
const mediaHost = process.env.MUDRIX_TEST_MEDIA_HOST ?? host;
mkdirSync(out, { recursive: true });
for (const file of ['tuwunel.toml', 'livekit.yaml']) {
  const text = readFileSync(join(here, file), 'utf8')
    .replaceAll('__HOST__', host)
    .replaceAll('__MEDIA_HOST__', mediaHost);
  writeFileSync(join(out, file), text);
}

const run = (name, ...args) =>
  podman('run', '-d', '--name', `${PREFIX}-${name}`, '--network', 'host', ...args);

run(
  'tuwunel',
  '-e',
  'TUWUNEL_CONFIG=/etc/tuwunel.toml',
  '-v',
  `${join(out, 'tuwunel.toml')}:/etc/tuwunel.toml:ro`,
  '-v',
  `${VOLUME}:/var/lib/tuwunel`,
  'ghcr.io/matrix-construct/tuwunel:latest'
);
run(
  'livekit',
  '-v',
  `${join(out, 'livekit.yaml')}:/etc/livekit.yaml:ro`,
  'docker.io/livekit/livekit-server:latest',
  '--config',
  '/etc/livekit.yaml'
);
// HTTPS for mudrix.test in front of tuwunel, with Caddy's own CA (see Caddyfile): federation
// for lk-jwt-service's login checks, and .well-known for Element Call's LiveKit discovery.
run(
  'federation-tls',
  '-v',
  `${join(here, 'Caddyfile')}:/etc/caddy/Caddyfile:ro`,
  'docker.io/library/caddy:2'
);
run(
  'lk-jwt',
  '--add-host',
  'mudrix.test:127.0.0.1',
  '-e',
  'LIVEKIT_JWT_BIND=:8090',
  '-e',
  `LIVEKIT_URL=ws://${mediaHost}:7880`,
  '-e',
  'LIVEKIT_KEY=devkey',
  '-e',
  `LIVEKIT_SECRET=${SECRET}`,
  '-e',
  'LIVEKIT_FULL_ACCESS_HOMESERVERS=mudrix.test',
  // The token service checks logins against the homeserver; mudrix.test has no DNS.
  '-e',
  'LIVEKIT_CS_API_URL_OVERRIDES=mudrix.test=http://127.0.0.1:6167',
  '-e',
  'LIVEKIT_INSECURE_SKIP_VERIFY_TLS=YES_I_KNOW_WHAT_I_AM_DOING',
  'ghcr.io/element-hq/lk-jwt-service:latest'
);

const env = {
  host,
  homeserver: `http://${host}:6167`,
  serverName: 'mudrix.test',
  registrationToken: 'mudrix-test',
  livekit: `ws://${host}:7880`,
  jwt: `http://${host}:8090`,
};
writeFileSync(join(out, 'env.json'), `${JSON.stringify(env, null, 2)}\n`);

await waitFor('tuwunel', `${env.homeserver}/_matrix/client/versions`);
await waitFor('LiveKit', `http://${host}:7880/`);
await waitFor('lk-jwt-service', `${env.jwt}/healthz`);
console.log(`Up. Homeserver ${env.homeserver} (server name ${env.serverName}).`);
