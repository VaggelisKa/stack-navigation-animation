// Drives the demo apps (feed, gallery, mail, notes, lab) through the outlet:
// pushes and pops across different layouts, content arriving before, during and
// after a transition, resolvers, replaced pages, and an interactive pop on all
// of them.
// Run `ng build` first.
import { fileURLToPath } from 'node:url';
import { launch } from './harness.mjs';

const {
  page,
  base,
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
  finish,
} = await launch();
const count = async (sel) => (await flush(), page.locator(sel).count());
const waitCount = (sel, n) =>
  page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n, [sel, n], {
    timeout: 8000,
  });
const text = async (sel) => (
  await flush(),
  page
    .locator(sel)
    .first()
    .textContent()
    .then((t) => t?.trim())
);
const openDemo = (name) =>
  transitioned(
    () => page.click(`.sn-page-visible a.item:has-text("${name}")`),
    `demo-${name.toLowerCase()}`,
  );
let s, mid;

// ============================================================ feed
section('feed: skeletons, load more, cross-links that always push');
await page.goto(base + '/');
await page.waitForSelector('app-home');
mid = await openDemo('Feed');
check(
  mid.busy && mid.pages.join(',') === 'app-home,feed-home',
  'lazy chunk loaded, then the push animated',
);
s = await state();
check(
  (await count('.sn-page-visible demo-skeleton')) > 0,
  'the list is still loading when the push lands (skeletons)',
);
await waitCount('feed-card', 10);
eq(await count('.sn-page-visible demo-skeleton'), 0, 'skeletons gone once the posts arrived');
await page.click('.sn-page-visible .feed-more button');
await waitCount('feed-card', 20);
eq(await count('feed-card'), 20, 'load more appended a second page');
await setScroll(800);
const feedScroll = await scrollTop();
check(feedScroll > 0, `scrolled the feed (${feedScroll}px)`);
// the first card whose author row is in view, so the click does not scroll the list
const nth = await page.evaluate(() => {
  const outlet = document.querySelector('.sn-container').getBoundingClientRect();
  return [...document.querySelectorAll('.sn-page-visible feed-card .feed-author')].findIndex(
    (a) => a.getBoundingClientRect().top > outlet.top + 60,
  );
});
const author = await page
  .locator('.sn-page-visible feed-card')
  .nth(nth)
  .locator('.feed-author b')
  .textContent();
mid = await transitioned(
  () => page.locator('.sn-page-visible feed-card').nth(nth).locator('.feed-author').click(),
  'feed-profile',
);
check(mid.busy && mid.pages.length === 3, 'profile pushed over the feed');
s = await state();
eq(s.pages.join(','), 'app-home,feed-home,feed-profile', 'feed kept beneath the profile');
await page.waitForSelector('.sn-page-visible .feed-profile');
eq(await text('.sn-page-visible .feed-profile h2'), author, 'profile loaded the tapped author');
await page.click('.sn-page-visible button[role=tab]:has-text("Media")');
await waitCount('.sn-page-visible feed-card', 1);
mid = await transitioned(
  () => page.locator('.sn-page-visible feed-card a[href^="/feed/post/"]').first().click(),
  'feed-post',
);
s = await state();
eq(
  s.pages.join(','),
  'app-home,feed-home,feed-profile,feed-post',
  'post pushed over the profile although the tree calls them siblings ([pushTo])',
);
await page.waitForSelector('.sn-page-visible .feed-comment');
check((await count('.sn-page-visible .feed-comment')) >= 2, 'comments arrived after the post');
await page.click('.sn-page-visible .feed-actions button');
check((await text('.sn-page-visible .feed-actions button')).startsWith('♥'), 'liked the post');
await page.fill('.sn-page-visible .feed-reply input', 'Nice one');
// Enter submits the form through its default button, and a disabled one is not
// submitted at all -- WebKit holds to that. The button is disabled until the
// draft is in, and this app is zoneless, so the enabling is a render away: type
// and press in the same breath, as only a driver can, and the keystroke lands
// in the gap. A person cannot type that fast; waiting for the button is what
// makes this the same press they would make.
await page.waitForSelector('.sn-page-visible .feed-reply button:not([disabled])');
await page.press('.sn-page-visible .feed-reply input', 'Enter');
await waitCount('.sn-page-visible .feed-comment.mine', 1);
eq(await count('.sn-page-visible .feed-comment.mine'), 1, 'reply added locally');
await transitioned(() => page.goBack(), 'feed-back-1');
await transitioned(() => page.goBack(), 'feed-back-2');
s = await state();
eq(s.pages.join(','), 'app-home,feed-home', 'two browser backs popped to the feed');
eq(await scrollTop(), feedScroll, 'feed scroll position survived');
eq(await count('feed-card'), 20, 'the loaded pages are still there, nothing refetched');
await transitioned(() => page.click('.sn-page-visible .back'), 'feed-home');
eq((await state()).pages.join(','), 'app-home', 'back to the demos');

