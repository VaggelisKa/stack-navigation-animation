import { easings, prefersReducedMotion, type Easing } from './animate.ts';
import type { SettleInput, StackEntry, Transition } from './navigation-stack.ts';

export interface IOSTransitionOptions {
  /** ms, programmatic push/pop */
  duration: number;
  /** fraction of the width the lower page travels */
  parallax: number;
  dimColor: string;
  /** lower-page overlay opacity at p = 1 (≈0.35 reads well on dark UIs) */
  dimMax: number;
  /** box-shadow on the incoming page */
  shadow: string;
  /** ms bounds for finishing an interactive pop */
  settleMin: number;
  settleMax: number;
  /** px/s assumed when the finger was slower than this */
  settleVelocityFloor: number;
  /** multiplies every duration (slow motion / tests) */
  timeScale: number;
}

export interface IOSTransition extends Transition {
  readonly options: IOSTransitionOptions;
}

const DIM = Symbol('dim');
type Dimmable = StackEntry & { [DIM]?: HTMLElement };

/**
 * The iOS navigation look: the upper page slides in from the trailing edge
 * with a soft shadow on its leading edge; the lower page parallaxes toward
 * the leading edge and dims. Everything is a function of one number, p.
 */
export function createIOSTransition(options: Partial<IOSTransitionOptions> = {}): IOSTransition {
  const o: IOSTransitionOptions = {
    duration: 500,
    parallax: 0.3,
    dimColor: '#000',
    dimMax: 0.1,
    shadow: '-3px 0 14px rgba(0,0,0,0.16)',
    settleMin: 120,
    settleMax: 400,
    settleVelocityFloor: 900,
    timeScale: 1,
    ...options,
  };

  const dimOf = (entry: Dimmable): HTMLElement => {
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
    get duration(): number {
      return prefersReducedMotion() ? 0 : o.duration * o.timeScale;
    },
    ease: easings.ios as Easing,

    /** How long the remaining distance of an interactive pop should take. */
    settle({ remainingPx, velocity }: SettleInput) {
      if (prefersReducedMotion()) return { duration: 0, ease: easings.easeOut };
      const raw = (remainingPx / Math.max(Math.abs(velocity), o.settleVelocityFloor)) * 1000;
      return { duration: Math.min(o.settleMax, Math.max(o.settleMin, raw)) * o.timeScale, ease: easings.easeOut };
    },

    begin(lower, upper) {
      upper.el.style.boxShadow = o.shadow;
      if (lower) dimOf(lower);
    },
    apply(lower, upper, p) {
      const w = upper.el.parentElement?.clientWidth ?? 0;
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
        const d = (lower as Dimmable)[DIM];
        if (d) d.remove();
      }
    },
  };
}
