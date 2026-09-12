// What @stacknav/react costs a consumer, minified and gzipped (run `pnpm build`
// first). React and React Router are external, as they would be in an app;
// @stacknav/core is bundled in the first row and external in the second, so
// the difference is what the port itself adds on top of the engine.
import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const CASES = [
  ['StackRoutes (with core)', `export { StackRoutes } from './index.js';`, []],
  ['StackRoutes, core external', `export { StackRoutes } from './index.js';`, ['@stacknav/core']],
];

const kb = (n) => (n / 1024).toFixed(2).padStart(6) + ' kB';
console.log(`${'import'.padEnd(44)}${'minified'.padStart(10)}${'gzipped'.padStart(11)}`);
for (const [name, contents, external] of CASES) {
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: dist, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
    external: ['react', 'react-dom', 'react/jsx-runtime', 'react-router', ...external],
  });
  const out = outputFiles[0].text;
  console.log(`${name.padEnd(44)}${kb(out.length)}${kb(gzipSync(out).length)}`);
}
