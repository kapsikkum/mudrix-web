import { defineConfig, type Plugin } from 'vite';
import type { AtRule, Container, Document, Helpers, Root, Rule } from 'postcss';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { readFileSync } from 'fs';
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
    // Ship the Element Call embedded widget alongside the app (served from /element-call/).
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@element-hq/element-call-embedded/dist/*',
          dest: 'element-call',
        },
      ],
    }),
  ],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 8080,
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
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
});
