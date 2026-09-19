// End-to-end check of @stacknav/angular against the built demo (dist/browser).
// Run `ng build` first. Drives the engine `E2E_BROWSER` names (see harness.mjs).
// This suite covers the router mechanics on the small pages; demos.mjs drives
// the demo apps.
import { join } from 'node:path';
import { launch } from './harness.mjs';

const {
  page,
  base,
  check,
  eq,
  section,
  media,
  state,
  settled,
  transitioned,
  interactivePop,
  scrollTop,
  shots,
  finish,
} = await launch();

// A deep link from elsewhere: about:blank first, so no same-origin entry sits behind it.
const deepLink = async (path) => {
  await page.goto('about:blank');
  await page.goto(base + path);
};

// ---- 1. first load: one page, no animation ---------------------------------
await page.goto(base + '/');
await page.waitForSelector('app-home');
let s = await state();
eq(s.pages.join(','), 'app-home', 'home is the only page');
eq(s.visible.join(','), 'app-home', 'home visible');

// ---- 1b. reduced motion ----------------------------------------------------
// Test the browser rule against an inline duration because that is how the
// engine supplies timing. This also lets a preference change stop a run that
// JavaScript has already started.
section('reduced motion');
await media({ reducedMotion: 'reduce' });
const reducedDuration = await page.evaluate(() => {
  const outlet = document.querySelector('.sn-container');
  const current = outlet.querySelector('.sn-page-visible');
  outlet.style.setProperty('--sn-t', '10s');
  current.classList.add('sn-page-upper');
  const duration = getComputedStyle(current).transitionDuration;
  current.classList.remove('sn-page-upper');
  outlet.style.removeProperty('--sn-t');
  return duration;
});
eq(reducedDuration, '0s', 'browser preference overrides an inline transition duration');
await page.click('.sn-page-visible a:has-text("Item 3")');
await settled();
s = await state();
eq(s.title, 'Item 3', 'reduced-motion navigation still completes');
await page.goBack();
await settled();
await media({ reducedMotion: 'no-preference' });

// ---- 2. push from the tree: / -> /items/3 ----------------------------------
await page.click('text=+');
await page.click('text=+');
await page.evaluate(
  () => (document.querySelector('.sn-container > .sn-page-visible').scrollTop = 600),
);
const homeScroll = await scrollTop();
check(homeScroll > 0, `scrolled the home page (${homeScroll}px)`);
let mid = await transitioned(
  () => page.click('.sn-page-visible a:has-text("Item 3")'),
  '02-push-item',
);
check(mid.busy && mid.pages.length === 2, 'push animates with both pages mounted');
s = await state();
eq(s.url, '/items/3', 'url after push');
eq(s.pages.join(','), 'app-home,app-item', 'home kept beneath item');
eq(s.visible.join(','), 'app-item', 'only item visible');
eq(s.title, 'Item 3', 'item got its id through input binding');

// ---- 3. deeper: /items/3/reviews, then the back buttons --------------------
mid = await transitioned(
  () => page.click('.sn-page-visible a:has-text("Reviews")'),
  '03-push-reviews',
);
s = await state();
eq(s.pages.join(','), 'app-home,app-item,app-reviews', 'three pages kept');
eq(s.url, '/items/3/reviews', 'url after second push');
// a canDeactivate guard refuses the pop, so the page must come back
await page.click('.sn-page-visible input[type=checkbox]');
await interactivePop();
await page.waitForTimeout(300);
s = await state();
eq(s.pages.join(','), 'app-home,app-item,app-reviews', 'guard refused the pop: page restored');
eq(s.visible.join(','), 'app-reviews', 'restored page is the visible one');
eq(s.url, '/items/3/reviews', 'url unchanged after the refused pop');
await page.click('.sn-page-visible input[type=checkbox]');
mid = await transitioned(
  () => page.click('.sn-page-visible button:has-text("Item 3")'),
  '04-pop-reviews',
);
check(mid.busy && mid.pages.length === 3, 'pop animates before the page is destroyed');
s = await state();
eq(s.pages.join(','), 'app-home,app-item', 'reviews destroyed after pop');
eq(s.url, '/items/3', 'back button went back through history');