// ============================================================ deep links
section('unknown ids on deep links');
// they must reach the error state, not crash the page or hang the request
for (const url of ['/feed/post/999', '/gallery/0', '/notes/999']) {
  await page.goto(base + url);
  await page.waitForSelector('.err', { timeout: 5000 });
}
check(true, 'unknown ids on deep links render an error box instead of throwing');
// the loop above left the browser on the last deep link, so go home before clicking one of its links
await page.goto(base + '/');
await page.waitForSelector('app-home');

// ============================================================ lab + gallery
section(
  'gallery in slow motion: dark page, data arriving mid-transition, sibling replace, filmstrip, interactive pop',
);
// A deep link renders that page alone, so come back to the demos list first.
await page.goto(base + '/');
await page.waitForSelector('app-home');
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Slow motion")');
await transitioned(() => page.goBack(), 'lab-back');
const t0 = Date.now();
mid = await openDemo('Gallery');
const elapsed = Date.now() - t0;
check(elapsed > 1500, `slow motion reached the outlet's transition (${elapsed}ms)`);
await waitCount('.gal-tile:not(.skel-tile)', 30);
mid = await transitioned(
  () =>
    page.click(
      '.sn-page-visible .gal-tile[aria-label="Low tide 5"], .sn-page-visible .gal-tile >> nth=4',
    ),
  'gallery-photo-mid',
);
check(mid.busy && mid.visible.length === 2, 'both pages visible mid-flight');
s = await state();
eq(s.pages.join(','), 'app-home,gallery-grid,gallery-photo', 'photo over the grid');
check(s.title !== 'Photo', `the photo arrived during the 2 s transition (${s.title})`);
await page.waitForSelector('.sn-page-visible .gal-exif');
check(true, 'deferred block rendered');
const before = (await state()).pages.length;
await page.click('.sn-page-visible .gal-strip a[aria-label="Photo 7"]');
await settled();
s = await state();
eq(s.pages.length, before, 'filmstrip sibling replaced the page: stack did not grow');
eq(s.url, '/gallery/7', 'url follows the replace');
mid = await transitioned(() => page.click('.sn-page-visible .gal-nav a'), 'gallery-next');
s = await state();
eq(s.pages.length, before + 1, '"Next" pushed instead');
eq(s.url, '/gallery/8', 'url after next');
const hist = await page.evaluate(() => history.length);
await interactivePop({
  mid: async () => {
    const m = await state();
    eq(m.visible.join(','), 'gallery-photo,gallery-photo', 'both dark pages visible mid-pop');
    await page.screenshot({
      path: fileURLToPath(new URL('./shots/gallery-swipe-mid.png', import.meta.url)),
    });
  },
});
await page.waitForFunction(() => location.pathname === '/gallery/7');
s = await state();
eq(s.pages.length, before, 'the pop removed the pushed photo');
eq(await page.evaluate(() => history.length), hist, 'the pop went back through history');
await page.click('.sn-page-visible .gal-strip a[aria-label="Photo 9"]');
await settled();
eq((await state()).url, '/gallery/9', 'filmstrip still works on the revealed page');

