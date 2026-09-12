// Drives the demo apps (feed, shop, messages, gallery, forms, search,
// dashboard, mail, lab) through the outlet: pushes and pops across different layouts,
// content arriving before, during and after a transition, resolvers, replaced
// pages, a nested outlet, and the swipe gesture on all of them.
// Run `ng build` first.
import { launch } from './harness.mjs';

const { page, base, check, eq, section, flush, state, busy, settled, transitioned, scrollTop, setScroll, swipeBack, finish } = await launch();
const count = async (sel) => (await flush(), page.locator(sel).count());
const waitCount = (sel, n) => page.waitForFunction(([sel, n]) => document.querySelectorAll(sel).length >= n, [sel, n], { timeout: 8000 });
const text = async (sel) => (await flush(), page.locator(sel).first().textContent().then((t) => t?.trim()));
const openDemo = (name) => transitioned(() => page.click(`.sn-page-visible a.item:has-text("${name}")`), `demo-${name.toLowerCase()}`);
let s, mid;

// ============================================================ feed
section('feed: skeletons, load more, cross-links that always push');
await page.goto(base + '/');
await page.waitForSelector('app-home');
mid = await openDemo('Feed');
check(mid.busy && mid.pages.join(',') === 'app-home,feed-home', 'lazy chunk loaded, then the push animated');
s = await state();
check((await count('.sn-page-visible demo-skeleton')) > 0, 'the list is still loading when the push lands (skeletons)');
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
  const outlet = document.querySelector('sn-outlet').getBoundingClientRect();
  return [...document.querySelectorAll('.sn-page-visible feed-card .feed-author')].findIndex((a) => a.getBoundingClientRect().top > outlet.top + 60);
});
const author = await page.locator('.sn-page-visible feed-card').nth(nth).locator('.feed-author b').textContent();
mid = await transitioned(() => page.locator('.sn-page-visible feed-card').nth(nth).locator('.feed-author').click(), 'feed-profile');
check(mid.busy && mid.pages.length === 3, 'profile pushed over the feed');
s = await state();
eq(s.pages.join(','), 'app-home,feed-home,feed-profile', 'feed kept beneath the profile');
await page.waitForSelector('.sn-page-visible .feed-profile');
eq(await text('.sn-page-visible .feed-profile h2'), author, 'profile loaded the tapped author');
await page.click('.sn-page-visible button[role=tab]:has-text("Media")');
await waitCount('.sn-page-visible feed-card', 1);
mid = await transitioned(() => page.locator('.sn-page-visible feed-card a[href^="/feed/post/"]').first().click(), 'feed-post');
s = await state();
eq(s.pages.join(','), 'app-home,feed-home,feed-profile,feed-post', 'post pushed over the profile although the tree calls them siblings ([pushTo])');
await page.waitForSelector('.sn-page-visible .feed-comment');
check((await count('.sn-page-visible .feed-comment')) >= 2, 'comments arrived after the post');
await page.click('.sn-page-visible .feed-actions button');
check((await text('.sn-page-visible .feed-actions button')).startsWith('♥'), 'liked the post');
await page.fill('.sn-page-visible .feed-reply input', 'Nice one');
await page.press('.sn-page-visible .feed-reply input', 'Enter');
eq(await count('.sn-page-visible .feed-comment.mine'), 1, 'reply added locally');
await transitioned(() => page.goBack(), 'feed-back-1');
await transitioned(() => page.goBack(), 'feed-back-2');
s = await state();
eq(s.pages.join(','), 'app-home,feed-home', 'two browser backs popped to the feed');
eq(await scrollTop(), feedScroll, 'feed scroll position survived');
eq(await count('feed-card'), 20, 'the loaded pages are still there, nothing refetched');
await transitioned(() => page.click('.sn-page-visible .back'), 'feed-home');
eq((await state()).pages.join(','), 'app-home', 'back to the demos');

