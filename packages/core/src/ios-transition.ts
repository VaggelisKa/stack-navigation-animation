import { easings, prefersReducedMotion, type Easing } from './animate.ts';
import type { SettleInput, StackEntry, Transition } from './navigation-stack.ts';

export interface IOSTransitionOptions {
  /** ms, programmatic push/pop */
  duration: number;
  /** ms bounds for finishing an interactive pop */
  settleMin: number;
  settleMax: number;
  /** px/s assumed when the finger was slower than this */
  settleVelocityFloor: number;
  /** multiplies every duration (slow motion / tests) */
  timeScale: number;

  /**
   * The look. Each of these is a CSS custom property on the container, and
   * the stylesheet already has a value for it; set one here only to override
   * the stylesheet from JavaScript. Leaving them undefined is the point —
   * then a designer can retheme the whole transition without touching code.
   */
  /** `--sn-parallax`: fraction of the width the lower page travels */
  parallax?: number;
  /** `--sn-dim-color` */
  dimColor?: string;
  /** `--sn-dim`: lower-page overlay opacity at p = 1 (≈0.35 reads well on dark UIs) */
  dimMax?: number;
  /** `--sn-shadow`: box-shadow on the incoming page */
  shadow?: string;
}

export interface IOSTransition extends Transition {
  readonly options: IOSTransitionOptions;
}

/** Which option overrides which custom property. */
const CSS_VARS = {
  parallax: '--sn-parallax',
  dimColor: '--sn-dim-color',
  dimMax: '--sn-dim',
  shadow: '--sn-shadow',
} as const;

/** Four decimals is well past a subpixel, and keeps the style strings short. */
const round = (n: number): number => Math.round(n * 1e4) / 1e4 || 0;

/**
 * The iOS navigation look: the upper page slides in from the trailing edge
 * with a soft shadow on its leading edge; the lower page parallaxes toward
 * the leading edge and dims.
 *
 * Everything is still a function of one number, p — but p is only ever
 * written twice per transition, at each end. CSS interpolates between them,
 * so the parallax factor, the dim, the shadow and the reading direction all
 * stay in the stylesheet and none of them cost a frame of JavaScript.
 *
 * One transition instance drives one stack.
 */
export function createIOSTransition(options: Partial<IOSTransitionOptions> = {}): IOSTransition {
  const o: IOSTransitionOptions = {
    duration: 500,
    settleMin: 120,
    settleMax: 400,
    settleVelocityFloor: 900,
    timeScale: 1,
    ...options,
  };

  /** Which custom properties this transition has written, so it only ever clears its own. */
  const written = new Set<string>();
  let dim: HTMLElement | null = null;
  const dimOf = (lower: StackEntry): HTMLElement => {
    if (!dim) {
      dim = document.createElement('div');
      dim.className = 'sn-dim';
      dim.setAttribute('aria-hidden', 'true');
    }
    if (dim.parentElement !== lower.el) lower.el.append(dim);
    return dim;
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
      const container = upper.el.parentElement;
      if (container) {
        for (const [key, prop] of Object.entries(CSS_VARS)) {
          const value = o[key as keyof typeof CSS_VARS];
          if (value !== undefined) {
            container.style.setProperty(prop, String(value));
            written.add(prop);
          } else if (written.delete(prop)) {
            container.style.removeProperty(prop); // an option that used to be set; not somebody else's
          }
        }
      }
      if (lower) dimOf(lower);
    },

    /**
     * The state at p, written declaratively. Two calls with `--sn-t` set to a
     * duration make an animation; a call per pointer move with `--sn-t: 0s`
     * makes a drag. No layout is read: the travel is a percentage of the page.
     */
    apply(lower, upper, p) {
      upper.el.style.transform = `translate3d(calc(${round((1 - p) * 100)}% * var(--sn-dir)),0,0)`;
      if (lower) {
        lower.el.style.transform = `translate3d(calc(${round(-p * 100)}% * var(--sn-parallax) * var(--sn-dir)),0,0)`;
        dimOf(lower).style.opacity = `calc(${round(p)} * var(--sn-dim))`;
      }
    },

    end(lower, upper) {
      upper.el.style.transform = '';
      if (lower) lower.el.style.transform = '';
      dim?.remove();
    },
  };
}
