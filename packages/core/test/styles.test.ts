import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeCSSStyleSheet, makeDocument, makeShadowRoot } from './dom-stub.ts';
import { STACKNAV_CSS, STACKNAV_STYLE_ID, injectStyles } from '../src/styles.ts';

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

// `:dir()` is newer than the sheet's floor (Chrome 120 / Safari 16.4 against
// Chrome 99 / Safari 15.4), and a browser in between keeps the layer and drops
// the rule, so an RTL stack there would push and swipe the wrong way. The
// attribute fallback covers it, but it has to be a rule of its own: an unknown
// pseudo-class invalidates the whole selector list it is written in.
test('reading direction has an attribute fallback for browsers without :dir()', () => {
  assert.match(STACKNAV_CSS, /\.sn-container:dir\(rtl\)\{--sn-dir:-1\}/);
  const fallback = STACKNAV_CSS.match(
    /@supports not selector\(:dir\(rtl\)\)\{([^{]*)\{--sn-dir:-1\}\}/,
  );
  assert.ok(
    fallback,
    'the fallback is guarded by @supports, so it never overrides a :dir() that works',
  );
  // Both shapes: `dir` does not inherit the way the direction it sets does, so
  // the container may carry the attribute or sit under something that does.
  assert.deepEqual(fallback[1].split(','), ['[dir=rtl] .sn-container', '.sn-container[dir=rtl]']);
  assert.doesNotMatch(
    fallback[1],
    /:dir\(/,
    'no pseudo-class in the fallback selector list: one unknown item drops all of it',
  );
});

test('the stylesheet disables browser-owned transitions for reduced motion', () => {
  assert.match(
    STACKNAV_CSS,
    /@media\(prefers-reduced-motion:reduce\)\{\.sn-container\{--sn-t:0s!important\}\}/,
  );
  // `!important` outranks the engine's inline `--sn-t` from inside the layer
  // too: layers order normal declarations, and an important author declaration
  // beats a normal inline one wherever it is declared.
  assert.match(STACKNAV_CSS, /--sn-t:0s!important/);
});

// A stack the document scrolls must not be a scroll container itself -- it
// would catch a page's sticky headers and the `focus()` scrolls that belong to
// the viewport -- but it still has to clip, or the tall content of the hidden
// pages is the document's to scroll through.
test('document scrolling takes the container out of scrolling and puts the resting top page in the flow', () => {
  assert.match(STACKNAV_CSS, /\.sn-scroll-document\{overflow:visible;contain:paint\}/);
  assert.match(STACKNAV_CSS, /\.sn-scroll-document>\.sn-page\{overflow:visible\}/);
  assert.match(
    STACKNAV_CSS,
    /\.sn-scroll-document>\.sn-page-visible:not\(\.sn-page-upper,\.sn-page-lower\)\{position:relative;inset:auto\}/,
  );
  // Later in the sheet than the rules they override, at higher specificity anyway.
  assert.ok(STACKNAV_CSS.indexOf('.sn-scroll-document{') > STACKNAV_CSS.indexOf('.sn-container{'));
  assert.ok(
    STACKNAV_CSS.indexOf('.sn-scroll-document>.sn-page{') > STACKNAV_CSS.indexOf('.sn-page{'),
  );
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
  assert.match(
    STACKNAV_CSS,
    /:where\(\.sn-page\)>\*\{--sn-t:0s;--sn-e:linear\}/,
    'a zero-specificity barrier an app can lift',
  );
  assert.match(STACKNAV_CSS, /\.sn-dim\{[^}]*--sn-t:inherit;--sn-e:inherit;[^}]*\}/);
  assert.match(
    STACKNAV_CSS,
    /\.sn-page-upper,\.sn-page-lower\{[^}]*transition-duration:var\(--sn-t,0s\)/,
    'the page itself still runs on the container timing',
  );
});