// ============================================================ shop
section('shop: grid, resolver, cart, checkout, replaced success page');
await openDemo('Shop');
await waitCount('.shop-tile:not(.skel-tile)', 24);
await page.click('.sn-page-visible .shop-chips button:has-text("Home")');
await page.waitForFunction(() => document.querySelectorAll('.shop-tile:not(.skel-tile)').length === 6);
eq(await count('.shop-tile:not(.skel-tile)'), 6, 'category chip filtered the grid');
await page.click('.sn-page-visible .shop-tile:has-text("Ember Lamp")');
s = await state();
check(!s.busy && s.pages.length === 2, 'the resolver holds the navigation: nothing mounted yet');
await page.waitForSelector('.progress.on', { timeout: 600 });
check(true, 'progress bar runs while the resolver waits');
await busy(3000);
mid = await state();
check(mid.busy && mid.pages.length === 3, 'push started once the product was resolved');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,shop-catalog,shop-product', 'product over the catalog');
eq(s.title, 'Ember Lamp', 'product arrived through the resolver and input binding');
await page.click('.sn-page-visible .shop-buybar button');
await page.click('.sn-page-visible .shop-buybar button');
eq(await text('.sn-page-visible .shop-cart-btn b'), '2', 'cart badge counts two');
await page.waitForSelector('.sn-page-visible .shop-mini:not(.skel-tile)');
const related = await page.locator('.sn-page-visible .shop-mini b').first().textContent();
mid = await transitioned(() => page.locator('.sn-page-visible .shop-mini').first().click(), 'shop-related', { timeout: 3000 });
s = await state();
eq(s.pages.join(','), 'app-home,shop-catalog,shop-product,shop-product', 'related product pushed (resolver again)');
eq(s.title, related, 'related product page shows the tapped product');
await transitioned(() => page.goBack(), 'shop-back');
eq((await state()).title, 'Ember Lamp', 'back to the first product');
mid = await transitioned(() => page.click('.sn-page-visible .shop-cart-btn'), 'shop-cart');
check(mid.busy && mid.pages.length === 4, 'cart pushed (explicitly, over an unrelated sibling)');
s = await state();
eq(s.pages.join(','), 'app-home,shop-catalog,shop-product,shop-cart', 'cart above the product');
eq(await text('.sn-page-visible .shop-qty span'), '2', 'cart line has the quantity');
await page.click('.sn-page-visible .shop-qty button[aria-label=More]');
eq(await text('.sn-page-visible .shop-qty span'), '3', 'stepper works');
eq(await text('.sn-page-visible .shop-summary .total b'), '$' + 3 * 249, 'total follows');
await transitioned(() => page.click('.sn-page-visible .shop-buybar a'), 'shop-checkout');
eq((await state()).pages.at(-1), 'shop-checkout', 'checkout pushed');
for (const [name, value] of [['name', 'Ada'], ['email', 'ada@example.com'], ['address', '1 Main St'], ['city', 'Porto'], ['zip', '4000'], ['card', '4242424242424242']]) await page.fill(`.sn-page-visible input[name=${name}]`, value);
await page.click('.sn-page-visible label:has-text("declined card")');
await page.click('.sn-page-visible .shop-buybar button');
await page.waitForSelector('.sn-page-visible .shop-buybar button:has-text("Placing")', { timeout: 600 });
check(true, 'submit shows its busy state');
await page.waitForSelector('.sn-page-visible .err');
eq((await state()).pages.at(-1), 'shop-checkout', 'declined card: still on the checkout with an error');
await page.click('.sn-page-visible label:has-text("declined card")');
const historyBefore = await page.evaluate(() => history.length);
await page.click('.sn-page-visible .shop-buybar button');
await page.waitForSelector('shop-order');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,shop-catalog,shop-product,shop-cart,shop-order', 'success page replaced the checkout in the stack');
check(/^\/shop\/order\/SN-\d+$/.test(s.url), `order url (${s.url})`);
eq(await page.evaluate(() => history.length), historyBefore, 'and replaced it in history too (replaceUrl)');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Continue shopping")'), 'shop-pop-to-root');
check(mid.busy && mid.pages.join(',') === 'app-home,shop-catalog,shop-order', `popping to the catalog: intermediates dropped, one animation (${mid.pages})`);
s = await state();
eq(s.pages.join(','), 'app-home,shop-catalog', 'kept catalog is back, the pages above are gone');

