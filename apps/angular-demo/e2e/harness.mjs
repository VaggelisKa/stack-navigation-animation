// Shared setup for the e2e suites: serves dist/browser, launches a preinstalled
// browser through playwright-core, and reads the stack's DOM.
//
// `E2E_BROWSER=chromium|webkit` picks the engine (chromium by default). The
// library's whole job is to hand an animation to the browser, so what a second
// engine says about it is worth a second run: WebKit is the engine behind the
// platform the push/pop look is copied from. `CHROMIUM_PATH` still points the
// Chromium run at a local Chromium-family binary (Edge, say); WebKit has no
// such escape hatch and comes from `playwright-core install webkit`.
import { chromium, webkit } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINES = { chromium, webkit };
/** Which engine this run drives; suites guard engine-specific checks on it. */
export const browserName = process.env.E2E_BROWSER || 'chromium';
if (!ENGINES[browserName])
  throw new Error(
    `E2E_BROWSER must be one of ${Object.keys(ENGINES).join(', ')}, got ${JSON.stringify(browserName)}`,
  );

const ROOT = fileURLToPath(new URL('../dist/browser/', import.meta.url));
// One directory per engine: the two runs write the same file names.
const SHOTS = fileURLToPath(new URL(`./shots/${browserName}/`, import.meta.url));
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.map': 'application/json',
};

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

  const executablePath =
    browserName === 'chromium'
      ? process.env.CHROMIUM_PATH ||
        (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
      : undefined;
  const browser = await ENGINES[browserName].launch({ executablePath });
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
  const eq = (a, b, msg) =>
    check(a === b, `${msg} (${JSON.stringify(a)}${a === b ? '' : ' ≠ ' + JSON.stringify(b)})`);
  const section = (title) => console.log(`\n# ${title}`);
  console.log(`# engine: ${browserName} ${browser.version()}`);

  // ---- helpers that read the stack's DOM -----------------------------------
  // Both the plain read and the mid-flight one live in the page, because the
  // mid-flight one has to: a transition lasts 500ms and a single driver round
  // trip costs a tenth of that on a fast machine, more on a loaded CI runner.
  // Sampling "is it animating?" from out here is a race the page can win.
  await page.addInitScript(() => {
    const container = () => document.querySelector('.sn-container');
    globalThis.__snRead = () => {
      // The router places each page element where it likes, so the stack's own
      // order, not document order, says which page is beneath which.
      const stack = container();
      const pages = globalThis.__snStack.entries.map((e) => e.el);
      // A page animating out has already left the entries but is still mounted, on top.
      for (const el of stack.querySelectorAll(':scope > .sn-page'))
        if (!pages.includes(el)) pages.push(el);
      return {
        url: location.pathname + location.search,
        busy: stack.classList.contains('sn-busy'),
        pages: pages.map((p) => p.tagName.toLowerCase()),
        visible: pages
          .filter((p) => p.classList.contains('sn-page-visible'))
          .map((p) => p.tagName.toLowerCase()),
        title: pages.at(-1)?.querySelector('h1')?.textContent?.trim(),
      };
    };
    /**
     * Latches what the stack looks like while it is transitioning, from inside
     * the page. Keeps the second frame on which the container is busy rather
     * than the first: one frame in, the incoming page is mounted and the
     * outgoing one has not been taken down yet, which is the moment the
     * assertions are about. The first frame is the fallback for a transition
     * short enough that there is no second.
     */
    globalThis.__snWatch = () => {
      const mine = (globalThis.__snWatchGen = (globalThis.__snWatchGen ?? 0) + 1);
      const frames = [];
      const tick = () => {
        if (globalThis.__snWatchGen !== mine) return; // a newer watch took over
        if (frames.length < 2 && container()?.classList.contains('sn-busy'))
          frames.push(globalThis.__snRead());
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      globalThis.__snMid = () => (globalThis.__snWatchGen++, frames[1] ?? frames[0] ?? null);
    };
  });
  /** The app is zoneless, so a click's view update lands on the next frame. Wait one frame before reading. */
  const flush = () =>
    page.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
  const state = async () => (await flush(), page.evaluate(() => globalThis.__snRead()));
  const busy = (timeout = 2000) =>
    page
      .waitForFunction(
        () => document.querySelector('.sn-container').classList.contains('sn-busy'),
        null,
        { timeout },
      )
      .catch(() => {});
  const settled = () =>
    page.waitForFunction(
      () => !document.querySelector('.sn-container').classList.contains('sn-busy'),
    );
  /**
   * `page.emulateMedia`, but it returns only once the page itself reports the
   * new value. The override is set from the driver, and an engine is free to
   * apply it to the page a beat later: WebKit does. Both halves of the library
   * read the preference -- the stylesheet through `@media`, the engine through
   * `matchMedia` when it works out a duration -- so an action taken before the
   * page has caught up silently runs under the old preference.
   */
  const media = async (options) => {
    await page.emulateMedia(options);
    const queries = [];
    if (typeof options.reducedMotion === 'string')
      queries.push(['(prefers-reduced-motion: reduce)', options.reducedMotion === 'reduce']);
    if (typeof options.colorScheme === 'string')
      queries.push(['(prefers-color-scheme: dark)', options.colorScheme === 'dark']);
    if (queries.length)
      await page.waitForFunction(
        (qs) => qs.every(([q, want]) => matchMedia(q).matches === want),
        queries,
      );
  };
  /** Runs `act`, waits for the transition to start, captures the mid-flight state, then waits for it to end. */
  const transitioned = async (act, name, { timeout = 2000 } = {}) => {
    // Arm the in-page watch before the action, so what `mid` reports is a frame
    // the page really saw rather than whenever the driver next got a word in.
    await page.evaluate(() => globalThis.__snWatch());
    await act();
    await busy(timeout);
    if (name) await page.screenshot({ path: join(SHOTS, `${name}.png`) });
    // No frame was ever busy: nothing animated. Report the state as it is now,
    // so the caller's `mid.busy` check fails on the truth rather than on a miss.
    const mid = (await page.evaluate(() => globalThis.__snMid())) ?? (await state());
    await settled();
    return mid;
  };
  const scrollTop = () =>
    page.evaluate(() => document.querySelector('.sn-container > .sn-page-visible').scrollTop);
  const setScroll = (y) =>
    page.evaluate(
      (y) => (document.querySelector('.sn-container > .sn-page-visible').scrollTop = y),
      y,
    );
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

  return {
    page,
    base,
    browser,
    browserName,
    server,
    errors,
    check,
    eq,
    section,
    flush,
    media,
    state,
    busy,
    settled,
    transitioned,
    scrollTop,
    setScroll,
    interactivePop,
    shots: SHOTS,
    finish,
  };
}
