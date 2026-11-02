import { defineConfig, type Plugin } from 'vite';
import type { AtRule, Container, Document, Helpers, Root, Rule } from 'postcss';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const appVersion = packageJson.version;

// Emits a plain-text `version.txt` into the build output so the running app
// can poll it to detect when a new version has been deployed.
function versionFilePlugin(): Plugin {
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.txt',
        source: appVersion,
      });
    },
  };
}

// Spellcheck dictionaries (Hunspell .aff/.dic from the dictionary-* devDependencies, one licence file
// each) are served raw at <base>dictionaries/<lang>/{index.aff,index.dic,license} so they stay out
// of the JS bundles and out of git: the dev server answers from node_modules, the build copies them
// into dist/. Keep the language list in sync with src/util/spellcheck/languages.ts.
const SPELLCHECK_DICTIONARIES = ['en', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'tr'];
const DICTIONARY_FILES = ['index.aff', 'index.dic', 'license'];

function spellcheckDictionariesPlugin(): Plugin {
  const source = (lang: string, file: string) =>
    resolve(__dirname, 'node_modules', `dictionary-${lang}`, file);
  let base = '/';
  return {
    name: 'spellcheck-dictionaries',
    configResolved(config) {
      base = config.base;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const prefix = `${base}dictionaries/`;
        if (!path.startsWith(prefix)) return next();
        const [lang, file] = path.slice(prefix.length).split('/');
        if (
          !SPELLCHECK_DICTIONARIES.includes(lang) ||
          !DICTIONARY_FILES.includes(file) ||
          !existsSync(source(lang, file))
        ) {
          return next();
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(readFileSync(source(lang, file)));
      });
    },
    generateBundle() {
      for (const lang of SPELLCHECK_DICTIONARIES) {
        for (const file of DICTIONARY_FILES) {
          this.emitFile({
            type: 'asset',
            fileName: `dictionaries/${lang}/${file}`,
            source: readFileSync(source(lang, file)),
          });
        }
      }
    },
  };
}

// Content-Security-Policy for the web build, injected as a <meta> tag. Build only: the dev server
// needs inline scripts (React refresh preamble). Skipped for Tauri builds, which carry their own CSP
// in tauri.conf.json. 'self' is origin-wide, so it also covers BASE_PATH deployments. nginx.conf sends
// the same policy as a header (plus frame-ancestors, which a meta tag cannot enforce).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "media-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: blob: data:",
  "worker-src 'self' blob:",
  "frame-src 'self' https: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml() {
      if (process.env.TAURI_ENV_PLATFORM) return undefined;
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

// Touch devices keep :hover applied after a tap, which makes buttons look stuck. Wrap every rule
// that uses :hover in @media (hover: hover) so it only applies where a pointer can really hover.
function hoverOnlyPlugin() {
  return {
    postcssPlugin: 'hover-only',
    Once(root: Root, { AtRule }: Helpers) {
      const seen = new WeakSet<object>();
      root.walkRules((rule: Rule) => {
        if (seen.has(rule) || !/:hover/.test(rule.selector)) return;
        for (
          let p: Container | Document | undefined = rule.parent;
          p && p.type !== 'root';
          p = p.parent
        ) {
          if (p.type === 'atrule' && /hover\s*:\s*hover/.test((p as AtRule).params)) return;
          if (p.type === 'atrule' && /keyframes/.test((p as AtRule).name)) return;
        }
        const wrapper = new AtRule({ name: 'media', params: '(hover: hover)' });
        seen.add(rule);
        rule.replaceWith(wrapper);
        wrapper.append(rule);
      });
    },
  };
}
hoverOnlyPlugin.postcss = true;

export default defineConfig({
  css: { postcss: { plugins: [hoverOnlyPlugin()] } },
  // Set BASE_PATH (e.g. /mudrix-web/) when deploying under a subpath such as GitHub Pages.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    vanillaExtractPlugin(),
    wasm(),
    topLevelAwait(),
    versionFilePlugin(),
    spellcheckDictionariesPlugin(),
    cspPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // hunspell-asm's loader ships an ESM build that calls `import * as nanoid` as a function, which
      // rollup rejects at runtime; its CommonJS build is fine (see src/util/spellcheck/spellcheckCore.ts).
      'emscripten-wasm-loader': resolve(
        __dirname,
        'node_modules/emscripten-wasm-loader/dist/cjs/index.js'
      ),
      // Call engine in rtc/ (MatrixRTC + LiveKit)
      'mudrix-rtc': resolve(__dirname, 'rtc/index.ts'),
    },
  },
  server: {
    // MUDRIX_DEV_PORT: Windows reserves whole port ranges (Hyper-V, WSL) that can include 8080.
    port: Number(process.env.MUDRIX_DEV_PORT) || 8080,
    // dev/test-server/.generated is rewritten while the test server's bots run (camera clips, state).
    watch: { ignored: ['**/dev/test-server/.generated/**'] },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.APP_HOME_URL': JSON.stringify(
      packageJson.homepage ?? 'https://kapsikkum.github.io/mudrix-web/'
    ),
  },
  optimizeDeps: {
    entries: ['index.html'],
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
});