eq(await text('.sn-page-visible .shop-chips button.on'), 'Home', 'the category chip survived the round trip');
eq(await count('.sn-page-visible .shop-cart-btn b'), 0, 'cart emptied after the order');
await transitioned(() => page.click('.sn-page-visible .back'), 'shop-home');
s = await state();
eq(s.pages.join(',') + ' ' + s.url, 'app-home /', 'history was rewound with the pop: one Back from the catalog is the demos page');

// ============================================================ messages
section('messages: sticky composer, scroll to bottom, replies that arrive after you left');
await openDemo('Messages');
await waitCount('.chat-row', 8);
mid = await transitioned(() => page.click('.sn-page-visible .chat-row:has-text("Kofi Mensah")'), 'chat-thread');
s = await state();
eq(s.pages.join(','), 'app-home,chat-inbox,chat-thread', 'thread over the inbox');
await page.waitForSelector('.sn-page-visible .chat-bubble');
const atBottom = await page.evaluate(() => {
  const el = document.querySelector('sn-outlet > .sn-page-visible');
  return el.scrollHeight - el.scrollTop - el.clientHeight;
});
check(atBottom < 2, `thread scrolled to its newest bubble (${atBottom}px from the bottom)`);
await page.fill('.sn-page-visible .chat-composer input', 'hello there');
await page.press('.sn-page-visible .chat-composer input', 'Enter');
await flush();
eq(await page.locator('.sn-page-visible .chat-bubble.mine').last().textContent().then((t) => t.replace(/\d+:\d+$/, '').trim()), 'hello there', 'sent bubble appended');
eq(await count('.sn-page-visible .chat-typing'), 1, 'typing indicator while the reply is on its way');
await transitioned(() => page.goBack(), 'chat-back-early');
eq((await state()).pages.join(','), 'app-home,chat-inbox', 'left the thread before the reply came');
await page.waitForTimeout(2200);
await transitioned(() => page.click('.sn-page-visible .chat-row:has-text("Kofi Mensah")'), 'chat-thread-again');
await page.waitForSelector('.sn-page-visible .chat-bubble');
eq(await count('.sn-page-visible .chat-bubble:has-text("hello there")'), 1, 'the sent message is in the reloaded thread, exactly once');
check((await count('.sn-page-visible .chat-bubble')) > 2, 'and the reply that arrived while we were away');
await transitioned(() => page.goBack(), 'chat-back');
await transitioned(() => page.goBack(), 'chat-home');
eq((await state()).pages.join(','), 'app-home', 'back on the demos');
// unknown ids must reach the error state, not crash the page or hang the request
for (const url of ['/messages/foo', '/feed/post/999', '/gallery/0']) {
  await page.goto(base + url);
  await page.waitForSelector('.err', { timeout: 5000 });
}
check(true, 'unknown ids on deep links render an error box instead of throwing');
// the loop above left the browser on the last deep link, so go home before clicking one of its links
await page.goto(base + '/');
await page.waitForSelector('app-home');

// ============================================================ lab + gallery
section('gallery in slow motion: dark page, data arriving mid-transition, sibling replace, filmstrip, swipe');
// A deep link renders that page alone, so come back to the demos list first.
await page.goto(base + '/');
await page.waitForSelector('app-home');
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Slow motion")');
await transitioned(() => page.goBack(), 'lab-back');
let t0 = Date.now();
mid = await openDemo('Gallery');
let elapsed = Date.now() - t0;
check(elapsed > 1500, `slow motion reached the outlet's transition (${elapsed}ms)`);
await waitCount('.gal-tile:not(.skel-tile)', 30);
mid = await transitioned(() => page.click('.sn-page-visible .gal-tile[aria-label="Low tide 5"], .sn-page-visible .gal-tile >> nth=4'), 'gallery-photo-mid');
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
await swipeBack({
  mid: async () => {
    const m = await state();
    eq(m.visible.join(','), 'gallery-photo,gallery-photo', 'both dark pages visible mid-swipe');
    await page.screenshot({ path: new URL('./shots/gallery-swipe-mid.png', import.meta.url).pathname });
  },
});
await page.waitForFunction(() => location.pathname === '/gallery/7');
s = await state();
eq(s.pages.length, before, 'swipe popped the pushed photo');
eq(await page.evaluate(() => history.length), hist, 'swipe went back through history');
await page.click('.sn-page-visible .gal-strip a[aria-label="Photo 9"]');
await settled();
eq((await state()).url, '/gallery/9', 'filmstrip still works on the revealed page');

