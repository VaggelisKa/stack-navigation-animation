/** The only styles the engine needs. Theme nothing here; it is layout. */
export const STACKNAV_CSS = `
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
  touch-action: pan-y;         /* vertical scroll stays native; horizontal drags reach the gesture */
  visibility: hidden;          /* pages beneath the top stay mounted (keeping scroll etc.) but hidden */
  will-change: transform;
}
.sn-page-visible { visibility: visible; }
.sn-busy .sn-page { pointer-events: none; }
`;

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
