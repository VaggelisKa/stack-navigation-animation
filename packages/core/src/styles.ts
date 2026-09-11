/**
 * The engine's stylesheet. It is layout *and* motion: the browser, not
 * JavaScript, interpolates every page.
 *
 * The engine writes two custom properties on the container — `--sn-t` and
 * `--sn-e`, the duration and curve of the phase in flight — and the two
 * endpoint transforms. While a finger is down `--sn-t` is `0s`, so the page
 * sits exactly where the finger puts it; for a timed push, pop or settle it
 * is the phase's duration, and `transition` does the rest on the compositor.
 *
 * Everything else below is yours to override. Theme nothing here.
 */
export const STACKNAV_CSS = `
.sn-container {
  position: relative;
  overflow: hidden;

  /* geometry */
  --sn-parallax: 0.3;            /* how far the lower page travels, as a fraction of the width */
  --sn-dir: 1;                   /* which way is forward; flipped for right-to-left */

  /* paint */
  --sn-dim: 0.1;                 /* the lower page's overlay at full open (0.35 reads well on dark UIs) */
  --sn-dim-color: #000;
  --sn-shadow: -3px 0 14px rgba(0, 0, 0, 0.16);

  /* gesture */
  --sn-edge-width: 28px;         /* the leading-edge strip that starts a swipe back */

  /* written by the engine, per phase */
  --sn-t: 0s;
  --sn-e: linear;
}

.sn-container:dir(rtl) {
  --sn-dir: -1;
  --sn-shadow: 3px 0 14px rgba(0, 0, 0, 0.16);
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
  transform: translate3d(0, 0, 0); /* the resting state, and the containing block the dim sits in */
}
.sn-page-visible { visibility: visible; }

/* The two pages taking part in the transition in flight. Only these are
   promoted and only these transition, so a deep stack costs nothing at rest. */
.sn-page-upper,
.sn-page-lower {
  will-change: transform;
  transition: transform var(--sn-t) var(--sn-e);
}
.sn-page-upper { box-shadow: var(--sn-shadow); }

.sn-dim {
  position: fixed;             /* the page's transform is its containing block: this covers the page */
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  background: var(--sn-dim-color);
  opacity: 0;
  transition: opacity var(--sn-t) var(--sn-e);
}

.sn-edge {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: var(--sn-edge-width);
  z-index: 10;
  touch-action: none;
}
/* Nothing to go back to, or the whole page is the target: no strip. */
.sn-container:not(.sn-can-pop) .sn-edge,
.sn-container.sn-anywhere .sn-edge { display: none; }

/* While a transition or a drag is in flight. */
.sn-busy { user-select: none; -webkit-user-select: none; }
.sn-busy .sn-page { pointer-events: none; }

@media (prefers-reduced-motion: reduce) {
  .sn-container { --sn-t: 0s !important; }
}
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