// ============================================================ forms
section('forms: long form with async save, numbered wizard, replaced ending, pop to root');
await page.goto(base + '/'); // also resets slow motion
await page.waitForSelector('app-home');
await openDemo('Forms');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Edit profile")'), 'forms-profile');
eq(await text('.sn-page-visible .frm-hint'), 'Everything is saved.', 'form starts clean');
await page.fill('.sn-page-visible input[name=name]', 'Grace Hopper');
eq(await text('.sn-page-visible .frm-hint'), 'Unsaved changes.', 'typing makes it dirty');
await page.click('.sn-page-visible .frm-savebar button');
await page.waitForSelector('.sn-page-visible .frm-savebar button:has-text("Saving")', { timeout: 600 });
check(true, 'save shows its busy state');
await page.waitForSelector('.sn-page-visible .toast');
eq(await text('.sn-page-visible .frm-hint'), 'Everything is saved.', 'saved after the fake request');
await transitioned(() => page.goBack(), 'forms-back');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Edit profile")'), 'forms-profile-again');
eq(await page.inputValue('.sn-page-visible input[name=name]'), 'Ada Lindqvist', 'a popped page is destroyed; reopening starts fresh');
await transitioned(() => page.goBack(), 'forms-back-2');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Sign-up wizard")'), 'wizard-1');
s = await state();
eq(s.pages.join(','), 'app-home,forms-home,forms-wizard', 'step 1 pushed (tree)');
await page.click('.sn-page-visible .frm-plan:has-text("Team")');
mid = await transitioned(() => page.click('.sn-page-visible .frm-savebar a'), 'wizard-2');
check(mid.busy && mid.pages.length === 4, 'step 2 pushed over step 1 (stackLevel 1 → 2, siblings in the tree)');
eq((await state()).title, 'Step 2 of 3', 'step number came in through route data binding');
await page.fill('.sn-page-visible input[name=org]', 'Acme');
await page.click('.sn-page-visible .frm-stepper button[aria-label=More]');
await transitioned(() => page.click('.sn-page-visible .frm-savebar a'), 'wizard-3');
eq((await state()).title, 'Step 3 of 3', 'step 3');
eq(await text('.sn-page-visible .frm-review div:nth-child(2) b'), 'Acme', 'review shows the organisation');
eq(await text('.sn-page-visible .frm-review div:nth-child(3) b'), '4', 'and the seats');
mid = await transitioned(() => page.click('.sn-page-visible .back'), 'wizard-back');
check(mid.busy && mid.pages.length === 5, 'back pops step 3');
eq(await page.inputValue('.sn-page-visible input[name=org]'), 'Acme', 'kept step 2 still has its input');
await transitioned(() => page.click('.sn-page-visible .frm-savebar a'), 'wizard-3-again');
await page.click('.sn-page-visible label.frm-agree');
const histWizard = await page.evaluate(() => history.length);
await page.click('.sn-page-visible .frm-savebar button');
await page.waitForSelector('forms-done');
await settled();
s = await state();
eq(s.pages.join(','), 'app-home,forms-home,forms-wizard,forms-wizard,forms-done', 'the confirmation replaced step 3');
eq(await page.evaluate(() => history.length), histWizard, 'and its history entry');
check((await text('.sn-page-visible .frm-done-body p')).includes('4 seats on the team plan'), 'confirmation reads the shared wizard state');
mid = await transitioned(() => page.click('.sn-page-visible .btn'), 'wizard-done');
check(mid.busy && mid.pages.join(',') === 'app-home,forms-home,forms-done', `popping to the forms list animates once (${mid.pages})`);
s = await state();
eq(s.pages.join(','), 'app-home,forms-home', 'wizard pages all gone');
eq(s.url, '/forms', 'url after popping to the kept page');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Preferences")'), 'preferences');
await page.click('.sn-page-visible label:has-text("Email digests")');
await page.selectOption('.sn-page-visible select >> nth=0', 'Dark');
eq(await text('.sn-page-visible .frm-hint'), '2 settings changed from the defaults.', 'toggles and selects update');
await transitioned(() => page.goBack(), 'preferences-back');
await transitioned(() => page.goBack(), 'forms-home');

