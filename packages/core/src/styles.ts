/**
 * The only styles the engine needs. These cover layout and the motion itself,
 * not appearance: the look lives in the transition and is tuned through the
 * `--sn-*` custom properties (see `IOS_TRANSITION_CSS_VARS` and the README).
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
 * - `.sn-container`: the stack's scroll-clipping frame.
 * - `.sn-container:dir(rtl)`: reading direction is a CSS question, so the
 *   transform the engine writes is signed by `--sn-dir` rather than by JS.
 * - `.sn-page`: absolutely fills the container and is its own scroll container.
 *   `touch-action: pan-y` keeps vertical scrolling native while horizontal
 *   drags reach the gesture; `visibility: hidden` keeps pages beneath the top
 *   mounted (scroll position, form state) but out of sight and out of the
 *   accessibility tree. The identity transform is the resting state, and the
 *   containing block the dim overlay is positioned against.
 * - `.sn-page-visible`: the top page, and both pages during a transition.
 * - `.sn-page-upper` / `.sn-page-lower`: the two pages taking part in the
 *   transition in flight. Only these transition, and only these are promoted,
 *   so a deep stack costs nothing at rest. Both `transform` and `opacity` are
 *   listed, so a transition of your own can fade a page as well as move it and
 *   still be run by the browser; the iOS look only ever changes `transform`,
 *   and a property that does not change starts no transition.
 * - `.sn-dim`: the overlay the lower page dims behind. CSS resolves its colour;
 *   the transition supplies a fallback colour and writes its opacity.
 * - `.sn-edge`: the strip the swipe-back gesture listens on. `inset-inline-start`
 *   puts it on the leading edge in either reading direction; its width is the
 *   gesture's `edgeWidth` option, and whether it is shown at all follows from
 *   the container's classes.
 * - `.sn-busy`: no clicks land on a page that is mid-transition, and a drag
 *   does not select the text under it.
 */
export const STACKNAV_CSS =
  '.sn-container{position:relative;overflow:hidden}' +
  '.sn-container:dir(rtl){--sn-dir:-1}' +
  '.sn-page{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;touch-action:pan-y;visibility:hidden;transform:translate3d(0,0,0)}' +
  '.sn-page-visible{visibility:visible}' +
  '.sn-page-upper,.sn-page-lower{will-change:transform;transition-property:transform,opacity;transition-duration:var(--sn-t,0s);transition-timing-function:var(--sn-e,linear)}' +
  '.sn-dim{position:fixed;inset:0;z-index:2147483647;pointer-events:none;background:var(--sn-dim-color,var(--sn-dim-fallback,#000));opacity:0;transition:opacity var(--sn-t,0s) var(--sn-e,linear)}' +
  '.sn-edge{position:absolute;inset-block:0;inset-inline-start:0;z-index:10;touch-action:none}' +
  '.sn-container:not(.sn-can-pop) .sn-edge,.sn-container.sn-anywhere .sn-edge{display:none}' +
  '.sn-busy{user-select:none;-webkit-user-select:none}' +
  '.sn-busy .sn-page{pointer-events:none}';

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
