/**
 * The only styles the engine needs. These cover layout and the motion itself,
 * not appearance: the look lives in the transition and is tuned through the
 * `--sn-*` custom properties (see `NATIVE_TRANSITION_CSS_VARS` and the README).
 * Those properties are documented but deliberately not declared, because
 * leaving one unset is what makes its JS default apply.
 *
 * The engine does not animate the pages; the browser does. Each phase it
 * writes `--sn-t` and `--sn-e` on the container — the duration and curve in
 * force right now — and then writes where the pages should end up. While a
 * pointer is down `--sn-t` is `0s`, so the page lands exactly where the
 * pointer puts it; for a push, a pop or the settle after a release it is that
 * phase's length and `transition` runs it out, on the compositor.
 *
 * The string is kept minified because it ships inside every consumer's JS
 * bundle (`injectStyles()` is the default path); `scripts/write-css.mjs`
 * expands it into the readable `dist/stacknav.css`.
 *
 * The whole sheet sits in `@layer stacknav`. `injectStyles()` appends it to the
 * end of `<head>`, so without a layer it would land after the app's own
 * stylesheets and win every tie on order. Layered rules lose to unlayered ones
 * whatever their specificity or position, so an app restyling `.sn-page` needs
 * no `!important` and no load-order care. An app that puts its own CSS in
 * layers should declare the order itself, `@layer stacknav, app;`, so that its
 * layer comes after this one. Nothing here relies on winning against the app:
 * the one `!important` in the sheet, on `--sn-t` under
 * `prefers-reduced-motion`, is aimed at the inline style the engine writes, and
 * an `!important` author declaration beats a normal inline one from any layer.
 *
 * What each rule is for:
 *
 * Nothing the engine toggles per phase may change an inherited property, or a
 * custom property, that the pages' content can see. Custom properties inherit,
 * and so do `pointer-events` and `user-select`, and a change to any of them on
 * an ancestor makes the browser re-resolve the style of every element beneath:
 * every row of every page kept in the stack, hidden ones included, twice per
 * transition. That was measured at more than a hundred milliseconds of
 * main-thread work on an eight-deep stack of heavy pages, at the very moment
 * the animation was meant to start. Hence the barrier rule and the shield below.
 *
 * - `.sn-container`: the stack's scroll-clipping frame, and a stacking context
 *   of its own, so that the `z-index` below stays among the pages.
 * - `.sn-container:dir(rtl)`: reading direction is a CSS question, so the
 *   transform the engine writes is signed by `--sn-dir` rather than by JS.
 *   `:dir()` is the right test -- it asks for the element's own resolved
 *   directionality, however it was arrived at, `dir=auto` on a page of Arabic
 *   text included -- but it only landed in Chrome 120 and Safari 16.4, while
 *   the floor this package supports is the cascade layers one, Chrome 99 /
 *   Safari 15.4 / Firefox 97. Between the two there are browsers that keep the
 *   sheet and silently drop this rule, and an RTL stack there swipes and pushes
 *   the wrong way, so the `dir=rtl` attribute -- how all but a handful of apps
 *   declare it -- gets a rule of its own for them, matching the container
 *   either carrying the attribute or sitting under one that does, since the
 *   attribute does not inherit the way the direction it sets does.
 * - `@supports not selector(:dir(rtl))`: that fallback, and only where the
 *   real test is missing. It has to be a rule of its own -- an unknown
 *   pseudo-class invalidates the entire selector list it appears in, so
 *   combining the two would drop the fallback on exactly the browsers it is
 *   for -- and being a separate rule it cannot be overridden by a `:dir()`
 *   rule that does not match. An attribute is a coarser question than the
 *   pseudo-class answers: `dir=auto` never matches it, and a `dir=ltr` island
 *   inside an RTL page matches the descendant form even though the container
 *   reads LTR. The `@supports` guard keeps that approximation from reaching
 *   browsers that can do better. Its own support (Chrome 83, Safari 14.1,
 *   Firefox 69) is below the floor, so no supported browser loses the rule.
 * - `.sn-page`: absolutely fills the container and is its own scroll container.
 *   `visibility: hidden` keeps pages beneath the top
 *   mounted (scroll position, form state) but out of sight and out of the
 *   accessibility tree. The identity transform is the resting state, and the
 *   containing block the dim overlay is positioned against.
 * - `.sn-scroll-document`: a stack the document scrolls (`scroll: 'document'`).
 *   The container stops being a scroll container -- `overflow: hidden` would
 *   make it what a page's sticky header sticks to, and what `focus()` scrolls
 *   -- and clips with `contain: paint` instead, which also keeps the tall
 *   content of the hidden pages out of the document's scrollable overflow. Its
 *   pages do not scroll either, and the one on top at rest -- visible and in no
 *   transition -- is the only one in the flow, so it gives the container its
 *   height and the document scrolls it.
 * - `:where(.sn-page)>*`: the barrier. A page itself reads `--sn-t` / `--sn-e`
 *   off the container, but its children pin them, so a phase starting is a
 *   style change to a handful of elements rather than to the whole stack.
 *   A stylesheet that wants the values inside its own pages lifts the barrier
 *   with `.sn-page > * { --sn-t: inherit; --sn-e: inherit }` and pays that cost
 *   knowingly; unlayered, that rule wins on the layer alone. `:where()` keeps
 *   the rule at zero specificity so it also loses to anything an app writes
 *   inside its own layer, once that layer is ordered after `stacknav`.
 * - `.sn-page-visible`: the top page, and both pages during a transition.
 * - `.sn-page-upper` / `.sn-page-lower`: the two pages taking part in the
 *   transition in flight. Only these transition, and only these are promoted,
 *   so a deep stack costs nothing at rest. Both `transform` and `opacity` are
 *   listed, so a transition of your own can fade a page as well as move it and
 *   still be run by the browser; the iOS look only ever changes `transform`
 *   (the Android look fades as well), and a property that does not change
 *   starts no transition. The upper page paints above the lower by `z-index`,
 *   not by document order, so a host that lets something else place the page
 *   elements (a framework's router outlet) need not keep them sorted.
 * - `.sn-page-android-fade`: Android's alpha animation takes 83 ms of the
 *   450 ms slide and is linear. Sharing the slide's duration and curve leaves
 *   the outgoing content visible through the incoming page for too long.
 *   Deriving the fade duration from `--sn-t` also scales slow motion, settling,
 *   and reduced motion, and keeps interactive updates immediate.
 * - `.sn-dim`: the overlay the lower page dims behind. CSS resolves its colour;
 *   the transition supplies a fallback colour and writes its opacity. It sits
 *   inside a page, so it inherits the timing back through the barrier.
 * - `.sn-busy::after`: a shield over the container while an operation is in
 *   flight, so no click lands on a page mid-transition and a drag does not
 *   select the text under it. Pointer events hit the shield and target the
 *   container, as they did when the pages had `pointer-events: none`, but the
 *   pages' style is untouched.
 * - `prefers-reduced-motion`: forces the phase duration to zero in CSS. The
 *   `!important` is intentional: it must override the inline `--sn-t` written
 *   by the engine, including when the preference changes during a transition.
 *   Being in a layer does not weaken it. Layers only order normal declarations
 *   (and, in reverse, important ones); an important author declaration outranks
 *   a normal inline style wherever it is declared.
 */
