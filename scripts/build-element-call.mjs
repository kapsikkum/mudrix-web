#!/usr/bin/env node
/**
 * Build our Element Call fork (the element-call submodule) into element-call/dist, which
 * vite.config.ts ships as /element-call/ in place of the upstream npm package.
 *
 * Needs pnpm (`corepack enable pnpm`). Skips quietly when the submodule is not checked out, so a
 * plain clone still builds with the npm package.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'element-call');
if (!existsSync(resolve(root, 'package.json'))) {
  console.log('[element-call] submodule not checked out; using the npm package');
  process.exit(0);
}

try {
  execSync('pnpm --version', { stdio: 'ignore' });
} catch {
  console.warn('[element-call] pnpm not found (corepack enable pnpm); using the npm package');
  process.exit(0);
}

const run = (cmd, env = {}) =>
  execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

if (!existsSync(resolve(root, 'node_modules'))) run('pnpm install --frozen-lockfile');
// Element Call's own build script sets NODE_OPTIONS with Unix syntax; do it here instead.
run('pnpm exec vite build --config vite-embedded.config.js', {
  NODE_OPTIONS: '--max-old-space-size=16384',
});
