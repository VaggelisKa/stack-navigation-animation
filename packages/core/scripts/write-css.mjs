// Emits dist/stacknav.css from the CSS string in src/styles.ts (the single source of truth),
// for apps that prefer a stylesheet over runtime injection.
import { mkdir, writeFile } from 'node:fs/promises';
const { STACKNAV_CSS } = await import('../dist/styles.js');
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/stacknav.css', import.meta.url), STACKNAV_CSS.trim() + '\n');
console.log('wrote dist/stacknav.css');