// ============================================================ mail
section('mail: direction from data.animation through a transition table');
await page.goto(base + '/');
await page.waitForSelector('app-home');
await openDemo('Mail');
await waitCount('a.mail-row', 5);
eq(
  await text('.sn-page-visible .mail-about .lede code:last-of-type'),
  'Inbox',
  'the page reads its own data.animation',
);
await transitioned(
  () => page.click('.sn-page-visible .mail-folders a:has-text("Sent")'),
  'mail-sent',
);
s = await state();
eq(
  s.pages.join(','),
  'app-home,mail-folder',
  'Inbox => Sent replaced the folder (siblings the tree would push)',
);
eq(s.title, 'Sent', 'on the Sent folder');
eq(s.url, '/mail/sent', 'url after the folder switch');
await waitCount('a.mail-row', 3);
await transitioned(
  () => page.locator('.sn-page-visible a.mail-row').first().click(),
  'mail-thread',
);
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder,mail-thread', '* => Thread pushed over the folder');
await page.waitForSelector('.sn-page-visible .mail-message h2');
await transitioned(() => page.click('.sn-page-visible .mail-message .btn'), 'mail-reply');
s = await state();
eq(
  s.pages.join(','),
  'app-home,mail-folder,mail-thread,mail-compose',
  'Thread => Compose pushed (siblings the tree would replace)',
);
eq(s.title, 'Reply', 'the composer knows it is a reply from the query param');
await page.fill('.sn-page-visible input[name=to]', 'someone@example.com'); // typed before the original arrives
await page.fill('.sn-page-visible input[name=to]', ''); // and cleared again: still the user's choice
await page.waitForFunction(() =>
  document.querySelector('.sn-page-visible input[name=subject]')?.value.startsWith('Re: '),
);
check(true, 'subject prefilled from the message');
eq(
  await page.inputValue('.sn-page-visible input[name=to]'),
  '',
  'a field edited while loading is left alone, even when cleared',
);
await page.fill('.sn-page-visible input[name=to]', 'mira@example.com');
await page.fill('.sn-page-visible textarea', 'Sounds good.');
await transitioned(
  () => page.click('.sn-page-visible .mail-action:has-text("Send")'),
  'mail-sent-back',
  { timeout: 4000 },
);
s = await state();
eq(
  s.pages.join(','),
  'app-home,mail-folder,mail-thread',
  'Send popped the composer back onto the thread',
);
await transitioned(() => page.click('.sn-page-visible .back'), 'mail-thread-back');
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder', 'Thread => * popped back to the folder');
await page.waitForFunction(() =>
  document.querySelector('.sn-page-visible a.mail-row strong')?.textContent.startsWith('Re: '),
);
check(true, 'the kept Sent folder reloaded: the reply is filed at the top');
await transitioned(
  () => page.click('.sn-page-visible .mail-action[aria-label=Compose]'),
  'mail-compose',
);
eq(
  (await state()).pages.join(','),
  'app-home,mail-folder,mail-compose',
  'Sent => Compose pushed the composer over a folder too',
);
await transitioned(() => page.click('.sn-page-visible .back:has-text("Cancel")'), 'mail-cancel');
eq((await state()).pages.join(','), 'app-home,mail-folder', 'Cancel popped it');
await transitioned(
  () => page.click('.sn-page-visible .mail-action[aria-label=Compose]'),
  'mail-compose-2',
);
await page.fill('.sn-page-visible input[name=to]', 'ada@example.com');
await page.fill('.sn-page-visible input[name=subject]', 'Left early');
await page.click('.sn-page-visible .mail-action:has-text("Send")');
await flush();
check(
  await page.locator('.sn-page-visible .back:has-text("Cancel")').isDisabled(),
  'Cancel is disabled while sending',
);
check(
  await page.locator('.sn-page-visible input[name=subject]').isDisabled(),
  'and so is the draft',
);
await transitioned(() => page.goBack(), 'mail-send-then-back');
await page.waitForTimeout(1500);
eq(
  (await state()).pages.join(','),
  'app-home,mail-folder',
  'a send that completes after a browser Back does not pop a second page',
);
await transitioned(() => page.goBack(), 'mail-out');
eq(
  (await state()).pages.join(','),
  'app-home',
  'one browser back leaves the demo: the folder switch had replaced its history entry',
);
// Slow motion makes the pop animation outlast the request, so the send completes while the composer is still animating out.
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Slow motion")');
await transitioned(() => page.goBack(), 'mail-lab-slow');
await openDemo('Mail');
await transitioned(
  () => page.click('.sn-page-visible .mail-action[aria-label=Compose]'),
  'mail-compose-slow',
);
await page.fill('.sn-page-visible input[name=to]', 'ada@example.com');
await page.fill('.sn-page-visible input[name=subject]', 'Left during the animation');
await page.click('.sn-page-visible .mail-action:has-text("Send")');
await page.goBack();
await page.waitForTimeout(2500);
await settled();
eq(
  (await state()).pages.join(','),
  'app-home,mail-folder',
  'a send that completes while the composer is still animating out does not pop a second page',
);
await transitioned(() => page.goBack(), 'mail-out-slow');
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Slow motion")');
await page.click('.sn-page-visible label:has-text("Every request fails")');
await transitioned(() => page.goBack(), 'mail-lab-back');
await openDemo('Mail');
await transitioned(
  () => page.click('.sn-page-visible .mail-action[aria-label=Compose]'),
  'mail-compose-failing',
);
await page.fill('.sn-page-visible input[name=to]', 'pri@example.com');
await page.fill('.sn-page-visible input[name=subject]', 'Will not go');
await page.click('.sn-page-visible .mail-action:has-text("Send")');
await page.waitForSelector('.sn-page-visible mail-compose .err, .sn-page-visible .err');
s = await state();
eq(
  s.pages.join(','),
  'app-home,mail-folder,mail-compose',
  'a failed send stays on the composer with an error',
);
eq(
  await page.inputValue('.sn-page-visible input[name=subject]'),
  'Will not go',
  'the draft is kept',
);
await transitioned(() => page.goBack(), 'mail-failed-back');
await transitioned(() => page.goBack(), 'mail-out-2');
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Every request fails")');
await transitioned(() => page.goBack(), 'mail-lab-back-2');