// ============================================================ search
section('search: debounced, cancelled, query in the url, links into other demos');
await openDemo('Search');
eq(await page.evaluate(() => document.activeElement?.getAttribute('type')), 'search', 'search box focused on arrival');
await page.type('.sn-page-visible .srch-box input', 'lamp', { delay: 60 });
await page.waitForSelector('.sn-page-visible .srch-row');
eq(await text('.sn-page-visible .srch-status'), '1 result for “lamp”', 'one result, for the final text only');
check((await state()).url.includes('q=lamp'), 'query mirrored into the url');
mid = await transitioned(() => page.click('.sn-page-visible .srch-row'), 'search-result', { timeout: 3000 });
s = await state();
eq(s.pages.join(','), 'app-home,search-home,shop-product', 'result pushed a page from another demo (resolver included)');
eq(s.title, 'Ember Lamp', 'it is the lamp');
await transitioned(() => page.goBack(), 'search-back');
eq(await page.inputValue('.sn-page-visible .srch-box input'), 'lamp', 'search text kept');
eq(await count('.sn-page-visible .srch-row'), 1, 'results kept, nothing refetched');
await page.goto(base + '/search?q=ada');
await page.waitForSelector('.srch-row');
eq(await page.inputValue('.srch-box input'), 'ada', 'deep link seeded the box from ?q=');
check((await text('.srch-row b')) === 'Ada Lindqvist', 'and ran the search');

// ============================================================ dashboard
section('dashboard: a nested router-outlet inside a kept page');
await page.goto(base + '/');
await page.waitForSelector('app-home');
await openDemo('Dashboard');
s = await state();
eq(s.url, '/dashboard/overview', 'redirected to the first tab');
eq(s.pages.join(','), 'app-home,dash-shell', 'one stack page for the whole dashboard');
await waitCount('.dash-tile:not(.skel-tile)', 4);
await page.click('.sn-page-visible .dash-range button:has-text("day")');
await page.waitForFunction(() => document.querySelectorAll('.dash-chart i').length === 24);
check(true, 'range switch reloaded the chart in place');
await page.click('.sn-page-visible .dash-tabs a:has-text("Team")');
await page.waitForSelector('dash-team');
s = await state();
eq(s.pages.join(','), 'app-home,dash-shell', 'tab change happened inside the nested outlet, not in the stack');
eq(s.url, '/dashboard/team', 'url after the tab change');
await waitCount('.dash-member', 8);
mid = await transitioned(() => page.click('.sn-page-visible .dash-member:has-text("Mira Sato")'), 'dash-member');
check(mid.busy && mid.pages.length === 3, 'member pushed over the dashboard');
await page.waitForSelector('.sn-page-visible .dash-profile');
eq((await state()).title, 'Mira Sato', 'member loaded');
mid = await transitioned(() => page.click('.sn-page-visible .btn:has-text("Message")'), 'dash-to-chat');
s = await state();
eq(s.pages.join(','), 'app-home,dash-shell,dash-member,chat-thread', 'a chat thread pushed from the dashboard');
await transitioned(() => page.goBack(), 'dash-back-1');
await transitioned(() => page.goBack(), 'dash-back-2');
s = await state();
eq(s.pages.join(','), 'app-home,dash-shell', 'back on the dashboard');
eq(s.url, '/dashboard/team', 'the shell was kept and the router re-activated the team tab in it');
await waitCount('dash-team .dash-member', 8);
check(true, 'the child route is re-created by the router (only the shell is kept), so its list loads again');
await page.click('.sn-page-visible .dash-tabs a:has-text("Activity")');
await waitCount('.dash-table tbody tr', 40);
await page.click('.sn-page-visible .dash-filters button:has-text("fail")');
check((await count('.dash-table tbody tr')) < 40, 'table filter applied');
await transitioned(() => page.click('.sn-page-visible .back'), 'dash-home');
eq((await state()).pages.join(','), 'app-home', 'back on the demos: tab switches replaced their history entry, so one Back leaves the dashboard');

