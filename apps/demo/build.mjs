// Builds dist/demo.html: the vanilla demo as one self-contained page.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
await mkdir('dist', { recursive: true });

const demo = await build({
  entryPoints: ['src/demo.js'],
  bundle: true,
  format: 'iife',
  write: false,
  target: 'es2020',
});

const css = [await readFile(require.resolve('@stacknav/core/stacknav.css'), 'utf8'), await readFile('src/demo.css', 'utf8')].join('\n');
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
console.log('built dist/demo.html');