// ============================================================ notes
// A header of two heights. It is a function of the page's own scroll offset and
// of nothing else, so the stack keeping that offset is all it takes for a list
// left collapsed to come back collapsed.
section('notes: a large title that collapses into the bar');
// A fresh load, so the lab's settings from the section above are gone.
await page.goto(base + '/');
await page.waitForSelector('app-home');
await openDemo('Notes');
await page.waitForSelector('.sn-page-visible .notes-row b');
const header = () =>
  page.evaluate(() => {
    const p = document.querySelector('.sn-container > .sn-page-visible');
    const num = (el, prop) =>
      Math.round(Number(getComputedStyle(el).getPropertyValue(prop)) * 100) / 100;
    const large = p.querySelector('.lt-large');
    return {
      bar: Math.round(p.querySelector('.lt-bar').getBoundingClientRect().height),
      large: Math.round(large.getBoundingClientRect().height),
      // Below the bar while the header is tall, above the top of the page once it has gone under it.
      largeTop: Math.round(large.getBoundingClientRect().top),
      inBar: num(p.querySelector('.lt-compact'), 'opacity'),
      title: num(large.querySelector('h1'), 'opacity'),
    };
  });
/** The header repaints on the frame after the scroll, so wait for the value rather than for a fixed number of frames. */
const inBar = (want, msg) =>
  page
    .waitForFunction(
      (want) =>
        Math.round(
          Number(
            getComputedStyle(document.querySelector('.sn-container > .sn-page-visible .lt-compact'))
              .opacity,
          ),
        ) === want,
      want,
      { timeout: 2000 },
    )
    .then(
      () => check(true, msg),
      () => check(false, msg),
    );