// ============================================================ mail
section('mail: direction from data.animation through a transition table');
await page.goto(base + '/');
await page.waitForSelector('app-home');
await openDemo('Mail');
await waitCount('a.mail-row', 5);
eq(await text('.sn-page-visible .mail-about .lede code:last-of-type'), 'Inbox', 'the page reads its own data.animation');
await transitioned(() => page.click('.sn-page-visible .mail-folders a:has-text("Sent")'), 'mail-sent');
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder', 'Inbox => Sent replaced the folder (siblings the tree would push)');
eq(s.title, 'Sent', 'on the Sent folder');
eq(s.url, '/mail/sent', 'url after the folder switch');
await waitCount('a.mail-row', 3);
await transitioned(() => page.locator('.sn-page-visible a.mail-row').first().click(), 'mail-thread');
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder,mail-thread', '* => Thread pushed over the folder');
await page.waitForSelector('.sn-page-visible .mail-message h2');
await transitioned(() => page.click('.sn-page-visible .mail-message .btn'), 'mail-reply');
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder,mail-thread,mail-compose', 'Thread => Compose pushed (siblings the tree would replace)');
eq(s.title, 'Reply', 'the composer knows it is a reply from the query param');
await page.fill('.sn-page-visible input[name=to]', 'someone@example.com'); // typed before the original arrives
await page.fill('.sn-page-visible input[name=to]', ''); // and cleared again: still the user's choice
await page.waitForFunction(() => document.querySelector('.sn-page-visible input[name=subject]')?.value.startsWith('Re: '));
check(true, 'subject prefilled from the message');
eq(await page.inputValue('.sn-page-visible input[name=to]'), '', 'a field edited while loading is left alone, even when cleared');
await page.fill('.sn-page-visible input[name=to]', 'mira@example.com');
await page.fill('.sn-page-visible textarea', 'Sounds good.');
await transitioned(() => page.click('.sn-page-visible .mail-action:has-text("Send")'), 'mail-sent-back', { timeout: 4000 });
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder,mail-thread', 'Send popped the composer back onto the thread');
await transitioned(() => page.click('.sn-page-visible .back'), 'mail-thread-back');
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder', 'Thread => * popped back to the folder');
await page.waitForFunction(() => document.querySelector('.sn-page-visible a.mail-row strong')?.textContent.startsWith('Re: '));
check(true, 'the kept Sent folder reloaded: the reply is filed at the top');
await transitioned(() => page.click('.sn-page-visible .mail-action[aria-label=Compose]'), 'mail-compose');
eq((await state()).pages.join(','), 'app-home,mail-folder,mail-compose', 'Sent => Compose pushed the composer over a folder too');
await transitioned(() => page.click('.sn-page-visible .back:has-text("Cancel")'), 'mail-cancel');
eq((await state()).pages.join(','), 'app-home,mail-folder', 'Cancel popped it');
await transitioned(() => page.click('.sn-page-visible .mail-action[aria-label=Compose]'), 'mail-compose-2');
await page.fill('.sn-page-visible input[name=to]', 'ada@example.com');
await page.fill('.sn-page-visible input[name=subject]', 'Left early');
await page.click('.sn-page-visible .mail-action:has-text("Send")');
await flush();
check(await page.locator('.sn-page-visible .back:has-text("Cancel")').isDisabled(), 'Cancel is disabled while sending');
await transitioned(() => page.goBack(), 'mail-send-then-back');
await page.waitForTimeout(1500);
eq((await state()).pages.join(','), 'app-home,mail-folder', 'a send that completes after a browser Back does not pop a second page');
await transitioned(() => page.goBack(), 'mail-out');
eq((await state()).pages.join(','), 'app-home', 'one browser back leaves the demo: the folder switch had replaced its history entry');
// Slow motion makes the pop animation outlast the request, so the send completes while the composer is still animating out.
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Slow motion")');
await transitioned(() => page.goBack(), 'mail-lab-slow');
await openDemo('Mail');
await transitioned(() => page.click('.sn-page-visible .mail-action[aria-label=Compose]'), 'mail-compose-slow');
await page.fill('.sn-page-visible input[name=to]', 'ada@example.com');
await page.fill('.sn-page-visible input[name=subject]', 'Left during the animation');
await page.click('.sn-page-visible .mail-action:has-text("Send")');
await page.goBack();
await page.waitForTimeout(2500);
await settled();
eq((await state()).pages.join(','), 'app-home,mail-folder', 'a send that completes while the composer is still animating out does not pop a second page');
await transitioned(() => page.goBack(), 'mail-out-slow');
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Slow motion")');
await page.click('.sn-page-visible label:has-text("Every request fails")');
await transitioned(() => page.goBack(), 'mail-lab-back');
await openDemo('Mail');
await transitioned(() => page.click('.sn-page-visible .mail-action[aria-label=Compose]'), 'mail-compose-failing');
await page.fill('.sn-page-visible input[name=to]', 'pri@example.com');
await page.fill('.sn-page-visible input[name=subject]', 'Will not go');
await page.click('.sn-page-visible .mail-action:has-text("Send")');
await page.waitForSelector('.sn-page-visible mail-compose .err, .sn-page-visible .err');
s = await state();
eq(s.pages.join(','), 'app-home,mail-folder,mail-compose', 'a failed send stays on the composer with an error');
eq(await page.inputValue('.sn-page-visible input[name=subject]'), 'Will not go', 'the draft is kept');
await transitioned(() => page.goBack(), 'mail-failed-back');
await transitioned(() => page.goBack(), 'mail-out-2');
await openDemo('Lab');
await page.click('.sn-page-visible label:has-text("Every request fails")');
await transitioned(() => page.goBack(), 'mail-lab-back-2');

