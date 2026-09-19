// End-to-end check of `scroll: 'document'` against the built demo: a stack the
// document scrolls, under a shell header that collapses on `window.scrollY`.
// What is checked is timing, not the final state: the header has to be in the
// destination's state on every frame of the slide, or it catches up afterwards
// and reads as a second animation. Hence the per-frame sampling from inside
// the page.
import { join } from 'node:path';
import { launch } from './harness.mjs';

const {
  page,
  base,
  check,
  eq,
  section,
  state,
  media,
  busy,
  settled,
  interactivePop,
  shots,
  finish,
} = await launch();

await page.goto(base + '/?shell=document');
await page.waitForSelector('.doc-stack > doc-home');

// ---- in-page probes ---------------------------------------------------------
await page.evaluate(() => {
  const container = () => document.querySelector('.sn-container');
  const header = () => document.querySelector('.doc-header');
  /** Where the upper page is, in px along the slide, or null outside a transition. */
  const upperX = () => {
    const upper = container().querySelector('.sn-page-upper');
    return upper ? new DOMMatrixReadOnly(getComputedStyle(upper).transform).m41 : null;
  };
  globalThis.__docSample = () => ({
    scrollY: window.scrollY,
    collapsed: header().classList.contains('collapsed'),
    upperX: upperX(),
    // A row of the home page: where it is on screen says whether the page
    // beneath moved when the offset switched.
    markerTop: document.querySelector('#doc-marker')?.getBoundingClientRect().top ?? null,
  });
  /** Samples every frame the stack is busy, from the first to the last. */
  globalThis.__docWatch = () => {
    const frames = [];
    let seen = false;
    const tick = () => {
      const running = container().classList.contains('sn-busy');
      if (running) {
        seen = true;
        frames.push(globalThis.__docSample());
      }
      if ((seen && !running) || frames.length > 240) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    globalThis.__docFrames = () => frames;
  };
});
const sample = () => page.evaluate(() => globalThis.__docSample());
/**
 * Clicks a row of the visible page from inside it: `page.click` would scroll
 * its target into view first, moving the very offset these checks are about.
 */
const tap = (text) =>
  page.evaluate((text) => {
    const row = [...document.querySelectorAll('.sn-page-visible a')].find(
      (a) => a.querySelector('span')?.textContent.trim() === text,
    );
    if (!row) throw new Error(`no row ${JSON.stringify(text)}`);
    row.click();
  }, text);
const scrollDocument = async (y) => {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  // The shell paints its header on the scroll event, which fires on the next frame.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
};
/** Runs `act` and returns the per-frame samples of the transition it started. */
const watched = async (act, name) => {
  await page.evaluate(() => globalThis.__docWatch());
  await act();
  await busy();
  if (name) await page.screenshot({ path: join(shots, `${name}.png`) });
  await settled();
  return page.evaluate(() => globalThis.__docFrames());
};
const every = (frames, fn, msg) =>
  check(frames.length >= 2 && frames.every(fn), `${msg} (${frames.length} frames)`);
const layout = () =>
  page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: innerHeight,
    frame: document.querySelector('.sn-container').style.height,
    position: getComputedStyle(document.querySelector('.sn-container > .sn-page-visible')).position,
    overflow: getComputedStyle(document.querySelector('.sn-container')).overflowY,
    tops: [...document.querySelectorAll('.sn-container > .sn-page')].map((p) => p.style.top),
  }));

// ---- 1. at rest: the document scrolls the page ------------------------------
section('at rest');
let l = await layout();
check(l.scrollHeight > l.innerHeight, `the list makes the document scroll (${l.scrollHeight}px)`);
eq(l.position, 'relative', 'the top page is in the flow');
eq(l.overflow, 'visible', 'the container is not a scroll container');
eq(
  await page.evaluate(() => history.scrollRestoration),
  'manual',
  'the stack owns scroll restoration',
);
await scrollDocument(320);
let s = await sample();
eq(s.scrollY, 320, 'scrolled the document');
eq(s.collapsed, true, 'the shell header collapsed on its own scroll listener');
const markerAtRest = s.markerTop;

// ---- 2. push a short page: the header expands before the slide, not after ---
section('push');
let frames = await watched(() => tap('Item 3'), 'doc-push');
every(frames, (f) => f.scrollY === 0, "document at the new page's offset on every frame");
every(frames, (f) => !f.collapsed, 'header expanded on every frame');
check(
  Math.abs(frames[0].markerTop - markerAtRest) < 1,
  `the page beneath stayed put as the document switched (${frames[0].markerTop} vs ${markerAtRest})`,
);
const xs = frames.map((f) => f.upperX).filter((x) => x !== null);
check(
  xs.length >= 2 && xs[0] > 50 && xs.at(-1) < xs[0],
  `the new page slid in (${xs[0]?.toFixed(0)}px → ${xs.at(-1)?.toFixed(0)}px)`,
);
s = await sample();
eq(s.scrollY, 0, 'document at the top after the push');
l = await layout();
eq(l.frame, '', 'the frame is released once at rest');
eq(l.position, 'relative', 'the new page is in the flow');
eq(
  l.scrollHeight,
  l.innerHeight,
  'a short page: the list kept beneath adds nothing to the document height',
);
eq(l.tops.join(','), ',', 'no page is held offset at rest');
let st = await state();
eq(st.pages.join(','), 'doc-home,doc-item', 'home kept beneath the item');