// ---- 4. browser back pops, with the kept home page intact ------------------
mid = await transitioned(() => page.goBack(), '05-browser-back');
s = await state();
eq(s.pages.join(','), 'app-home', 'browser back popped to home');
eq(s.url, '/', 'url after browser back');
eq(await scrollTop(), homeScroll, 'home scroll position survived');
eq(await page.textContent('.counter b'), '2', 'home component state survived');

// ---- 5. an app-driven interactive pop --------------------------------------
await transitioned(() => page.click('.sn-page-visible a:has-text("Item 5")'), '06-push-item5');
await interactivePop({
  mid: async () => {
    await page.screenshot({ path: join(shots, '07-swipe-mid.png') });
    const m = await state();
    eq(m.visible.join(','), 'app-home,app-item', 'both pages visible mid-pop');
  },
});
await page.waitForFunction(() => location.pathname === '/');
s = await state();
eq(s.pages.join(','), 'app-home', 'the pop removed the page');
eq(s.url, '/', 'router followed the pop (history back)');
eq(await page.evaluate(() => history.length), 3, 'the pop used history.back(), not a new entry');
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

// ---- 6b. a replaced page sits between home and the top in history, not in the stack
await transitioned(
  () => page.click('.sn-page-visible a:has-text("Settings")'),
  '11b-push-settings',
);
await page.click('.sn-page-visible button:has-text("About, as a replace")');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,app-about', 'about replaced settings above home');
await interactivePop();
await page.waitForFunction(() => location.pathname === '/');
await page.waitForTimeout(600);
s = await state();
eq(s.pages.join(','), 'app-home', 'the pop revealed home, not the replaced settings entry');
eq(s.url, '/', 'router navigated to home rather than back to /settings');
eq(await page.textContent('.counter b'), '2', 'the kept home survived');

// ---- 7. explicit replace, then history back onto a page that is not kept ---
await page.click('.sn-page-visible button:has-text("Settings, as a replace")');
await settled();
s = await state();
eq(s.pages.join(','), 'app-settings', 'replace swapped home for settings');
eq(s.url, '/settings', 'url after replace');
mid = await transitioned(
  () => page.click('.sn-page-visible button:has-text("Back")'),
  '12-pop-fresh-home',
);
check(
  mid.busy && mid.pages.join(',') === 'app-home,app-settings',
  'a fresh home is mounted beneath and settings pops over it',
);
s = await state();
eq(s.pages.join(','), 'app-home', 'fresh home is the page now');
eq(s.url, '/', 'url after popping to a fresh page');

// ---- 8. explicit push without animation ------------------------------------
await page.click('.sn-page-visible button:has-text("Item 7, no animation")');
await page.waitForSelector('app-item');
s = await state();
eq(s.pages.join(','), 'app-home,app-item', 'hinted push mounted item 7');
eq(s.title, 'Item 7', 'item 7 shown');

// ---- 9. siblings: routerLink replaces (tree), info hint pushes --
await page.click('.sn-page-visible a:has-text("via routerLink")');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,app-item', 'sibling via routerLink replaced');
eq(s.title, 'Item 8', 'sibling replaced in place');
await transitioned(
  () => page.click('.sn-page-visible button:has-text("via info hint")'),
  '13-push-sibling',
);
s = await state();
eq(s.pages.join(','), 'app-home,app-item,app-item', 'sibling via info hint pushed');
eq(s.title, 'Item 9', 'pushed sibling shown');
await transitioned(() => page.goBack(), '14-back-sibling');
s = await state();
eq(s.title, 'Item 8', 'back returns to the kept sibling');

// ---- 10. deep link, then back with a fallback -------------------------------
await deepLink('/items/5/reviews');
await page.waitForSelector('app-reviews');
s = await state();
eq(s.pages.join(','), 'app-reviews', 'deep link renders one page');
mid = await transitioned(
  () => page.click('.sn-page-visible button:has-text("Item 5")'),
  '15-deeplink-back',
);
check(mid.busy, 'fallback pop animates');
s = await state();
eq(s.pages.join(','), 'app-item', 'fallback replaced the deep-linked page with its parent');
eq(s.url, '/items/5', 'fallback url');
eq(s.title, 'Item 5', 'fallback page got its input');
await transitioned(
  () => page.click('.sn-page-visible button:has-text("Back")'),
  '16-fallback-again',
);
s = await state();
eq(
  s.pages.join(','),
  'app-home',
  'Back after the fallback fell back again instead of leaving the site',
);
eq(s.url, '/', 'url after the second fallback');

