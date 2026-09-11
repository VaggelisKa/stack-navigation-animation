// The size of the built FESM bundle (run `pnpm build` first). Angular libraries
// ship unminified and partially compiled; the app's build links, minifies and
// tree-shakes them, so this is an upper bound on what an app keeps.
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const file = new URL('../dist/fesm2022/stacknav-angular.mjs', import.meta.url);
const source = await readFile(file);
const kb = (n) => (n / 1024).toFixed(2) + ' kB';
console.log(`fesm2022/stacknav-angular.mjs  raw ${kb(source.length)}  gzipped ${kb(gzipSync(source).length)}`);
