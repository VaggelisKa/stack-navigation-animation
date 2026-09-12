// What a consumer's bundle keeps when it imports one thing from the package.
//
// Bundled from src with esbuild, with every module marked as *having* side
// effects: that switches off the shortcut a bundler takes from the package's
// `sideEffects` flag, so the only thing that can drop a module is the code
// itself being free of top-level work (or annotated as such). A test here fails
// when a new module-load call sneaks in without a `#__PURE__` mark.
//
// What survived is read from esbuild's metafile, which credits every output
// byte to the source file it came from. A module whose only trace is a kept
// top-level call still shows up there, where a search for some marker string
// inside one of its (dropped) functions would not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

/** Every module of the package, by file name without the extension. */
const ALL = ['animate', 'css-vars', 'direction', 'history-adapter', 'index', 'native-transition', 'navigation-stack', 'platform', 'styles', 'swipe-back'];

const everythingHasSideEffects: Plugin = {
  name: 'every-module-has-side-effects',
  setup(b) {
    b.onResolve({ filter: /^\.\.?\// }, (args) => ({ path: resolve(args.resolveDir, args.path), sideEffects: true }));
  },
};

/** Bundles `entry` and returns the modules that contributed bytes to the output, sorted. */
async function survivors(entry: string): Promise<string[]> {
  const { metafile } = await build({
    stdin: { contents: entry, resolveDir: SRC, loader: 'ts' },
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
    metafile: true,
    target: 'es2022',
    plugins: [everythingHasSideEffects],
    logLevel: 'silent',
  });
  const [output] = Object.values(metafile.outputs);
  return Object.entries(output.inputs)
    .filter(([file, { bytesInOutput }]) => file !== '<stdin>' && bytesInOutput > 0)
    .map(([file]) => basename(file, extname(file)))
    .sort();
}

test('importing everything keeps every module (so the list above is complete)', async () => {
  assert.deepEqual(await survivors(`export * from './index.ts';`), ALL);
});

test('a direction strategy alone brings in nothing else', async () => {
  assert.deepEqual(await survivors(`export { segmentsOf, fromTree } from './index.ts';`), ['direction']);
});

test('injectStyles alone is the stylesheet and nothing else', async () => {
  assert.deepEqual(await survivors(`export { injectStyles } from './index.ts';`), ['styles']);
});

test('the history adapter alone brings in only the platform check', async () => {
  assert.deepEqual(await survivors(`export { attachBrowserHistory } from './index.ts';`), ['history-adapter', 'platform']);
});

test('NavigationStack with a custom transition leaves out the iOS look and the parsers', async () => {
  assert.deepEqual(await survivors(`export { NavigationStack } from './index.ts';`), ['animate', 'navigation-stack']);
});

test('createNativeStack leaves out direction resolution, the history adapter and the stylesheet', async () => {
  assert.deepEqual(await survivors(`export { createNativeStack } from './index.ts';`), ['animate', 'css-vars', 'index', 'native-transition', 'navigation-stack', 'platform', 'swipe-back']);
});
