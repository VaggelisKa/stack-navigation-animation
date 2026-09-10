// Builds two things into dist/:
//   stacknav.js          the library as a single ES module
//   demo.html            the demo as one self-contained page (what gets published as an Artifact)
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['lib/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/stacknav.js',
  target: 'es2020',
});

const demo = await build({
  entryPoints: ['demo/demo.js'],
  bundle: true,
  format: 'iife',
  write: false,
  target: 'es2020',
});

const css = [await readFile('lib/stacknav.css', 'utf8'), await readFile('demo/demo.css', 'utf8')].join('\n');
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>stacknav</title>
  <style>
${css}
  </style>
</head>
<body>
  <div class="desk"><div id="app"></div></div>
  <p class="desk-note">Drag from the left edge to go back — mouse works too. Browser back is wired in.</p>
  <script>
${demo.outputFiles[0].text}
  </script>
</body>
</html>
`;
await writeFile('dist/demo.html', html);
console.log('built dist/stacknav.js and dist/demo.html');
