import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STACKNAV_CSS } from '../src/styles.ts';

test('the stylesheet disables browser-owned transitions for reduced motion', () => {
  assert.match(STACKNAV_CSS, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(STACKNAV_CSS, /--sn-t:0s!important/);
});

test('Android fades finish early while transforms retain the phase timing', () => {
  assert.match(
    STACKNAV_CSS,
    /\.sn-page-upper\.sn-page-android-fade\{transition-duration:var\(--sn-t,0s\),calc\(var\(--sn-t,0s\) \* 83 \/ 450\);transition-timing-function:var\(--sn-e,linear\),linear\}/,
  );
});

// A phase starting must not re-resolve the style of every element inside every
// kept page. Inherited properties and custom properties fan out that way, so
// nothing toggled per phase may change one below the page element.
test('the phase timing stops at the pages, and the dim reads it back through', () => {
  assert.match(STACKNAV_CSS, /:where\(\.sn-page\)>\*\{--sn-t:0s;--sn-e:linear\}/, 'a zero-specificity barrier an app can lift');
  assert.match(STACKNAV_CSS, /\.sn-dim\{[^}]*--sn-t:inherit;--sn-e:inherit;[^}]*\}/);
  assert.match(STACKNAV_CSS, /\.sn-page-upper,\.sn-page-lower\{[^}]*transition-duration:var\(--sn-t,0s\)/, 'the page itself still runs on the container timing');
});

test('busy blocks input with a shield, not with inherited properties on the pages', () => {
  assert.match(STACKNAV_CSS, /\.sn-busy::after\{content:"";position:absolute;inset:0;z-index:2147483647;user-select:none/);
  assert.doesNotMatch(STACKNAV_CSS, /\.sn-busy \.sn-page/);
  assert.doesNotMatch(STACKNAV_CSS, /\.sn-busy\{/);
  for (const rule of STACKNAV_CSS.match(/\.sn-page[^{]*\{[^}]*\}/g)!) assert.doesNotMatch(rule, /pointer-events|user-select/, rule);
});

// A host may let something else place the page elements (a framework's router
// outlet inserts them where it likes), so which page is on top cannot depend
// on document order.
test('the upper page paints above the lower by z-index, inside the container', () => {
  assert.match(STACKNAV_CSS, /\.sn-container\{[^}]*isolation:isolate[^}]*\}/, 'the container is its own stacking context');
  assert.match(STACKNAV_CSS, /\.sn-page-upper\{z-index:1\}/);
});