// ============================================================ lab
section('lab: deep stack, slow resolver, heavy page, failing backend');
await openDemo('Lab');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Deep stack")'), 'deep-1');
for (let d = 2; d <= 5; d++) await transitioned(() => page.click(`.sn-page-visible a.item:has-text("Push depth ${d}")`), `deep-${d}`);
s = await state();
eq(s.pages.join(','), 'app-home,lab-home,lab-deep,lab-deep,lab-deep,lab-deep,lab-deep', 'five sibling pages pushed by hint');
eq(s.title, 'Depth 5', 'top of the stack');
mid = await transitioned(() => page.click('.sn-page-visible button:has-text("Pop to the lab")'), 'deep-pop');
check(mid.busy && mid.pages.join(',') === 'app-home,lab-home,lab-deep', `one animation, intermediates dropped (${mid.pages})`);
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
await swipeBack();
await page.waitForFunction(() => location.pathname === '/lab');
eq((await state()).pages.join(','), 'app-home,lab-home', 'swiped the heavy page away');
await transitioned(() => page.click('.sn-page-visible a.item:has-text("Wide content")'), 'wide');
await page.locator('.sn-page-visible .lab-scroller').first().evaluate((el) => (el.scrollLeft = 200));
await swipeBack();
await page.waitForFunction(() => location.pathname === '/lab');
eq((await state()).pages.join(','), 'app-home,lab-home', 'edge swipe still pops a page full of horizontal scrollers');
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
    return { page: read(page_), hdr: read(hdr, hdr.querySelector('h1')), item: read(page_.querySelector('.item')) };
  }, sel);

await page.goto(base + '/');
await page.waitForSelector('app-home');
const homeLight = await colours('.sn-page-visible .page');
await openDemo('Lab');
const labLight = await colours('.sn-page-visible .page.lab');

await page.emulateMedia({ colorScheme: 'dark' });
await flush();
const labDark = await colours('.sn-page-visible .page.lab');
for (const part of ['page', 'hdr', 'item']) eq(labDark[part], labLight[part], `the lab's ${part} ignores the dark scheme`);
await page.screenshot({ path: new URL('./shots/lab-dark-scheme.png', import.meta.url).pathname });
await transitioned(() => page.goBack(), 'demos-dark-scheme');
const homeDark = await colours('.sn-page-visible .page');
for (const part of ['page', 'hdr', 'item']) check(homeDark[part] !== homeLight[part], `the demos list follows the dark scheme (${part}: ${homeDark[part]})`);
await page.emulateMedia({ colorScheme: 'light' });

await finish();
