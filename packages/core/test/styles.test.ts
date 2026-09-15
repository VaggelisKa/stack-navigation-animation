import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STACKNAV_CSS } from '../src/styles.ts';

// The sheet is appended to the end of <head>, so without a layer it would beat
// an app rule of equal specificity on order alone. One layer, wrapping
// everything, keeps unlayered app CSS in charge.
test('the whole sheet is one cascade layer', () => {
  assert.ok(STACKNAV_CSS.startsWith('@layer stacknav{'), STACKNAV_CSS.slice(0, 40));
  assert.ok(STACKNAV_CSS.endsWith('}'));
  assert.equal(STACKNAV_CSS.match(/@layer/g)!.length, 1, 'the sheet is not split across layers');
  // Nothing between the braces escapes the layer: the rules balance on their
  // own, so the closing brace is the layer's.
  let depth = 0;
  for (const [i, char] of [...STACKNAV_CSS.slice('@layer stacknav{'.length, -1)].entries()) {
    if (char === '{') depth++;
    else if (char === '}') depth--;
    assert.ok(depth >= 0, `left the layer at index ${i}`);
  }
  assert.equal(depth, 0, 'the rules inside the layer balance');
});

test('the stylesheet disables browser-owned transitions for reduced motion', () => {
  assert.match(STACKNAV_CSS, /@media\(prefers-reduced-motion:reduce\)\{\.sn-container\{--sn-t:0s!important\}\}/);
  // `!important` outranks the engine's inline `--sn-t` from inside the layer
  // too: layers order normal declarations, and an important author declaration
  // beats a normal inline one wherever it is declared.
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
