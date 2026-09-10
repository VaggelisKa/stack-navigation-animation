import { easings, prefersReducedMotion } from './animate.js';

/**
 * The iOS navigation look: the upper page slides in from the trailing edge
 * with a soft shadow on its leading edge; the lower page parallaxes toward
 * the leading edge and dims. Everything is a function of one number, p.
 */
export function createIOSTransition(options = {}) {
  const o = {
    duration: 500, // ms, programmatic push/pop
    parallax: 0.3, // fraction of width the lower page travels
    dimColor: '#000',
    dimMax: 0.1, // lower-page overlay opacity at p = 1 (≈0.35 reads well on dark UIs)
    shadow: '-3px 0 14px rgba(0,0,0,0.16)',
    settleMin: 120, // ms bounds for finishing an interactive pop
    settleMax: 400,
    settleVelocityFloor: 900, // px/s assumed when the finger was slower than this
    timeScale: 1, // multiplies every duration (slow motion / tests)
    ...options,
  };

  const DIM = Symbol('dim');
  const dimOf = (entry) => {
    let d = entry[DIM];
    if (!d) {
      d = document.createElement('div');
      d.setAttribute('aria-hidden', 'true');
      Object.assign(d.style, { position: 'fixed', inset: '0', pointerEvents: 'none', opacity: '0', zIndex: '2147483647' });
      entry[DIM] = d;
    }
    d.style.background = o.dimColor;
    if (d.parentElement !== entry.el) entry.el.append(d);
    return d;
  };

  return {
    options: o,
    get duration() {
      return prefersReducedMotion() ? 0 : o.duration * o.timeScale;
    },
    ease: easings.ios,

    /** How long the remaining distance of an interactive pop should take. */
    settle({ remainingPx, velocity }) {
      if (prefersReducedMotion()) return { duration: 0, ease: easings.easeOut };
      const raw = (remainingPx / Math.max(Math.abs(velocity), o.settleVelocityFloor)) * 1000;
      return { duration: Math.min(o.settleMax, Math.max(o.settleMin, raw)) * o.timeScale, ease: easings.easeOut };
    },

    begin(lower, upper) {
      upper.el.style.boxShadow = o.shadow;
      if (lower) dimOf(lower);
    },
    apply(lower, upper, p) {
      const w = upper.el.parentElement.clientWidth;
      upper.el.style.transform = `translate3d(${(1 - p) * w}px,0,0)`;
      if (lower) {
        lower.el.style.transform = `translate3d(${-p * o.parallax * w}px,0,0)`;
        dimOf(lower).style.opacity = String(p * o.dimMax);
      }
    },
    end(lower, upper) {
      upper.el.style.boxShadow = '';
      upper.el.style.transform = '';
      if (lower) {
        lower.el.style.transform = '';
        const d = lower[DIM];
        if (d) d.remove();
      }
    },
  };
}
