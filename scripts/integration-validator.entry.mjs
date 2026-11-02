// Entry for scripts/build-integration-validator.mjs. Bundled together with Mudrix's own
// repository validator (src/app/features/integrations/manifest.ts), so integration authors can run
// exactly the checks Mudrix runs, offline, before they sign and publish.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CAPABILITIES,
  hasCapability,
  parseManifestText,
  runsCode,
} from '../src/app/features/integrations/manifest';

const PLACEHOLDER_KEY = /^REPLACE_ME/;
// Valid, but not a real key: lets an unsigned dev repository (no key, no serial) be checked.
const DEV_KEY = 'A'.repeat(43) + '=';

/**
 * Checks repo.json text the way Mudrix does. `dev` also accepts what only Mudrix development
 * builds accept (localhost hosts) and a file without key and serial, as examples/dev-repo.json is.
 * Returns { ok: true, manifest } or { ok: false, error }.
 */
export function checkRepoText(text, { dev = false } = {}) {
  globalThis.__MUDRIX_DEV__ = dev;
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `not valid JSON: ${e.message}` };
  }
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    if (typeof json.key === 'string' && PLACEHOLDER_KEY.test(json.key))
      return { ok: false, error: 'repo.key is not set yet. Run: npm run init' };
    if (dev && json.key === undefined && json.serial === undefined) {
      const { schema, name, ...rest } = json;
      text = JSON.stringify({ schema, name, key: DEV_KEY, serial: 1, ...rest });
    }
  }
  const res = parseManifestText(text);
  if (!res.ok) return res;
  // Mudrix itself only sets an unusable entry aside, so that one mistake (or an entry written for
  // a newer Mudrix) does not take the rest down. A file you publish should have none.
  const { rejected } = res.value;
  if (rejected.length > 0) {
    const lines = rejected.map(
      (r) =>
        `  ${r.error}${r.reason === 'unsupported' ? ' (not known to this Mudrix version: update scripts/validate.mjs if a newer Mudrix supports it)' : ''}`
    );
    return {
      ok: false,
      error: `${rejected.length} integration${rejected.length === 1 ? '' : 's'} would not be usable in Mudrix:\n${lines.join('\n')}`,
    };
  }
  return { ok: true, manifest: res.value };
}

/** One line per integration: what it asks for. */
export function describe(manifest) {
  return manifest.integrations.map((i) => {
    const caps = CAPABILITIES.filter((c) => hasCapability(i.permissions, c));
    return `  ${i.id} ${i.version}: ${caps.length ? caps.join(', ') : 'no permissions'}${runsCode(i.permissions) ? '  (RUNS CODE)' : ''}`;
  });
}

function main(argv) {
  const dev = argv.includes('--dev');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (argv.includes('--help')) {
    console.log(
      'Usage: node scripts/validate.mjs [repo.json ...] [--dev]\n  --dev  accept what only Mudrix development builds accept (localhost hosts, no key or serial)'
    );
    return 0;
  }
  let failed = 0;
  for (const file of files.length ? files : ['repo.json']) {
    let text;
    try {
      text = readFileSync(resolve(file), 'utf8');
    } catch {
      console.error(`${file}: not found`);
      failed += 1;
      continue;
    }
    const res = checkRepoText(text, { dev });
    if (!res.ok) {
      console.error(`${file}: ${res.error}`);
      failed += 1;
    } else {
      const n = res.manifest.integrations.length;
      console.log(
        `OK: ${file} passes Mudrix's checks${dev ? ' (development build rules)' : ''}, ${n} integration${n === 1 ? '' : 's'}:`
      );
      describe(res.manifest).forEach((l) => console.log(l));
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