export const STACKNAV_CSS =
  '@layer stacknav{' +
  '.sn-container{position:relative;overflow:hidden;isolation:isolate}' +
  '.sn-container:dir(rtl){--sn-dir:-1}' +
  '@supports not selector(:dir(rtl)){[dir=rtl] .sn-container,.sn-container[dir=rtl]{--sn-dir:-1}}' +
  '.sn-page{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;visibility:hidden;transform:translate3d(0,0,0)}' +
  '.sn-scroll-document{overflow:visible;contain:paint}' +
  '.sn-scroll-document>.sn-page{overflow:visible}' +
  '.sn-scroll-document>.sn-page-visible:not(.sn-page-upper,.sn-page-lower){position:relative;inset:auto}' +
  ':where(.sn-page)>*{--sn-t:0s;--sn-e:linear}' +
  '.sn-page-visible{visibility:visible}' +
  '.sn-page-upper,.sn-page-lower{will-change:transform;transition-property:transform,opacity;transition-duration:var(--sn-t,0s);transition-timing-function:var(--sn-e,linear)}' +
  '.sn-page-upper{z-index:1}' +
  '.sn-page-upper.sn-page-android-fade{transition-duration:var(--sn-t,0s),calc(var(--sn-t,0s) * 83 / 450);transition-timing-function:var(--sn-e,linear),linear}' +
  '.sn-dim{position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:var(--sn-dim-color,var(--sn-dim-fallback,#000));opacity:0;--sn-t:inherit;--sn-e:inherit;transition:opacity var(--sn-t,0s) var(--sn-e,linear)}' +
  '.sn-busy::after{content:"";position:absolute;inset:0;z-index:2147483647;user-select:none;-webkit-user-select:none}' +
  '@media(prefers-reduced-motion:reduce){.sn-container{--sn-t:0s!important}}' +
  '}';

export const STACKNAV_STYLE_ID = 'stacknav-styles';

/** Where the stylesheet can go: a document's head, or a shadow root. */
export type StyleTarget = Document | ShadowRoot;

export interface InjectStylesOptions {
  /** Goes on the `<style>` element, for pages served with a strict `style-src`. */
  nonce?: string | null;
}

/** One constructed sheet per document, shared by every shadow root in it. */
const sheets = /*#__PURE__*/ new WeakMap<Document, CSSStyleSheet>();

const isDocument = (target: StyleTarget): target is Document => 'createElement' in target;

/**
 * Inserts the engine's stylesheet into `target` once. Framework ports call this
 * so apps need no stylesheet import. Apps that ship `stacknav.css` themselves
 * can skip it.
 *
 * A document gets a `<style id="stacknav-styles">` in its head, carrying
 * `options.nonce` when one is given. A shadow root, whose contents the document
 * head cannot reach, gets a constructed sheet through `adoptedStyleSheets`, or
 * the same `<style>` element where that is unsupported. Injecting twice into
 * the same target does nothing the second time.
 */
export function injectStyles(
  target: StyleTarget | null = typeof document === 'undefined' ? null : document,
  options: InjectStylesOptions = {},
): void {
  if (!target || target.getElementById(STACKNAV_STYLE_ID)) return;
  const doc = isDocument(target) ? target : target.ownerDocument;
  // Constructed in the target's own realm; a sheet from another one cannot be
  // adopted. A document without a window (`createHTMLDocument()`) has no realm
  // to construct one in, so it takes the `<style>` element instead.
  const Sheet = doc.defaultView?.CSSStyleSheet;
  if (!isDocument(target) && target.adoptedStyleSheets && Sheet) {
    let sheet = sheets.get(doc);
    if (!sheet) {
      sheet = new Sheet();
      sheet.replaceSync(STACKNAV_CSS);
      sheets.set(doc, sheet);
    }
    if (!target.adoptedStyleSheets.includes(sheet))
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    return;
  }
  const style = doc.createElement('style');
  style.id = STACKNAV_STYLE_ID;
  if (options.nonce) style.setAttribute('nonce', options.nonce);
  style.textContent = STACKNAV_CSS;
  (isDocument(target) ? (target.head ?? target.documentElement) : target).append(style);
}