let h = await header();
const tall = h.bar + h.large;
check(
  h.inBar === 0 && h.title === 1,
  `at the top the title is large and the bar carries none of it (header ${tall}px)`,
);
check(
  h.large > 40 && h.largeTop === h.bar,
  'the large title sits below a bar that is not covering it',
);
await setScroll(200);
await inBar(1, 'scrolled past it, the title has crossed into the bar');
h = await header();
check(
  h.title === 0 && h.largeTop < 0,
  `the large title has left, so the header is ${h.bar}px rather than ${tall}px`,
);
const notesScroll = await scrollTop();
// A row that is on screen, so opening it does not move the list first.
const row = await page.evaluate(() => {
  const top = document.querySelector('.sn-container').getBoundingClientRect().top;
  return [...document.querySelectorAll('.sn-page-visible .notes-row')].findIndex(
    (r) => r.getBoundingClientRect().top > top + 120,
  );
});
mid = await transitioned(
  () => page.locator('.sn-page-visible .notes-row').nth(row).click(),
  'notes-push',
);
check(
  mid.busy && mid.pages.join(',') === 'app-home,notes-list,notes-note',
  'the note pushed over the list',
);
await page.waitForSelector('.sn-page-visible .notes-body p');
await flush();
h = await header();
check(h.inBar === 0 && h.title === 1, 'the pushed note starts with a large title of its own');
await setScroll(300);
await inBar(1, 'and collapses on its own scroll offset');
await transitioned(() => page.goBack(), 'notes-pop');
await flush();
eq(await scrollTop(), notesScroll, 'the list came back at the offset it was left at');
h = await header();
check(
  h.inBar === 1 && h.title === 0,
  'and therefore still collapsed: there is no header state to restore',
);
await setScroll(0);
await inBar(0, 'back at the top, the large title is back');
const short = (await header()).large;
// The second pinned note has a title long enough to wrap, so its header is taller than the list's.
mid = await transitioned(
  () => page.locator('.sn-page-visible .notes-row').nth(1).click(),
  'notes-long-title',
);
await page.waitForSelector('.sn-page-visible .notes-body p');
h = await header();
check(
  h.large > short * 2,
  `a title that wraps makes a taller header (${h.large}px against ${short}px)`,
);
check(h.inBar === 0, 'still large at the top, whatever its height');
await setScroll(h.large + 40);
await inBar(1, 'and it collapses over the longer distance');
await transitioned(() => page.goBack(), 'notes-out');
await transitioned(() => page.goBack(), 'notes-demos');

// ============================================================ lab
section('lab: deep stack, slow resolver, heavy page, failing backend');
await openDemo('Lab');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Deep stack")'), 'deep-1');
for (let d = 2; d <= 5; d++)
  await transitioned(
    () => page.click(`.sn-page-visible a.item:has-text("Push depth ${d}")`),
    `deep-${d}`,
  );
