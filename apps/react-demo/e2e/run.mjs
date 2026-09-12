// End-to-end check of @stacknav/react against the built demo (dist/). Run
// `pnpm build` first. Uses the preinstalled Chromium through playwright-core.
import { join } from 'node:path';
import { launch } from './harness.mjs';

const { page, base, check, eq, section, state, settled, transitioned, swipeBack, scrollTop, shots, finish } = await launch();

// A deep link from elsewhere: about:blank first, so no same-origin entry sits behind it.
const deepLink = async (path) => {
  await page.goto('about:blank');
  await page.goto(base + path);
};

// ---- 1. first load: one page, no animation ---------------------------------
section('first load');
await page.goto(base + '/');
await page.waitForSelector('[data-page=home]');
let s = await state();
eq(s.pages.join(','), 'home', 'home is the only page');
eq(s.visible.join(','), 'home', 'home visible');

// ---- 2. push from the tree: / -> /items/3 ----------------------------------
section('push from the route tree');
await page.click('text=+');
await page.click('text=+');
await page.evaluate(() => (document.querySelector('.outlet > .sn-page-visible').scrollTop = 600));
const homeScroll = await scrollTop();
check(homeScroll > 0, `scrolled the home page (${homeScroll}px)`);
let mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Item 3")'), '02-push-item');
check(mid.busy && mid.pages.length === 2, 'push animates with both pages mounted');
s = await state();
eq(s.url, '/items/3', 'url after push');
eq(s.pages.join(','), 'home,item', 'home kept beneath item');
eq(s.visible.join(','), 'item', 'only item visible');
eq(s.title, 'Item 3', 'item read its id from useParams()');

// ---- 3. deeper: /items/3/reviews, then the back button ---------------------
section('three deep, back button');
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Reviews")'), '03-push-reviews');
s = await state();
eq(s.pages.join(','), 'home,item,reviews', 'three pages kept');
eq(s.url, '/items/3/reviews', 'url after second push');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Item 3")'), '04-pop-reviews');
check(mid.busy && mid.pages.length === 3, 'pop animates before the page is destroyed');
s = await state();
eq(s.pages.join(','), 'home,item', 'reviews destroyed after pop');
eq(s.url, '/items/3', 'back button went back through history');

// ---- 4. browser back pops, with the kept home page intact ------------------
section('browser back');
mid = await transitioned(() => page.goBack(), '05-browser-back');
s = await state();
eq(s.pages.join(','), 'home', 'browser back popped to home');
eq(s.url, '/', 'url after browser back');
eq(await scrollTop(), homeScroll, 'home scroll position survived');
eq(await page.textContent('.counter b'), '2', 'home component state survived');

// ---- 5. swipe back from the leading edge -----------------------------------
section('swipe back');
await transitioned(() => page.click('.sn-page-visible a:has-text("Item 5")'), '06-push-item5');
const box = await page.locator('.outlet').boundingBox();
const y = box.y + box.height / 2;
await page.mouse.move(box.x + 6, y);
await page.mouse.down();
for (let x = 20; x <= 120; x += 20) await page.mouse.move(box.x + x, y);
await page.screenshot({ path: join(shots, '07-swipe-mid.png') });
s = await state();
eq(s.visible.join(','), 'home,item', 'both pages visible mid-swipe');
for (let x = 140; x <= 320; x += 30) await page.mouse.move(box.x + x, y);
await page.mouse.up();
await settled();
await page.waitForFunction(() => location.pathname === '/');
s = await state();
eq(s.url, '/', 'the router followed the swipe through history');
eq(s.pages.join(','), 'home', 'swiped page destroyed once the router caught up');
eq(await page.textContent('.counter b'), '2', 'home state survived the swipe');

// a short drag cancels and leaves everything as it was
await transitioned(() => page.click('.sn-page-visible a:has-text("Item 6")'), '08-push-item6');
await swipeBack({ until: 0.2 });
s = await state();
eq(s.url, '/items/6', 'a short swipe cancels: url unchanged');
eq(s.pages.join(','), 'home,item', 'a short swipe cancels: pages unchanged');
eq(s.visible.join(','), 'item', 'a short swipe cancels: item still on top');
await transitioned(() => page.goBack(), '09-back-to-home');

