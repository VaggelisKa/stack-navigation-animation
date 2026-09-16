// Copies the repository's LICENSE into the package that runs it, so the file
// ships in the published tarball. Both packages say MIT in their package.json
// and npm shows that badge either way, but only a file in the tarball tells
// someone who vendored the code what the terms actually are.
//
// Run from a package directory: `node ../../scripts/copy-license.mjs [dest...]`
// Each dest is a directory, relative to the package, to copy the file into;
// with no arguments it copies into the package root. The copies are generated,
// not sources, so they are gitignored.
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../LICENSE', import.meta.url));
const dests = process.argv.slice(2).length ? process.argv.slice(2) : ['.'];

for (const dest of dests) {
  await mkdir(dest, { recursive: true });
  await copyFile(source, join(dest, 'LICENSE'));
  console.log(`LICENSE -> ${join(dest, 'LICENSE')}`);
}
