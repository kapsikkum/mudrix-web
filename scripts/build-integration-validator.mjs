// Builds scripts/validate.mjs for integration repositories (mudrix-integrations and
// mudrix-integration-template) from Mudrix's own validator, so authors run exactly the checks
// Mudrix runs. Rebuild and copy it over whenever src/app/features/integrations/manifest.ts changes.
//
// Usage: node scripts/build-integration-validator.mjs [out-file ...]
//   (default out file: dist/integration-validate.mjs)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outs = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => resolve(p))
  : [join(root, 'dist', 'integration-validate.mjs')];

let rev = 'unknown';
try {
  rev = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
  const dirty = execFileSync('git', ['status', '--porcelain', 'src/app/features/integrations'], {
    cwd: root,
  }).toString();
  if (dirty.trim()) rev += ' with local changes';
} catch {
  /* not a git checkout */
}

const result = await build({
  entryPoints: [join(root, 'scripts', 'integration-validator.entry.mjs')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  write: false,
  legalComments: 'none',
  // The validator accepts localhost hosts only in Mudrix development builds; the CLI decides.
  define: { 'import.meta.env.DEV': 'globalThis.__MUDRIX_DEV__' },
  plugins: [
    {
      // The validator only needs the capability ids, not the Widget API library behind the
      // capability strings; a small stand-in keeps the file small and dependency-free.
      name: 'widget-api-stub',
      setup(b) {
        b.onResolve({ filter: /^matrix-widget-api$/ }, () => ({
          path: 'matrix-widget-api',
          namespace: 'stub',
        }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          loader: 'js',
          contents: `
            export const EventDirection = { Send: 'send', Receive: 'receive' };
            const cap = (kind) => (dir, type) => ({ raw: 'stub.' + kind + '.' + dir + ':' + type });
            export const WidgetEventCapability = { forRoomEvent: cap('event'), forStateEvent: cap('state_event') };
            export const MatrixCapabilities = { MSC4039UploadFile: 'stub.upload_file', MSC4039DownloadFile: 'stub.download_file' };
          `,
        }));
      },
    },
  ],
});

const banner = `// GENERATED FILE, do not edit. Built from Mudrix's own repository validator
// (mudrix-web ${rev}, src/app/features/integrations/manifest.ts) by
// scripts/build-integration-validator.mjs, so it checks exactly what Mudrix checks.
//
//   node scripts/validate.mjs [repo.json ...] [--dev]
//
// --dev accepts what only Mudrix development builds accept: localhost hosts, and a file without
// "key" and "serial" (examples/dev-repo.json). Node 20 or newer, no dependencies.
`;
const code = banner + result.outputFiles[0].text;
for (const out of outs) {
  mkdirSync(dirname(out), { recursive: true });
  const before = (() => {
    try {
      return readFileSync(out, 'utf8');
    } catch {
      return null;
    }
  })();
  writeFileSync(out, code);
  console.log(`${before === code ? 'unchanged' : 'wrote'} ${out}`);
}
