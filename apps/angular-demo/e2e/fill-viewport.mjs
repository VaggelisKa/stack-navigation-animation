import { launch } from './harness.mjs';
import { join } from 'node:path';

const { page, base, check, eq, state, transitioned, shots, finish } = await launch();
await page.goto(base + '/?shell');
await page.waitForSelector('.embedded-stack > embedded-home');
eq(await page.locator('header').count(), 1, 'application has one header, owned by the shell');
eq(
  await page.locator('shell-microfrontend header').count(),
  0,
  'microfrontend contains content only',
);
check(
  (await page.locator('shell-microfrontend .embedded-stack > router-outlet').count()) === 1,
  'microfrontend owns the outlet and its sizing wrapper',
);
await page.evaluate(() => {
  window.shellHeader = document.querySelector('.shell-header');
});

const fits = async (label) => {
  await page.waitForFunction(() => {
    const el = document.querySelector('.embedded-stack');
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const viewport = window.visualViewport;
    return (
      Math.abs(rect.bottom - (viewport ? viewport.offsetTop + viewport.height : innerHeight)) < 1
    );
  });
  check(true, label);
};
await fits('auto-height slot fills viewport below shell header');
eq(
  await page.locator('.embedded-stack').evaluate((el) => el.clientHeight),
  720,
  '80px header leaves 720px',
);
eq(await page.evaluate(() => document.documentElement.scrollHeight), 800, 'no outer page overflow');

await page.getByRole('button', { name: 'Resize header' }).click();
await page.waitForFunction(() =>
  document.querySelector('.shell-header').classList.contains('expanded'),
);
await fits('follows header expansion without a window resize');
eq(
  await page.locator('.embedded-stack').evaluate((el) => el.clientHeight),
  660,
  'expanded header leaves 660px',
);
await page.setViewportSize({ width: 700, height: 900 });
await fits('follows viewport resize at desktop width');
await page.screenshot({ path: join(shots, 'shell-fill-viewport.png') });

const styleWrites = await page.evaluate(async () => {
  let writes = 0;
  const observer = new MutationObserver((records) => {
    writes += records.length;
  });
  observer.observe(document.querySelector('.embedded-stack'), {
    attributes: true,
    attributeFilter: ['style'],
  });
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  observer.disconnect();
  return writes;
});
eq(styleWrites, 0, 'stable layout does not rewrite inline styles');

await page.locator('.embedded-stack').evaluate((el) => {
  el.style.padding = '12px';
  el.style.border = '3px solid black';
});
await fits('padding and borders stay within viewport');
await page.locator('.embedded-stack').evaluate((el) => {
  el.style.padding = '';
  el.style.border = '';
});

// A translated sibling can shift the content independently of resize events.
await page.locator('.microfrontend').evaluate((el) => {
  el.style.transform = 'translateY(25px)';
});
await fits('follows position-only layout changes');
await page.locator('.microfrontend').evaluate((el) => {
  el.style.transform = '';
});
await fits('recovers after position-only layout change');

const mid = await transitioned(() => page.click('.sn-page-visible a:has-text("Item 3")'));
check(mid.busy && mid.pages.length === 2, 'push animates inside embedded stack');
check(
  await page.evaluate(
    () =>
      window.shellHeader === document.querySelector('.shell-header') &&
      !window.shellHeader.closest('.sn-page'),
  ),
  'same shell header remains outside the animated pages',
);
await fits('navigation preserves container bounds');
await page.locator('.shell-header').getByRole('button', { name: 'Back to items' }).waitFor();
await page.screenshot({ path: join(shots, 'shell-header-back.png') });
await transitioned(() =>
  page.locator('.shell-header').getByRole('button', { name: 'Back to items' }).click(),
);
eq((await state()).pages.join(','), 'embedded-home', 'back restores microfrontend content');
eq(
  await page.getByRole('button', { name: 'Back to items' }).count(),
  0,
  'shell back button is hidden on the list',
);

// Exercise mobile viewport coordinates without depending on a physical keyboard.
await page.evaluate(() =>
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: { offsetTop: 30, height: 500 },
  }),
);
await fits('uses visible viewport height and offset (keyboard/pan simulation)');
eq(
  await page.locator('.embedded-stack').evaluate((el) => el.getBoundingClientRect().bottom),
  530,
  'visible bottom includes offset',
);
await page.evaluate(() =>
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: null }),
);
await fits('falls back to innerHeight when VisualViewport is unavailable');
await page.evaluate(() => delete window.visualViewport);

await page.locator('.shell-header').evaluate((el) => {
  el.style.height = '1200px';
});
await page.waitForFunction(() => document.querySelector('.embedded-stack').style.height === '0px');
check(true, 'clamps height to zero when the slot begins below the viewport');
await page.locator('.shell-header').evaluate((el) => {
  el.style.height = '';
});
await fits('recovers from a zero-height slot');

await page.locator('.microfrontend').evaluate((el) => {
  el.style.display = 'none';
});
await page.setViewportSize({ width: 420, height: 800 });
await page.locator('.microfrontend').evaluate((el) => {
  el.style.display = '';
});
await fits('recomputes when a hidden microfrontend becomes visible');

// Keep the removed node so teardown can be checked after Angular destroys it.
await page.evaluate(() => {
  window.removedStack = document.querySelector('.embedded-stack');
  window.stackReads = 0;
  const read = window.removedStack.getClientRects.bind(window.removedStack);
  window.removedStack.getClientRects = () => {
    window.stackReads++;
    return read();
  };
  window.removedStack.style.setProperty('height', window.removedStack.style.height, 'important');
});
await page.getByRole('button', { name: 'Toggle microfrontend' }).click();
await page.waitForFunction(() => !document.querySelector('.embedded-stack'));
eq(
  await page.evaluate(() => window.removedStack.style.height),
  '123px',
  'teardown restores original height',
);
eq(
  await page.evaluate(() => window.removedStack.style.boxSizing),
  'content-box',
  'teardown restores original box sizing',
);
eq(
  await page.evaluate(() => window.removedStack.style.getPropertyPriority('height')),
  '',
  'teardown restores original priority',
);
// Reattach the old node so isConnected cannot mask a surviving frame loop.
await page.evaluate(() => document.querySelector('.microfrontend').append(window.removedStack));
const reads = await page.evaluate(() => window.stackReads);
await page.evaluate(
  () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
);
eq(await page.evaluate(() => window.stackReads), reads, 'teardown stops frame sampling');
await page.evaluate(() => window.removedStack.remove());
await page.getByRole('button', { name: 'Toggle microfrontend' }).click();
await fits('remounted microfrontend gets a fresh viewport height');

// A cross-document mount must use its own viewport, not the outer window.
await page.evaluate((src) => {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  iframe.style.cssText = 'width:400px;height:500px;border:0';
  document.body.append(iframe);
}, base + '/?shell');
const embedded = page.frameLocator('iframe');
await embedded.locator('.embedded-stack').waitFor();
await page.waitForFunction(
  () =>
    document.querySelector('iframe').contentDocument.querySelector('.embedded-stack')
      ?.clientHeight === 420,
);
eq(
  await embedded.locator('.embedded-stack').evaluate((el) => el.clientHeight),
  420,
  'iframe uses its own 500px viewport',
);

await finish();
