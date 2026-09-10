// End-to-end check of @stacknav/angular against the built demo (dist/browser).
// Run `ng build` first. Uses the preinstalled Chromium through playwright-core.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('../dist/browser/', import.meta.url).pathname;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = join(ROOT, path);
  if (!existsSync(file) || path === '/' || !extname(path)) file = join(ROOT, 'index.html');
  res.setHeader('content-type', TYPES[extname(file)] || 'application/octet-stream');
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const executablePath = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await mkdir(SHOTS, { recursive: true });

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) failures++;
};
const eq = (a, b, msg) => check(a === b, `${msg} (${JSON.stringify(a)}${a === b ? '' : ' ≠ ' + JSON.stringify(b)})`);

// ---- helpers that read the outlet's DOM ------------------------------------
const state = () =>
  page.evaluate(() => {
    const outlet = document.querySelector('sn-outlet');
    const pages = [...outlet.querySelectorAll(':scope > .sn-page')];
    return {
      url: location.pathname,
      busy: outlet.classList.contains('sn-busy'),
      pages: pages.map((p) => p.tagName.toLowerCase()),
      visible: pages.filter((p) => p.classList.contains('sn-page-visible')).map((p) => p.tagName.toLowerCase()),
      title: pages.at(-1)?.querySelector('h1')?.textContent?.trim(),
    };
  });
const settled = () => page.waitForFunction(() => !document.querySelector('sn-outlet').classList.contains('sn-busy'));
const transitioned = async (act, name) => {
  await act();
  await page.waitForFunction(() => document.querySelector('sn-outlet').classList.contains('sn-busy'), null, { timeout: 2000 }).catch(() => {});
  const mid = await state();
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  await settled();
  return mid;
};
const scrollTop = () => page.evaluate(() => document.querySelector('sn-outlet > .sn-page-visible').scrollTop);

// ---- 1. first load: one page, no animation ---------------------------------
await page.goto(base + '/');
await page.waitForSelector('app-home');
let s = await state();
eq(s.pages.join(','), 'app-home', 'home is the only page');
eq(s.visible.join(','), 'app-home', 'home visible');

// ---- 2. push from the tree: / -> /items/3 ----------------------------------
await page.click('text=+');
await page.click('text=+');
await page.evaluate(() => (document.querySelector('sn-outlet > .sn-page-visible').scrollTop = 600));
const homeScroll = await scrollTop();
check(homeScroll > 0, `scrolled the home page (${homeScroll}px)`);
let mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Item 3")'), '02-push-item');
check(mid.busy && mid.pages.length === 2, 'push animates with both pages mounted');
s = await state();
eq(s.url, '/items/3', 'url after push');
eq(s.pages.join(','), 'app-home,app-item', 'home kept beneath item');
eq(s.visible.join(','), 'app-item', 'only item visible');
eq(s.title, 'Item 3', 'item got its id through input binding');

// ---- 3. deeper: /items/3/reviews, then the back buttons --------------------
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Reviews")'), '03-push-reviews');
s = await state();
eq(s.pages.join(','), 'app-home,app-item,app-reviews', 'three pages kept');
eq(s.url, '/items/3/reviews', 'url after second push');
// a canDeactivate guard refuses the swipe: the page must come back
await page.click('.sn-page-visible input[type=checkbox]');
const box0 = await page.locator('sn-outlet').boundingBox();
await page.mouse.move(box0.x + 6, box0.y + 300);
await page.mouse.down();
for (let x = 20; x <= 340; x += 40) await page.mouse.move(box0.x + x, box0.y + 300);
await page.mouse.up();
await settled();
await page.waitForTimeout(300);
s = await state();
eq(s.pages.join(','), 'app-home,app-item,app-reviews', 'guard refused the swipe: page restored');
eq(s.visible.join(','), 'app-reviews', 'restored page is the visible one');
eq(s.url, '/items/3/reviews', 'url unchanged after the refused swipe');
await page.click('.sn-page-visible input[type=checkbox]');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Item 3")'), '04-pop-reviews');
check(mid.busy && mid.pages.length === 3, 'pop animates before the page is destroyed');
s = await state();
eq(s.pages.join(','), 'app-home,app-item', 'reviews destroyed after pop');
eq(s.url, '/items/3', 'snBack went back through history');

// ---- 4. browser back pops, with the kept home page intact ------------------
mid = await transitioned(() => page.goBack(), '05-browser-back');
s = await state();
eq(s.pages.join(','), 'app-home', 'browser back popped to home');
eq(s.url, '/', 'url after browser back');
eq(await scrollTop(), homeScroll, 'home scroll position survived');
eq(await page.textContent('.counter b'), '2', 'home component state survived');