// ---- 6. numbered screens: settings (2) and about (3) -----------------------
section('numbered screens');
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Settings")'), '10-push-settings');
s = await state();
eq(s.pages.join(','), 'home,settings', 'settings pushed over home (level 2 > none)');
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("About")'), '11-push-about');
s = await state();
eq(s.pages.join(','), 'home,settings,about', 'about pushed over settings (3 > 2)');
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Settings")'), '12-pop-about');
s = await state();
eq(s.pages.join(','), 'home,settings', 'settings via Link popped (2 < 3, and kept beneath)');
eq(s.url, '/settings', 'url after the pop');
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Home, via Link")'), '13-pop-home');
s = await state();
eq(s.pages.join(','), 'home', 'home via Link popped: it was kept beneath');

// ---- 7. hints in the navigation state --------------------------------------
section('hints');
await page.click('.sn-page-visible button:has-text("Settings, as a replace")');
await settled();
s = await state();
eq(s.pages.join(','), 'settings', 'replace hint swapped home for settings');
eq(s.url, '/settings', 'url after the replace');
mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Home, via Link")'), '13b-pop-fresh-home');
check(mid.busy && mid.pages.join(',') === 'home,settings', 'home from a numbered page: unnumbered falls through to the tree, where / is an ancestor, so it pops onto a fresh page');
s = await state();
eq(s.pages.join(','), 'home', 'and settings is gone once the pop ends');
await page.click('.sn-page-visible button:has-text("Item 7, no animation")');
await page.waitForSelector('[data-page=item]');
s = await state();
eq(s.pages.join(','), 'home,item', 'push hint with animated: false kept home beneath');
eq(s.title, 'Item 7', 'and showed item 7');
await transitioned(() => page.goBack(), '14-back');
s = await state();
eq(s.pages.join(','), 'home', 'browser back after an unanimated push still pops');

// ---- 8. siblings: replace by Link, push by hint ----------------------------
section('siblings');
await transitioned(() => page.click('.sn-page-visible a:has-text("Item 8")'), '15-push-item8');
await page.click('.sn-page-visible a:has-text("Item 9, via Link")');
await settled();
s = await state();
eq(s.pages.join(','), 'home,item', 'a sibling via Link replaced the page');
eq(s.title, 'Item 9', 'showing item 9');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Item 10, via a state hint")'), '16-push-sibling');
s = await state();
eq(s.pages.join(','), 'home,item,item', 'a sibling with a push hint pushed');
eq(s.title, 'Item 10', 'showing item 10');
// the kept page beneath still answers for its own params
const beneath = await page.evaluate(() => [...document.querySelectorAll('.outlet > .sn-page')].at(-2).querySelector('h1').textContent);
eq(beneath, 'Item 9', 'the kept page beneath still renders its own params');

// ---- 9. deep link, then the back button's fallback --------------------------
section('deep link');
await deepLink('/items/3/reviews');
await page.waitForSelector('[data-page=reviews]');
s = await state();
eq(s.pages.join(','), 'reviews', 'deep link mounts one page, no animation');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Item 3")'), '17-pop-fresh');
check(mid.busy && mid.pages.length === 2, 'popping onto a fresh page animates');
s = await state();
eq(s.pages.join(','), 'item', 'the fresh page replaced the deep-linked one');
eq(s.url, '/items/3', 'the fallback navigated as a replace');

// ---- 10. a demo app: feed, kept likes, cross links that push ----------------
section('feed');
await page.goto(base + '/');
await page.waitForSelector('[data-page=home]');
await transitioned(() => page.click('.sn-page-visible a:has-text("Feed")'), '18-push-feed');
await page.waitForSelector('.feed-card');
await page.click('.feed-card >> nth=0 >> .feed-actions button');
const liked = await page.textContent('.feed-card >> nth=0 >> .feed-actions button');
check(liked.startsWith('♥'), 'liked the first post');
await transitioned(() => page.click('.feed-card >> nth=0 >> .feed-author'), '19-push-profile');
s = await state();
eq(s.pages.join(','), 'home,feed,feed-profile', 'the author link pushed a profile');
await page.waitForSelector('.feed-profile');
await transitioned(() => page.click('.sn-page-visible .feed-card >> nth=0 >> .feed-actions a'), '20-push-post');
s = await state();
eq(s.pages.join(','), 'home,feed,feed-profile,feed-post', 'the comments link pushed a post: four deep');
await transitioned(() => page.goBack(), '21-back');
await transitioned(() => page.goBack(), '22-back');
s = await state();
eq(s.pages.join(','), 'home,feed', 'back twice to the feed');
eq(await page.textContent('.feed-card >> nth=0 >> .feed-actions button'), liked, 'the like survived the round trip');

await finish();
