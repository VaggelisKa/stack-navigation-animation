// End-to-end check of @stacknav/angular against the built demo (dist/browser).
// Run `ng build` first. Uses the preinstalled Chromium through playwright-core.
// This suite covers the router mechanics on the small pages; demos.mjs drives
// the demo apps.
import { join } from 'node:path';
import { launch } from './harness.mjs';

const { page, base, check, eq, section, state, settled, transitioned, swipeBack, scrollTop, shots, finish } = await launch();

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
await page.emulateMedia({ reducedMotion: 'reduce' });
const reducedDuration = await page.evaluate(() => {
  const outlet = document.querySelector('sn-outlet');
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
await page.emulateMedia({ reducedMotion: 'no-preference' });

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
// a canDeactivate guard refuses the swipe, so the page must come back
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
eq(s.url, '/items/3', 'back button went back through history');

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
await page.screenshot({ path: join(shots, '07-swipe-mid.png') });
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

// ---- 6b. a replaced page sits between home and the top in history, not in the stack
await transitioned(() => page.click('.sn-page-visible a:has-text("Settings")'), '11b-push-settings');
await page.click('.sn-page-visible button:has-text("About, as a replace")');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,app-about', 'about replaced settings above home');
const box2 = await page.locator('sn-outlet').boundingBox();
await page.mouse.move(box2.x + 6, box2.y + 300);
await page.mouse.down();
for (let x = 20; x <= 340; x += 40) await page.mouse.move(box2.x + x, box2.y + 300);
await page.mouse.up();
await settled();
await page.waitForFunction(() => location.pathname === '/');
await page.waitForTimeout(600);
s = await state();
eq(s.pages.join(','), 'app-home', 'swipe revealed home, not the replaced settings entry');
eq(s.url, '/', 'router navigated to home rather than back to /settings');
eq(await page.textContent('.counter b'), '2', 'the kept home survived');

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

// ---- 9. siblings: routerLink replaces (tree), info hint pushes --
await page.click('.sn-page-visible a:has-text("via routerLink")');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,app-item', 'sibling via routerLink replaced');
eq(s.title, 'Item 8', 'sibling replaced in place');
await transitioned(() => page.click('.sn-page-visible button:has-text("via info hint")'), '13-push-sibling');
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
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Item 5")'), '15-deeplink-back');
check(mid.busy, 'fallback pop animates');
s = await state();
eq(s.pages.join(','), 'app-item', 'fallback replaced the deep-linked page with its parent');
eq(s.url, '/items/5', 'fallback url');
eq(s.title, 'Item 5', 'fallback page got its input');
await transitioned(() => page.click('.sn-page-visible button:has-text("Back")'), '16-fallback-again');
s = await state();
eq(s.pages.join(','), 'app-home', 'Back after the fallback fell back again instead of leaving the site');
eq(s.url, '/', 'url after the second fallback');

// ---- 11. deep link, push, browser back: Back must stay in the app -----------
await deepLink('/items/5');
await page.waitForSelector('app-item');
await transitioned(() => page.click('.sn-page-visible a:has-text("Reviews")'), '17-deeplink-push');
await transitioned(() => page.goBack(), '18-deeplink-browser-back');
s = await state();
eq(s.pages.join(','), 'app-item', 'browser back returned to the deep-linked page');
await transitioned(() => page.click('.sn-page-visible button:has-text("Back")'), '19-deeplink-back');
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
  const outlet = document.querySelector('sn-outlet');
  const x = (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
  const frames = [];
  let writes = 0;
  const obs = new MutationObserver((records) => (writes += records.length));
  obs.observe(outlet, { attributeFilter: ['style'], subtree: true });

  [...outlet.querySelectorAll('.sn-page-visible a')].find((a) => a.textContent.includes('Item 3')).click();
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
      transitions: getComputedStyle(upper).transitionProperty,
      owned: upper.getAnimations().map((a) => `${a.transitionProperty}@${a.effect.getTiming().duration}`),
    });
  }
  await new Promise((r) => setTimeout(r, 700));
  obs.disconnect();
  const pages = [...outlet.querySelectorAll(':scope > .sn-page')];
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
check(f[0].owned.includes('transform@500'), `the browser owns the transform run (${f[0].owned.join() || 'none'})`);
eq(f[0].duration, '500ms', 'the container tells CSS how long the phase is');
eq(f[0].ease, 'cubic-bezier(0.32, 0.72, 0, 1)', 'and on what curve');
check(f[0].shadowed, 'the incoming page carries the shadow');
// A transition of your own may fade a page rather than move it, and the README
// offers that; the role classes have to cover opacity for the browser to run it.
check(/transform/.test(f[0].transitions) && /opacity/.test(f[0].transitions), `a moving page transitions transform and opacity (${f[0].transitions})`);
check(f[0].upper > 50 && f.at(-1).upper < f[0].upper, `the upper page slides in (${f.map((r) => Math.round(r.upper)).join(' \u2192 ')}px)`);
const parallax = Math.min(...f.map((r) => r.lower));
check(parallax < -1 && parallax > -420 * 0.31, `the lower page parallaxes by --sn-parallax (${f.map((r) => Math.round(r.lower)).join(' \u2192 ')}px)`);
const dimmed = Math.max(...f.map((r) => r.dim));
check(dimmed > 0.02 && dimmed <= 0.1, `the dim rises to --sn-dim-max (${f.map((r) => r.dim.toFixed(3)).join(' \u2192 ')})`);
check(run.writes <= 20, `a whole 500ms push costs ${run.writes} style writes`);
eq(run.rest.duration, '0s', 'nothing is animating once it is over');
eq(run.rest.roles, 0, 'the transition roles are dropped');
eq(run.rest.dims, 0, 'the dim overlay is gone');
eq(run.rest.inline, '|', 'no inline transform survives');
eq(run.rest.promoted, 0, 'no page is left promoted at rest');
eq(run.rest.top, 0, 'the resting page sits at the origin, from CSS');

