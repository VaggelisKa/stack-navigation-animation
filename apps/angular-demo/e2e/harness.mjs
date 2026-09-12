// Shared setup for the e2e suites: serves dist/browser, launches the
// preinstalled Chromium through playwright-core, and reads the outlet's DOM.
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('../dist/browser/', import.meta.url).pathname;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json' };

export async function launch({ width = 420, height = 800 } = {}) {
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
  const page = await browser.newPage({ viewport: { width, height } });
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
  const section = (title) => console.log(`\n# ${title}`);

  // ---- helpers that read the outlet's DOM ----------------------------------
  /** The app is zoneless, so a click's view update lands on the next frame. Wait one frame before reading. */
  const flush = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
  const state = async () =>
    (await flush(),
    page.evaluate(() => {
      const outlet = document.querySelector('sn-outlet');
      const pages = [...outlet.querySelectorAll(':scope > .sn-page')];
      return {
        url: location.pathname + location.search,
        busy: outlet.classList.contains('sn-busy'),
        pages: pages.map((p) => p.tagName.toLowerCase()),
        visible: pages.filter((p) => p.classList.contains('sn-page-visible')).map((p) => p.tagName.toLowerCase()),
        title: pages.at(-1)?.querySelector('h1')?.textContent?.trim(),
      };
    }));
  const busy = (timeout = 2000) => page.waitForFunction(() => document.querySelector('sn-outlet').classList.contains('sn-busy'), null, { timeout }).catch(() => {});
  const settled = () => page.waitForFunction(() => !document.querySelector('sn-outlet').classList.contains('sn-busy'));
  /** Runs `act`, waits for the transition to start, captures the mid-flight state, then waits for it to end. */
  const transitioned = async (act, name, { timeout = 2000 } = {}) => {
    await act();
    await busy(timeout);
    const mid = await state();
    if (name) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
    await settled();
    return mid;
  };
  const top = () => page.locator('sn-outlet > .sn-page-visible').last();
  const scrollTop = () => page.evaluate(() => document.querySelector('sn-outlet > .sn-page-visible').scrollTop);
  const setScroll = (y) => page.evaluate((y) => (document.querySelector('sn-outlet > .sn-page-visible').scrollTop = y), y);
  /**
   * The library ships no gesture recognizer: in a browser tab the browser owns
   * the edge. This drives `beginInteractivePop()` the way an app that does own
   * the edge would, through the stack the demo exposes for exactly this.
   * `until` is how far across (0–1) to drag before releasing; `mid` runs at the
   * halfway point; `complete` is what the app would decide from distance and
   * velocity on release.
   */
  const interactivePop = async ({ until = 0.8, mid, complete = true } = {}) => {
    const began = await page.evaluate(() => {
      globalThis.__snPop = globalThis.__snStack?.beginInteractivePop();
      return !!globalThis.__snPop;
    });
    if (!began) return false;
    const to = (p) => page.evaluate((v) => globalThis.__snPop.update(v), p);
    const half = until / 2;
    for (let d = 0.05; d < half; d += 0.1) await to(1 - d);
    await to(1 - half);
    if (mid) await mid();
    for (let d = half; d < until; d += 0.1) await to(1 - d);
    await to(1 - until);
    await page.evaluate((c) => globalThis.__snPop.finish({ complete: c, velocity: 0 }), complete);
    await settled();
    return true;
  };

  const finish = async () => {
    await browser.close();
    server.close();
    if (errors.length) {
      failures++;
      console.log('browser errors:\n' + errors.join('\n'));
    }
    console.log(failures ? `\n${failures} failure(s)` : '\nall checks passed');
    process.exit(failures ? 1 : 0);
  };

  return { page, base, browser, server, errors, check, eq, section, flush, state, busy, settled, transitioned, top, scrollTop, setScroll, interactivePop, shots: SHOTS, finish };
}
