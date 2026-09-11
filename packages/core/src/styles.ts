/**
 * The only styles the engine needs. These cover layout, not appearance: the
 * look lives in the transition and is tuned through the custom properties
 * listed below. Those properties are documented here but deliberately not
 * declared, because leaving one unset is what makes its JS default apply.
 */
export const STACKNAV_CSS = `
/* Tune the iOS transition by setting these on .sn-container or any ancestor:
     --sn-duration: 500ms;                        push/pop length
     --sn-easing: cubic-bezier(0.32, 0.72, 0, 1); its curve: a cubic-bezier, a keyword, or ios
     --sn-parallax: 30%;                          how far the page beneath travels
     --sn-dim-color: #000;                        overlay on the page beneath
     --sn-dim-max: 10%;                           its opacity at full open
     --sn-shadow: -3px 0 14px rgba(0,0,0,0.16);   on the incoming page; none to remove it
     --sn-settle-min: 120ms;                      bounds for finishing a swipe
     --sn-settle-max: 400ms;
     --sn-settle-easing: ios-settle;              the curve a released swipe finishes on
     --sn-settle-velocity-floor: 900;             px/s assumed when the pointer was slower
     --sn-time-scale: 1;                          multiplies every duration */
.sn-container {
  position: relative;
  overflow: hidden;
}
.sn-page {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  touch-action: pan-y;         /* vertical scrolling stays native, horizontal drags reach the gesture */
  visibility: hidden;          /* pages beneath the top stay mounted, keeping scroll and state, but hidden */
  will-change: transform;
}
.sn-page-visible { visibility: visible; }
.sn-busy .sn-page { pointer-events: none; }
`;

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
