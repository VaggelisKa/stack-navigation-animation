/**
 * The only styles the engine needs. Theme nothing here; it is layout — the
 * look lives in the transition, tunable through the `--sn-*` custom properties
 * (see `IOS_TRANSITION_CSS_VARS` and the README). They are documented, not
 * declared: leaving them unset is what makes the JS defaults apply, so set one
 * only where you mean to override.
 *
 * The string is kept minified because it ships inside every consumer's JS
 * bundle (`injectStyles()` is the default path); `scripts/write-css.mjs`
 * expands it into the readable `dist/stacknav.css`. What each rule is for:
 *
 * - `.sn-container`: the stack's scroll-clipping frame.
 * - `.sn-page`: absolutely fills the container and is its own scroll container.
 *   `touch-action: pan-y` keeps vertical scrolling native while horizontal
 *   drags reach the gesture; `visibility: hidden` keeps pages beneath the top
 *   mounted (scroll position, form state) but out of sight and out of the
 *   accessibility tree.
 * - `.sn-page-visible`: the top page, and both pages during a transition.
 * - `.sn-busy .sn-page`: no clicks land on a page that is mid-transition.
 */
export const STACKNAV_CSS =
  '.sn-container{position:relative;overflow:hidden}' +
  '.sn-page{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;touch-action:pan-y;visibility:hidden;will-change:transform}' +
  '.sn-page-visible{visibility:visible}' +
  '.sn-busy .sn-page{pointer-events:none}';

export const STACKNAV_STYLE_ID = 'stacknav-styles';

/**
 * Inserts the engine's stylesheet into `doc` once. Framework ports call this
 * so apps need no stylesheet import; apps that ship `stacknav.css` themselves
 * can skip it.
 */
export function injectStyles(doc: Document | null = typeof document === 'undefined' ? null : document): void {
  if (!doc || doc.getElementById(STACKNAV_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STACKNAV_STYLE_ID;
  style.textContent = STACKNAV_CSS;
  (doc.head ?? doc.documentElement).append(style);
}