// The pointer sets p directly; only the release is a run CSS owns.
const dragged = [];
const readDrag = () =>
  page.evaluate(() => {
    const outlet = document.querySelector('sn-outlet');
    const upper = outlet.querySelector('.sn-page-upper');
    return {
      duration: getComputedStyle(outlet).getPropertyValue('--sn-t').trim(),
      x: upper ? new DOMMatrixReadOnly(getComputedStyle(upper).transform).m41 : null,
    };
  });
await swipeBack({ until: 0.8, mid: async () => {
  dragged.push(await readDrag());
  const colors = await page.evaluate(() => {
    const outlet = document.querySelector('sn-outlet');
    const dim = outlet.querySelector('.sn-dim');
    const upper = outlet.querySelector('.sn-page-upper');
    const fallback = getComputedStyle(dim).backgroundColor;
    outlet.style.setProperty('--sn-dim-color', 'rgb(12, 34, 56)');
    outlet.style.setProperty('--sn-shadow', 'none');
    const result = { fallback, dim: getComputedStyle(dim).backgroundColor, shadow: getComputedStyle(upper).boxShadow };
    outlet.style.removeProperty('--sn-dim-color');
    outlet.style.removeProperty('--sn-shadow');
    return result;
  });
  eq(colors.fallback, 'rgb(0, 0, 0)', 'the dim uses the default JS colour as a CSS fallback');
  eq(colors.dim, 'rgb(12, 34, 56)', 'CSS colour changes apply during a drag without refresh');
  eq(colors.shadow, 'none', 'CSS shadow changes apply during a drag without refresh');
} });
eq(dragged[0]?.duration, '0s', 'while the pointer is down nothing animates');
check(dragged[0]?.x > 20, `the page tracks the pointer (${Math.round(dragged[0]?.x)}px)`);
s = await state();
eq(s.pages.join(','), 'app-home', 'the settle ran and the page was popped');


await finish();