// ---- 11. deep link, push, browser back: Back must stay in the app -----------
await deepLink('/items/5');
await page.waitForSelector('app-item');
await transitioned(() => page.click('.sn-page-visible a:has-text("Reviews")'), '17-deeplink-push');
await transitioned(() => page.goBack(), '18-deeplink-browser-back');
s = await state();
eq(s.pages.join(','), 'app-item', 'browser back returned to the deep-linked page');
await transitioned(
  () => page.click('.sn-page-visible button:has-text("Back")'),
  '19-deeplink-back',
);
s = await state();
eq(s.pages.join(','), 'app-home', 'Back with no entry behind fell back to home');
eq(s.url, '/', 'url after falling back');

// ---- 12. the browser, not JavaScript, is running the transition -------------
// Only a real engine can show this, so it is checked here rather than in the
// core's unit tests: the pages move on a CSS transition the browser owns, the
// numbers behind the look reach it from the stylesheet, and a whole push costs
// a handful of style writes instead of one per page per frame.
section('CSS runs the animation');
await page.goto(base + '/');
await page.waitForSelector('app-home');
const run = await page.evaluate(async () => {
  const outlet = document.querySelector('.sn-container');
  const x = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
  const frames = [];
  let writes = 0;
  const obs = new MutationObserver((records) => (writes += records.length));
  obs.observe(outlet, { attributeFilter: ['style'], subtree: true });

  [...outlet.querySelectorAll('.sn-page-visible a')]
    .find((a) => a.textContent.includes('Item 3'))
    .click();
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    await new Promise((r) => setTimeout(r, 45));
    const upper = outlet.querySelector('.sn-page-upper');
    const lower = outlet.querySelector('.sn-page-lower');
    const dim = outlet.querySelector('.sn-dim');
    if (!upper || !lower || !dim) continue;
    frames.push({
      duration: getComputedStyle(outlet).getPropertyValue('--sn-t').trim(),
      ease: getComputedStyle(outlet).getPropertyValue('--sn-e').trim(),
      upper: x(upper),
      lower: x(lower),
      dim: +getComputedStyle(dim).opacity,
      shadowed: getComputedStyle(upper).boxShadow !== 'none',
      // The router inserted the incoming page at the outlet's anchor, before the
      // kept page in the DOM; only z-index puts it on top.
      lowerFollows: !!(upper.compareDocumentPosition(lower) & Node.DOCUMENT_POSITION_FOLLOWING),
      zIndex: getComputedStyle(upper).zIndex,
      isolated: getComputedStyle(outlet).isolation,
      transitions: getComputedStyle(upper).transitionProperty,
      owned: upper
        .getAnimations()
        .map((a) => `${a.transitionProperty}@${a.effect.getTiming().duration}`),
    });
  }
  await new Promise((r) => setTimeout(r, 700));
  obs.disconnect();
  const pages = globalThis.__snStack.entries.map((e) => e.el);
  return {
    frames,
    writes,
    rest: {
      duration: getComputedStyle(outlet).getPropertyValue('--sn-t').trim(),
      roles: outlet.querySelectorAll('.sn-page-upper, .sn-page-lower').length,
      dims: outlet.querySelectorAll('.sn-dim').length,
      inline: pages.map((p) => p.style.transform).join('|'),
      promoted: pages.filter((p) => getComputedStyle(p).willChange !== 'auto').length,
      top: x(pages.at(-1)),
    },
  };
});
const f = run.frames;
check(f.length >= 3, `sampled the push mid-flight (${f.length} frames)`);
check(
  f[0].owned.includes('transform@500'),
  `the browser owns the transform run (${f[0].owned.join() || 'none'})`,
);
eq(f[0].duration, '500ms', 'the container tells CSS how long the phase is');
eq(f[0].ease, 'cubic-bezier(0.32, 0.72, 0, 1)', 'and on what curve');
check(f[0].shadowed, 'the incoming page carries the shadow');
check(f[0].lowerFollows, 'the router put the incoming page before the kept one in the DOM');
eq(f[0].zIndex, '1', 'so z-index, not document order, puts it on top');
eq(f[0].isolated, 'isolate', "inside the container's own stacking context");
// A transition of your own may fade a page rather than move it, and the README
// offers that; the role classes have to cover opacity for the browser to run it.
check(
  /transform/.test(f[0].transitions) && /opacity/.test(f[0].transitions),
  `a moving page transitions transform and opacity (${f[0].transitions})`,
);
check(
  f[0].upper > 50 && f.at(-1).upper < f[0].upper,
  `the upper page slides in (${f.map((r) => Math.round(r.upper)).join(' \u2192 ')}px)`,
);
const parallax = Math.min(...f.map((r) => r.lower));
check(
  parallax < -1 && parallax > -420 * 0.31,
  `the lower page parallaxes by --sn-parallax (${f.map((r) => Math.round(r.lower)).join(' \u2192 ')}px)`,
);
const dimmed = Math.max(...f.map((r) => r.dim));
check(
  dimmed > 0.02 && dimmed <= 0.1,
  `the dim rises to --sn-dim-max (${f.map((r) => r.dim.toFixed(3)).join(' \u2192 ')})`,
);
check(run.writes <= 20, `a whole 500ms push costs ${run.writes} style writes`);
eq(run.rest.duration, '0s', 'nothing is animating once it is over');
eq(run.rest.roles, 0, 'the transition roles are dropped');
eq(run.rest.dims, 0, 'the dim overlay is gone');
eq(run.rest.inline, '|', 'no inline transform survives');
eq(run.rest.promoted, 0, 'no page is left promoted at rest');
eq(run.rest.top, 0, 'the resting page sits at the origin, from CSS');

