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
 * expands it into the readable `dist/stacknav.css`. What each rule is for:
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
 * - `.sn-container`: the stack's scroll-clipping frame.
 * - `.sn-container:dir(rtl)`: reading direction is a CSS question, so the
 *   transform the engine writes is signed by `--sn-dir` rather than by JS.
 * - `.sn-page`: absolutely fills the container and is its own scroll container.
 *   `visibility: hidden` keeps pages beneath the top
 *   mounted (scroll position, form state) but out of sight and out of the
 *   accessibility tree. The identity transform is the resting state, and the
 *   containing block the dim overlay is positioned against.
 * - `:where(.sn-page)>*`: the barrier. A page itself reads `--sn-t` / `--sn-e`
 *   off the container, but its children pin them, so a phase starting is a
 *   style change to a handful of elements rather than to the whole stack.
 *   `:where()` gives the rule no specificity, so a stylesheet that wants the
 *   values inside its own pages can lift the barrier with
 *   `.sn-page > * { --sn-t: inherit; --sn-e: inherit }` and pay that cost
 *   knowingly.
 * - `.sn-page-visible`: the top page, and both pages during a transition.
 * - `.sn-page-upper` / `.sn-page-lower`: the two pages taking part in the
 *   transition in flight. Only these transition, and only these are promoted,
 *   so a deep stack costs nothing at rest. Both `transform` and `opacity` are
 *   listed, so a transition of your own can fade a page as well as move it and
 *   still be run by the browser; the iOS look only ever changes `transform`
 *   (the Android look fades as well), and a property that does not change
 *   starts no transition.
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
 */
export const STACKNAV_CSS =
  '.sn-container{position:relative;overflow:hidden}' +
  '.sn-container:dir(rtl){--sn-dir:-1}' +
  '.sn-page{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;visibility:hidden;transform:translate3d(0,0,0)}' +
  ':where(.sn-page)>*{--sn-t:0s;--sn-e:linear}' +
  '.sn-page-visible{visibility:visible}' +
  '.sn-page-upper,.sn-page-lower{will-change:transform;transition-property:transform,opacity;transition-duration:var(--sn-t,0s);transition-timing-function:var(--sn-e,linear)}' +
  '.sn-dim{position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:var(--sn-dim-color,var(--sn-dim-fallback,#000));opacity:0;--sn-t:inherit;--sn-e:inherit;transition:opacity var(--sn-t,0s) var(--sn-e,linear)}' +
  '.sn-busy::after{content:"";position:absolute;inset:0;z-index:2147483647;user-select:none;-webkit-user-select:none}' +
  '@media(prefers-reduced-motion:reduce){.sn-container{--sn-t:0s!important}}';

export const STACKNAV_STYLE_ID = 'stacknav-styles';

/**
 * Inserts the engine's stylesheet into `doc` once. Framework ports call this so
 * apps need no stylesheet import. Apps that ship `stacknav.css` themselves can
 * skip it.
 */
export function injectStyles(doc: Document | null = typeof document === 'undefined' ? null : document): void {
  if (!doc || doc.getElementById(STACKNAV_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STACKNAV_STYLE_ID;
  style.textContent = STACKNAV_CSS;
  (doc.head ?? doc.documentElement).append(style);
}