// ---- 5. swipe back from the leading edge -----------------------------------
await transitioned(() => page.click('.sn-page-visible a:has-text("Item 5")'), '06-push-item5');
const box = await page.locator('sn-outlet').boundingBox();
const y = box.y + box.height / 2;
await page.mouse.move(box.x + 6, y);
await page.mouse.down();
for (let x = 20; x <= 120; x += 20) await page.mouse.move(box.x + x, y);
await page.screenshot({ path: join(SHOTS, '07-swipe-mid.png') });
s = await state();
eq(s.visible.join(','), 'app-home,app-item', 'both pages visible mid-swipe');
for (let x = 140; x <= 320; x += 30) await page.mouse.move(box.x + x, y);
await page.mouse.up();
await settled();
await page.waitForFunction(() => location.pathname === '/');
s = await state();
eq(s.pages.join(','), 'app-home', 'swipe popped the page');
eq(s.url, '/', 'router followed the swipe (history back)');
eq(await page.evaluate(() => history.length), 3, 'swipe used history.back(), not a new entry');
eq(await scrollTop(), homeScroll, 'home scroll position still intact');

// ---- 6. numbered screens: settings (2) -> about (3) -> settings -> home ----
await transitioned(() => page.click('.sn-page-visible a:has-text("Settings")'), '08-push-settings');
s = await state();
eq(s.pages.join(','), 'app-home,app-settings', 'settings pushed over home');
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("About")'), '09-push-about');
s = await state();
eq(s.pages.join(','), 'app-home,app-settings,app-about', 'about (3) pushed over settings (2)');
await transitioned(() => page.click('.sn-page-visible a:has-text("Settings")'), '10-pop-about');
s = await state();
eq(s.pages.join(','), 'app-home,app-settings', 'routerLink to a kept page pops');
eq(s.url, '/settings', 'url after pop by level');
await transitioned(() => page.click('.sn-page-visible a:has-text("Home")'), '11-pop-settings');
s = await state();
eq(s.pages.join(','), 'app-home', 'routerLink home popped to the kept home');
eq(await page.textContent('.counter b'), '2', 'home state still there after all that');

// ---- 7. explicit replace, then history back onto a page that is not kept ---
await page.click('.sn-page-visible button:has-text("Settings, as a replace")');
await settled();
s = await state();
eq(s.pages.join(','), 'app-settings', 'replace swapped home for settings');
eq(s.url, '/settings', 'url after replace');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Back")'), '12-pop-fresh-home');
check(mid.busy && mid.pages.join(',') === 'app-home,app-settings', 'a fresh home is mounted beneath and settings pops over it');
s = await state();
eq(s.pages.join(','), 'app-home', 'fresh home is the page now');
eq(s.url, '/', 'url after popping to a fresh page');

// ---- 8. explicit push without animation ------------------------------------
await page.click('.sn-page-visible button:has-text("Item 7, no animation")');
await page.waitForSelector('app-item');
s = await state();
eq(s.pages.join(','), 'app-home,app-item', 'hinted push mounted item 7');
eq(s.title, 'Item 7', 'item 7 shown');

// ---- 9. siblings: routerLink replaces (tree), StackNav.push pushes (hint) --
await page.click('.sn-page-visible a:has-text("via routerLink")');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,app-item', 'sibling via routerLink replaced');
eq(s.title, 'Item 8', 'sibling replaced in place');
await transitioned(() => page.click('.sn-page-visible button:has-text("via StackNav.push")'), '13-push-sibling');
s = await state();
eq(s.pages.join(','), 'app-home,app-item,app-item', 'sibling via StackNav.push pushed');
eq(s.title, 'Item 9', 'pushed sibling shown');
await transitioned(() => page.goBack(), '14-back-sibling');
s = await state();
eq(s.title, 'Item 8', 'back returns to the kept sibling');

// ---- 10. deep link, then back with a fallback -------------------------------
await page.goto(base + '/items/5/reviews');
await page.waitForSelector('app-reviews');
s = await state();
eq(s.pages.join(','), 'app-reviews', 'deep link renders one page');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Item 5")'), '15-deeplink-back');
check(mid.busy, 'fallback pop animates');
s = await state();
eq(s.pages.join(','), 'app-item', 'fallback replaced the deep-linked page with its parent');
eq(s.url, '/items/5', 'fallback url');
eq(s.title, 'Item 5', 'fallback page got its input');

await browser.close();
server.close();
if (errors.length) {
  failures++;
  console.log('browser errors:\n' + errors.join('\n'));
}
console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