s = await state();
eq(
  s.pages.join(','),
  'app-home,lab-home,lab-deep,lab-deep,lab-deep,lab-deep,lab-deep',
  'five sibling pages pushed by hint',
);
eq(s.title, 'Depth 5', 'top of the stack');
mid = await transitioned(
  () => page.click('.sn-page-visible button:has-text("Pop to the lab")'),
  'deep-pop',
);
check(
  mid.busy && mid.pages.join(',') === 'app-home,lab-home,lab-deep',
  `one animation, intermediates dropped (${mid.pages})`,
);
s = await state();
eq(s.pages.join(','), 'app-home,lab-home', 'five pages dropped in one pop');
eq(s.url, '/lab', 'url after popping to the lab');
await page.click('.sn-page-visible a.item:has-text("Slow page")');
s = await state();
await page.waitForSelector('.progress.on', { timeout: 600 });
check(!s.busy && s.pages.length === 2, 'slow resolver: nothing mounted, progress bar on');
await busy(4000);
await settled();
s = await state();
eq(s.pages.at(-1), 'lab-slow', 'slow page pushed once resolved');
check((await text('.sn-page-visible .lede')).includes('patience'), 'with the resolved data');
await transitioned(() => page.goBack(), 'slow-back');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Heavy page")'), 'heavy');
eq(await count('.lab-stress-row'), 600, '600 rows mounted');
await setScroll(3000);
await interactivePop();
await page.waitForFunction(() => location.pathname === '/lab');
eq((await state()).pages.join(','), 'app-home,lab-home', 'popped the heavy page away');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Wide content")'), 'wide');
await page
  .locator('.sn-page-visible .lab-scroller')
  .first()
  .evaluate((el) => (el.scrollLeft = 200));
await interactivePop();
await page.waitForFunction(() => location.pathname === '/lab');
eq(
  (await state()).pages.join(','),
  'app-home,lab-home',
  'an interactive pop still works on a page full of horizontal scrollers',
);
await page.click('.sn-page-visible label:has-text("Every request fails")');
await transitioned(() => page.goBack(), 'lab-home-2');
await openDemo('Feed');
await page.waitForSelector('.sn-page-visible .err');
eq(await count('feed-card'), 0, 'failing backend: error box, no cards');
await page.click('.sn-page-visible .err button');
await page.waitForSelector('.sn-page-visible .err');
check(true, 'retry ran and failed again');
await transitioned(() => page.goBack(), 'feed-err-back');
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Every request fails")');
await transitioned(() => page.goBack(), 'lab-home-3');
await openDemo('Feed');
await waitCount('feed-card', 10);
check(true, 'backend healthy again: the fresh feed loads');

// ============================================================ colour scheme
// Each demo page has its own look, so the dark system scheme must reach the
// app's own pages and stop at a demo's root, including its header and cards.
section('dark system scheme: the app follows it, a demo keeps its own colours');
const colours = (sel) =>
  page.evaluate((sel) => {
    const page_ = document.querySelector(sel);
    const read = (el, inkEl = el) =>
      el ? getComputedStyle(el).backgroundColor + ' / ' + getComputedStyle(inkEl).color : 'missing';
    const hdr = page_.querySelector('.hdr');
    return {
      page: read(page_),
      hdr: read(hdr, hdr.querySelector('h1')),
      item: read(page_.querySelector('.item')),
    };
  }, sel);

await page.goto(base + '/');
await page.waitForSelector('app-home');
const homeLight = await colours('.sn-page-visible .page');
await openDemo('Lab');
const labLight = await colours('.sn-page-visible .page.lab');

await media({ colorScheme: 'dark' });
await flush();
const labDark = await colours('.sn-page-visible .page.lab');
for (const part of ['page', 'hdr', 'item'])
  eq(labDark[part], labLight[part], `the lab's ${part} ignores the dark scheme`);
await page.screenshot({
  path: fileURLToPath(new URL('./shots/lab-dark-scheme.png', import.meta.url)),
});
await transitioned(() => page.goBack(), 'demos-dark-scheme');
const homeDark = await colours('.sn-page-visible .page');
for (const part of ['page', 'hdr', 'item'])
  check(
    homeDark[part] !== homeLight[part],
    `the demos list follows the dark scheme (${part}: ${homeDark[part]})`,
  );
await media({ colorScheme: 'light' });

await finish();