test('busy blocks input with a shield, not with inherited properties on the pages', () => {
  assert.match(
    STACKNAV_CSS,
    /\.sn-busy::after\{content:"";position:absolute;inset:0;z-index:2147483647;user-select:none/,
  );
  assert.doesNotMatch(STACKNAV_CSS, /\.sn-busy \.sn-page/);
  assert.doesNotMatch(STACKNAV_CSS, /\.sn-busy\{/);
  for (const rule of STACKNAV_CSS.match(/\.sn-page[^{]*\{[^}]*\}/g)!)
    assert.doesNotMatch(rule, /pointer-events|user-select/, rule);
});

// A host may let something else place the page elements (a framework's router
// outlet inserts them where it likes), so which page is on top cannot depend
// on document order.
test('the upper page paints above the lower by z-index, inside the container', () => {
  assert.match(
    STACKNAV_CSS,
    /\.sn-container\{[^}]*isolation:isolate[^}]*\}/,
    'the container is its own stacking context',
  );
  assert.match(STACKNAV_CSS, /\.sn-page-upper\{z-index:1\}/);
});

// ------------------------------------------------------------- injectStyles
const stylesIn = (root: any) => root.children.filter((c: any) => c.tagName === 'STYLE');

const docWithConstructedSheets = () => {
  const doc = makeDocument();
  doc.defaultView = { CSSStyleSheet: FakeCSSStyleSheet };
  return doc;
};

test('a document gets one style element in its head', () => {
  const doc = makeDocument();
  injectStyles(doc);
  injectStyles(doc);
  const found = stylesIn(doc.head);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, STACKNAV_STYLE_ID);
  assert.equal(found[0].textContent, STACKNAV_CSS);
  assert.equal(found[0].attrs.nonce, undefined);
});

test('the default target is the ambient document', () => {
  const doc = makeDocument();
  const previous = (globalThis as any).document;
  (globalThis as any).document = doc;
  try {
    injectStyles();
  } finally {
    (globalThis as any).document = previous;
  }
  assert.equal(stylesIn(doc.head).length, 1);
});

test('a nonce lands on the style element, for a strict style-src', () => {
  const doc = makeDocument();
  injectStyles(doc, { nonce: 'r4nd0m' });
  injectStyles(doc, { nonce: 'r4nd0m' });
  const found = stylesIn(doc.head);
  assert.equal(found.length, 1);
  assert.equal(found[0].attrs.nonce, 'r4nd0m');
});

test('a shadow root that supports adoptedStyleSheets adopts a constructed sheet', () => {
  const doc = docWithConstructedSheets();
  const root = makeShadowRoot(doc, { adoptedStyleSheets: true });
  injectStyles(root);
  injectStyles(root);
  assert.equal(root.adoptedStyleSheets.length, 1);
  assert.equal(root.adoptedStyleSheets[0].cssText, STACKNAV_CSS);
  assert.equal(stylesIn(root).length, 0, 'no element is appended when the sheet can be adopted');
});

test('shadow roots in one document share the sheet, and keep what was adopted before', () => {
  const doc = docWithConstructedSheets();
  const a = makeShadowRoot(doc, { adoptedStyleSheets: true });
  const b = makeShadowRoot(doc, { adoptedStyleSheets: true });
  const theirs = new FakeCSSStyleSheet();
  b.adoptedStyleSheets = [theirs];
  injectStyles(a);
  injectStyles(b);
  assert.equal(b.adoptedStyleSheets.length, 2);
  assert.equal(b.adoptedStyleSheets[0], theirs);
  assert.equal(b.adoptedStyleSheets[1], a.adoptedStyleSheets[0]);
});

test('a shadow root without adoptedStyleSheets gets a style element of its own', () => {
  const doc = makeDocument();
  const root = makeShadowRoot(doc);
  injectStyles(root, { nonce: 'r4nd0m' });
  injectStyles(root, { nonce: 'r4nd0m' });
  const found = stylesIn(root);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, STACKNAV_STYLE_ID);
  assert.equal(found[0].textContent, STACKNAV_CSS);
  assert.equal(found[0].attrs.nonce, 'r4nd0m');
  assert.equal(stylesIn(doc.head).length, 0, 'the document head is left alone');
});

test('a shadow root in a windowless document gets a style element, not a foreign sheet', () => {
  // `createHTMLDocument()` has no window, so there is no realm to construct a sheet in.
  const doc = makeDocument();
  const root = makeShadowRoot(doc, { adoptedStyleSheets: true });
  assert.doesNotThrow(() => injectStyles(root));
  assert.equal(root.adoptedStyleSheets.length, 0);
  assert.equal(stylesIn(root).length, 1);
});

test('no target is a no-op, as on a server', () => {
  assert.doesNotThrow(() => injectStyles(null));
});