// ---- 3. pop: back at 320px, header collapsed, from the first frame -----------
section('pop');
frames = await watched(() => page.click('.doc-header button:has-text("Back")'), 'doc-pop');
every(frames, (f) => f.scrollY === 320, "document back at the list's offset on every frame");
every(frames, (f) => f.collapsed, 'header collapsed on every frame');
check(
  Math.abs(frames[0].markerTop - markerAtRest) < 1,
  `the list is where it was left from the first frame (${frames[0].markerTop})`,
);
const popXs = frames.map((f) => f.upperX).filter((x) => x !== null);
check(
  popXs.length >= 2 && popXs.at(-1) > popXs[0] + 50,
  `the item slid out (${popXs[0]?.toFixed(0)}px → ${popXs.at(-1)?.toFixed(0)}px)`,
);
s = await sample();
eq(s.scrollY, 320, "document at the list's offset after the pop");
eq(await page.textContent('#doc-marker b'), '0', 'the list component is the kept one');
st = await state();
eq(st.pages.join(','), 'doc-home', 'item destroyed after the pop');

// ---- 4. browser back: no jump from the browser's own restoration ----------
section('browser back');
await watched(() => tap('Item 3'));
eq((await sample()).scrollY, 0, 'pushed again');
frames = await watched(() => page.goBack(), 'doc-browser-back');
every(
  frames,
  (f) => f.scrollY === 320 && f.collapsed,
  'history pop lands at 320px collapsed on every frame',
);
eq((await sample()).scrollY, 320, 'and stays there');

// ---- 5. interactive pop, long page beneath: cancel then complete ----------
section('interactive pop');
await watched(() => tap('Item 30'));
l = await layout();
check(l.scrollHeight > l.innerHeight, 'item 30 is long enough to scroll');
await scrollDocument(500);
eq((await sample()).scrollY, 500, 'scrolled the item');
let mid = null;
// The cancelled swipe is driven from here rather than through the harness:
// what it is about is the settle after `finish`, and the samples have to start
// before that settle does.
let began = await page.evaluate(() => {
  globalThis.__snPop = globalThis.__snStack?.beginInteractivePop();
  return !!globalThis.__snPop;
});
check(began, 'the stack accepted an interactive pop');
const drag = (p) => page.evaluate((v) => globalThis.__snPop.update(v), p);
for (let d = 0.05; d < 0.3; d += 0.1) await drag(1 - d);
mid = await sample();
await page.screenshot({ path: join(shots, 'doc-swipe-mid.png') });
for (let d = 0.3; d < 0.6; d += 0.1) await drag(1 - d);
await drag(0.4);
eq(mid?.scrollY, 320, "mid-drag: the document is at the list's offset");
eq(mid?.collapsed, true, "mid-drag: the header shows the list's state");
// The item is back on top, so the document has to be at its offset on every
// frame of the settle, which it can only be if the frame is still tall enough
// to reach that offset.
const settleFrames = await page.evaluate(async () => {
  const container = document.querySelector('.sn-container');
  const frames = [];
  const tick = () => {
    if (!container.classList.contains('sn-busy')) return;
    frames.push(globalThis.__docSample());
    requestAnimationFrame(tick);
  };
  const done = globalThis.__snPop.finish({ complete: false, velocity: 0 });
  requestAnimationFrame(tick);
  await done;
  return frames;
});
await settled();
check(
  settleFrames.length >= 2 && settleFrames.every((f) => f.scrollY === 500),
  `let go: the document is at the item's offset on every frame of the settle (${settleFrames.length} frames at ${[...new Set(settleFrames.map((f) => f.scrollY))].join(', ')})`,
);
every(settleFrames, (f) => f.collapsed, 'let go: header collapsed on every frame of the settle');
s = await sample();
eq(s.scrollY, 500, "let go: back at the item's offset");
eq((await state()).pages.join(','), 'doc-home,doc-item', 'let go: the item stays');
l = await layout();
eq(l.frame, '', 'let go: the frame is released');
eq(l.tops.join(','), ',', 'let go: nothing held offset');
began = await interactivePop({ until: 0.7, complete: true });
check(began, 'a second interactive pop');
eq((await sample()).scrollY, 320, "completed: back at the list's offset");
eq((await state()).pages.join(','), 'doc-home', 'completed: item gone');

// ---- 6. reduced motion: same offsets, no slide -----------------------------
section('reduced motion');
await media({ reducedMotion: 'reduce' });
await tap('Item 5');
await settled();
eq((await sample()).scrollY, 0, 'reduced motion: pushed page at the top');
await page.click('.doc-header button:has-text("Back")');
await settled();
eq((await sample()).scrollY, 320, 'reduced motion: list back at its offset');
await media({ reducedMotion: 'no-preference' });

// ---- 7. a narrow viewport ---------------------------------------------------
section('narrow viewport');
await page.setViewportSize({ width: 360, height: 640 });
await scrollDocument(200);
frames = await watched(() => tap('Item 4'), 'doc-narrow-push');
every(
  frames,
  (f) => f.scrollY === 0 && !f.collapsed,
  'narrow push: destination state on every frame',
);
frames = await watched(() => page.click('.doc-header button:has-text("Back")'));
every(frames, (f) => f.scrollY === 200, 'narrow pop: back at 200px on every frame');

await finish();
