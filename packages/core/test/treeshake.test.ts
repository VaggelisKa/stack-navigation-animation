// What a consumer's bundle keeps when it imports one thing from the package.
//
// Bundled from src with esbuild, with every module marked as *having* side
// effects: that switches off the shortcut a bundler takes from the package's
// `sideEffects` flag, so the only thing that can drop a module is the code
// itself being free of top-level work (or annotated as such). A test here fails
// when a new module-load call sneaks in without a `#__PURE__` mark.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, type Plugin } from 'esbuild';

/** One string that survives minification and appears in exactly one module. */
const MARKERS = {
  animate: 'requestAnimationFrame',
  cssVars: 'cubic-bezier',
  direction: '[?#]',
  gesture: 'pointerdown',
  history: 'popstate',
  stack: 'NavigationStack needs',
  styles: 'stacknav-styles',
  transition: '--sn-duration',
} as const;
type Module = keyof typeof MARKERS;

const everythingHasSideEffects: Plugin = {
  name: 'every-module-has-side-effects',
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, (args) => ({ path: new URL(args.path, `file://${args.resolveDir}/`).pathname, sideEffects: true }));
  },
};

async function bundle(entry: string): Promise<string> {
  const result = await build({
    stdin: { contents: entry, resolveDir: new URL('../src/', import.meta.url).pathname, loader: 'ts' },
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    target: 'es2022',
    plugins: [everythingHasSideEffects],
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
}

function modulesIn(out: string): Module[] {
  return (Object.keys(MARKERS) as Module[]).filter((m) => out.includes(MARKERS[m]));
}

test('the markers are sound: importing everything keeps every module', async () => {
  const out = await bundle(`export * from './index.ts';`);
  assert.deepEqual(modulesIn(out), Object.keys(MARKERS));
});

test('a direction strategy alone brings in nothing else', async () => {
  const out = await bundle(`export { segmentsOf, fromTree } from './index.ts';`);
  assert.deepEqual(modulesIn(out), ['direction']);
});

test('injectStyles alone is the stylesheet and nothing else', async () => {
  const out = await bundle(`export { injectStyles } from './index.ts';`);
  assert.deepEqual(modulesIn(out), ['styles']);
  assert.ok(out.length < 600, `expected a few hundred bytes, got ${out.length}`);
});

test('the history adapter alone brings in nothing else', async () => {
  const out = await bundle(`export { attachBrowserHistory } from './index.ts';`);
  assert.deepEqual(modulesIn(out), ['history']);
});

test('NavigationStack with a custom transition leaves out the iOS look, the gesture and the parsers', async () => {
  const out = await bundle(`export { NavigationStack } from './index.ts';`);
  assert.deepEqual(modulesIn(out), ['animate', 'stack']);
});

test('createIOSStack leaves out direction resolution, the history adapter and the stylesheet', async () => {
  const out = await bundle(`export { createIOSStack } from './index.ts';`);
  assert.deepEqual(modulesIn(out), ['animate', 'cssVars', 'gesture', 'stack', 'transition']);
});
