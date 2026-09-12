// Drives the Vite dev server, where React runs in StrictMode and doubles
// renders and effects, to check the stack neither presents a page twice nor
// logs errors. Runs after run.mjs as part of `pnpm e2e`.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const PORT = 5199;
const vite = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'] });
process.on('exit', () => vite.kill());
await new Promise((resolve, reject) => {
  vite.stdout.on('data', (d) => String(d).includes('Local:') && resolve());
  vite.stderr.on('data', (d) => process.stderr.write(d));
  vite.on('exit', (code) => reject(new Error(`vite exited with ${code}`)));
});
const base = `http://127.0.0.1:${PORT}`;

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(`${m.type()}: ${m.text()}`));
let failures = 0;
const eq = (a, b, msg) => {
  const ok = a === b;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg} (${JSON.stringify(a)}${ok ? '' : ' ≠ ' + JSON.stringify(b)})`);
  if (!ok) failures++;
};
const pages = () => page.evaluate(() => [...document.querySelectorAll('.outlet > .sn-page')].map((p) => p.querySelector('[data-page]')?.dataset.page ?? '?').join(','));
const settled = () => page.waitForFunction(() => document.querySelector('.outlet') && !document.querySelector('.outlet').classList.contains('sn-busy'));
const transitions = () => page.evaluate(() => window.__transitions ?? 0);

await page.goto(base + '/');
await page.waitForSelector('[data-page=home]');
eq(await pages(), 'home', 'strict mode: one home page after the doubled mount');
// count transition starts on the container from here on
await page.evaluate(() => {
  window.__transitions = 0;
  const outlet = document.querySelector('.outlet');
  let busy = outlet.classList.contains('sn-busy');
  new MutationObserver(() => {
    const now = outlet.classList.contains('sn-busy');
    if (now && !busy) window.__transitions++;
    busy = now;
  }).observe(outlet, { attributes: true, attributeFilter: ['class'] });
});
await page.click('.sn-page-visible a:has-text("Item 3")');
await settled();
await page.waitForTimeout(700);
eq(await pages(), 'home,item', 'strict mode: one item page pushed');
eq(await transitions(), 1, 'strict mode: the push ran once');
await page.click('.sn-page-visible a:has-text("Reviews")');
await settled();
await page.waitForTimeout(700);
eq(await pages(), 'home,item,reviews', 'strict mode: three pages');
await page.goBack();
await settled();
await page.waitForTimeout(700);
eq(await pages(), 'home,item', 'strict mode: browser back popped');
// swipe back
const box = await page.locator('.outlet').boundingBox();
const y = box.y + box.height / 2;
await page.mouse.move(box.x + 6, y);
await page.mouse.down();
for (let x = 20; x <= 340; x += 30) await page.mouse.move(box.x + x, y);
await page.mouse.up();
await settled();
await page.waitForFunction(() => location.pathname === '/');
await page.waitForTimeout(300);
eq(await pages(), 'home', 'strict mode: swipe back popped and the router followed');
// the feed's initial load happens once
await page.click('.sn-page-visible a:has-text("Feed")');
await settled();
await page.waitForSelector('.feed-card');
await page.waitForTimeout(500);
const ids = await page.evaluate(() => [...document.querySelectorAll('.feed-card .feed-author b')].map((b) => b.textContent));
eq(ids.length, 10, 'strict mode: the feed loaded its first page exactly once');

const relevant = errors.filter((e) => !e.includes('React DevTools'));
eq(relevant.length, 0, `no console errors or warnings${relevant.length ? ':\n' + relevant.join('\n') : ''}`);
await browser.close();
vite.kill();
console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