// The app sets p directly; only the release is a run CSS owns.
const dragged = [];
const readDrag = () =>
  page.evaluate(() => {
    const outlet = document.querySelector('.sn-container');
    const upper = outlet.querySelector('.sn-page-upper');
    return {
      duration: getComputedStyle(outlet).getPropertyValue('--sn-t').trim(),
      x: upper ? new DOMMatrixReadOnly(getComputedStyle(upper).transform).m41 : null,
    };
  });
await interactivePop({
  until: 0.8,
  mid: async () => {
    dragged.push(await readDrag());
    const colors = await page.evaluate(() => {
      const outlet = document.querySelector('.sn-container');
      const dim = outlet.querySelector('.sn-dim');
      const upper = outlet.querySelector('.sn-page-upper');
      const fallback = getComputedStyle(dim).backgroundColor;
      outlet.style.setProperty('--sn-dim-color', 'rgb(12, 34, 56)');
      outlet.style.setProperty('--sn-shadow', 'none');
      const result = {
        fallback,
        dim: getComputedStyle(dim).backgroundColor,
        shadow: getComputedStyle(upper).boxShadow,
      };
      outlet.style.removeProperty('--sn-dim-color');
      outlet.style.removeProperty('--sn-shadow');
      return result;
    });
    eq(colors.fallback, 'rgb(0, 0, 0)', 'the dim uses the default JS colour as a CSS fallback');
    eq(colors.dim, 'rgb(12, 34, 56)', 'CSS colour changes apply mid-pop without refresh');
    eq(colors.shadow, 'none', 'CSS shadow changes apply mid-pop without refresh');
  },
});
eq(dragged[0]?.duration, '0s', 'while the app is setting p nothing animates');
check(dragged[0]?.x > 20, `the page follows p (${Math.round(dragged[0]?.x)}px)`);
s = await state();
eq(s.pages.join(','), 'app-home', 'the settle ran and the page was popped');

