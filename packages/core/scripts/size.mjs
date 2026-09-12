// What @stacknav/core costs a consumer, minified and gzipped, for a few ways of
// using it. Bundles the built package (run `pnpm build` first) with esbuild, the
// way an app's bundler would, so the numbers are what ships, not what is on disk.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
// Entries are resolved against `dist`, so the module specifier stays a plain
// relative path whatever characters the checkout's directory contains.
const CASES = [
  ['everything', `export * from './index.js';`],
  ['createNativeStack (stack + native look + swipe policy)', `export { createNativeStack } from './index.js';`],
  ['createNativeStack + injectStyles', `export { createNativeStack, injectStyles } from './index.js';`],
  ['NavigationStack + your own transition', `export { NavigationStack } from './index.js';`],
  ['direction strategies only', `export { createDirectionResolver, defaultStrategies, segmentsOf } from './index.js';`],
  ['attachBrowserHistory only', `export { attachBrowserHistory } from './index.js';`],
  ['injectStyles only', `export { injectStyles } from './index.js';`],
];

const kb = (n) => (n / 1024).toFixed(2).padStart(6) + ' kB';
console.log(`${'import'.padEnd(44)}${'minified'.padStart(10)}${'gzipped'.padStart(11)}`);
for (const [name, contents] of CASES) {
  const { outputFiles } = await build({ stdin: { contents, resolveDir: dist, loader: 'js' }, bundle: true, minify: true, format: 'esm', target: 'es2022', write: false, logLevel: 'silent' });
  const out = outputFiles[0].text;
  console.log(`${name.padEnd(44)}${kb(out.length)}${kb(gzipSync(out).length)}`);
}