section('live swipe-back modes in the Lab');
await deepLink('/');
await transitioned(() => page.locator('a[href="/lab"]').click());
const mode = (value) => page.locator(`lab-home input[name="swipe-back"][value="${value}"]`);
const policy = () =>
  page.evaluate(() => ({
    strip: document.querySelectorAll('.sn-container > .sn-edge').length,
    touch: getComputedStyle(document.querySelector('lab-home')).touchAction,
    // `.overscrollBehaviorX` is `undefined` on an engine without the property;
    // read it by name so an unsupported engine reports '' rather than undefined.
    overscroll: getComputedStyle(document.documentElement).getPropertyValue(
      'overscroll-behavior-x',
    ),
    mode: globalThis.__snStack.swipeBack,
    historyLength: history.length,
    url: location.pathname,
  }));
// WebKit (Safari 26) ships no `overscroll-behavior` at all, so `disabled` mode
// has nothing to set there: `setProperty` on the root is a no-op and the
// browser keeps its gesture. That is the library's documented "best effort", so
// the viewport-policy assertions only run on an engine that has the property;
// the mode itself, and everything suppression must not break, is checked on both.
const suppressible = await page.evaluate(() => CSS.supports('overscroll-behavior-x', 'contain'));
const relaxed = suppressible ? 'auto' : '';
const policyCheck = (actual, expected, msg) =>
  suppressible
    ? eq(actual, expected, msg)
    : console.log(`skip ${msg} (no overscroll-behavior in this engine)`);
const initial = await policy();
eq(initial.strip, 0, 'the library ships no edge strip');
eq(initial.touch, 'auto', 'no mode claims the page’s touch handling');
eq(initial.mode, 'browser', 'the stack starts in browser mode');
policyCheck(initial.overscroll, relaxed, 'browser mode leaves the document alone');
// The mode custom code used to ask for is gone from the API, not just the UI.
eq(
  await page.evaluate(() => {
    try {
      globalThis.__snStack.setSwipeBack('custom');
      return 'accepted';
    } catch (e) {
      return e.name;
    }
  }),
  'TypeError',
  'custom is no longer a mode',
);
policyCheck((await policy()).overscroll, relaxed, 'a refused mode leaves the policy as it was');
await mode('disabled').check();
await page.waitForFunction(() => globalThis.__snStack.swipeBack === 'disabled');
policyCheck(
  (await policy()).overscroll,
  'contain',
  'disabled mode suppresses the viewport gesture',
);
eq(
  (await policy()).historyLength,
  initial.historyLength,
  'switching modes does not rewrite history',
);
await page.screenshot({ path: join(shots, 'swipe-back-modes.png'), fullPage: true });
// Suppressing the browser gesture must not touch any other way back.
await transitioned(() =>
  page.locator('lab-home a').filter({ hasText: 'Try the selected mode' }).click(),
);
await transitioned(() => page.locator('lab-deep button.back').click());
eq((await state()).url, '/lab', 'Back button works with browser gestures suppressed');
await transitioned(() => page.goBack());
eq((await state()).url, '/', 'browser history Back works with browser gestures suppressed');
await transitioned(() => page.goForward());
eq((await state()).url, '/lab', 'browser history Forward still works');
// An app that owns the edge can still drive a pop, whatever the policy says.
await transitioned(() =>
  page.locator('lab-home a').filter({ hasText: 'Try the selected mode' }).click(),
);
await interactivePop();
eq((await state()).url, '/lab', 'an app-driven interactive pop works in disabled mode');
await mode('disabled').focus();
await page.keyboard.press('ArrowUp');
await page.waitForFunction(() => document.querySelector('lab-home input[value="browser"]').checked);
await page.waitForFunction(() => globalThis.__snStack.swipeBack === 'browser');
eq((await policy()).mode, 'browser', 'keyboard selection reaches the stack');
policyCheck(
  (await policy()).overscroll,
  relaxed,
  'keyboard selection releases viewport suppression',
);

// ---- 13. a pop must still move, whoever asked for it -----------------------
// The pop is the half of the animation an app sees most, and popstate is how
// most backs arrive: the browser's own button, and an app's own button calling
// `location.back()`. Both have to move pixels. It is checked on a browser
// spoofed as iOS, because that is where a rule meant for Safari's edge swipe --
// which draws a snapshot of its own, and reaches the page as the same event as
// every other back -- once turned every pop into an instant cut. What follows
// asserts the motion rather than the state on purpose: a stack that jumps
// straight to the end still mounts, unmounts and settles exactly like one that
// animates, so nothing above this line can tell them apart. The spoof comes
// last in the file: `navigator.platform` is what the engine reads, an init
// script is the only reliable way to change it, and it stays for the rest of
// the run.
section("a pop moves, on the browser back and the app's own");
await page.addInitScript(() =>
  Object.defineProperty(navigator, 'platform', { get: () => 'iPhone' }),
);
await deepLink('/');
await page.waitForSelector('app-home');

/**
 * Runs `act` and reports how far the page on top travelled, and on what
 * timing. The sampler decides for itself when it is finished -- it runs until
 * it has seen the container go busy and come back -- because the driver cannot:
 * asking from out here whether the stack has settled can arrive before the
 * transition has even begun, and on WebKit it does.
 */
const motion = async (act) => {
  await page.evaluate(() => {
    const outlet = document.querySelector('.sn-container');
    const m = (globalThis.__snMotion = { durations: [], xs: [], started: false, done: false });
    const deadline = performance.now() + 4000;
    const tick = () => {
      const busy = outlet.classList.contains('sn-busy');
      const upper = outlet.querySelector('.sn-page-upper');
      if (upper) {
        m.durations.push(getComputedStyle(outlet).getPropertyValue('--sn-t').trim());
        m.xs.push(new DOMMatrixReadOnly(getComputedStyle(upper).transform).m41);
      }
      m.started ||= busy;
      if ((m.started && !busy) || performance.now() > deadline) return void (m.done = true);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await act();
  await page.waitForFunction(() => globalThis.__snMotion.done);
  return page.evaluate(() => {
    const m = globalThis.__snMotion;
    return {
      frames: m.xs.length,
      travel: m.xs.length ? Math.round(Math.max(...m.xs) - Math.min(...m.xs)) : 0,
      durations: [...new Set(m.durations)],
    };
  });
};

for (const [label, act] of [
  ["the browser's own back", () => page.goBack()],
  [
    'an in-app back button calling location.back()',
    () => page.click('.sn-page-visible button:has-text("Back")'),
  ],
]) {
  await transitioned(() => page.click('.sn-page-visible a:has-text("Item 3")'), null);
  eq((await state()).url, '/items/3', 'pushed a page for the pop to take back off');
  const m = await motion(act);
  eq((await state()).url, '/', `${label} popped back to home`);
  check(m.travel > 100, `${label} slid the page out (${m.travel}px across ${m.frames} frames)`);
  check(
    m.durations.some((d) => d && d !== '0s'),
    `and handed CSS a duration to run it with (${m.durations.join(' ') || 'the pop was never seen'})`,
  );
}

// ---- a back the browser animated itself -------------------------------------
// The real path, in a real browser: a genuine `popstate` from a genuine
// history traversal, carrying the word only a back gesture says for itself.
// The gesture cannot be performed under automation, so the property it would
// set is defined on the prototype for the length of this check.
section('a back the browser animated itself');
await page.evaluate(() =>
  Object.defineProperty(PopStateEvent.prototype, 'hasUAVisualTransition', {
    configurable: true,
    get: () => true,
  }),
);
await transitioned(() => page.click('.sn-page-visible a:has-text("Item 3")'), null);
eq((await state()).url, '/items/3', 'pushed a page for the browser to take back');
let m = await motion(() => page.goBack());
eq((await state()).url, '/', 'the back still popped the stack');
check(m.travel < 5, `and nothing slid on top of it (${m.travel}px across ${m.frames} frames)`);
await page.evaluate(() => delete PopStateEvent.prototype.hasUAVisualTransition);

// And with the word taken away again, the same back animates as it always did.
await transitioned(() => page.click('.sn-page-visible a:has-text("Item 3")'), null);
m = await motion(() => page.goBack());
eq((await state()).url, '/', 'the back popped the stack again');
check(m.travel > 100, `and slid the page out (${m.travel}px across ${m.frames} frames)`);

await finish();
