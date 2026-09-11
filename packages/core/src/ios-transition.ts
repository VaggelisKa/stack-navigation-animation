import { easings, prefersReducedMotion, type Easing } from './animate.ts';
import { cssVars, parseEasing, parseNumber, parseRatio, parseTime } from './css-vars.ts';
import type { SettleInput, StackEntry, Transition } from './navigation-stack.ts';

export interface IOSTransitionOptions {
  /** ms, programmatic push/pop */
  duration: number;
  /**
   * the curve a programmatic push/pop runs on. CSS runs it, so it has to be
   * one CSS can spell: everything `cubicBezier()` and `parseEasing()` build
   * carries a `css` property. A bare `(t) => number` of your own has none, so
   * the pages would run `linear` while `progress` reported your curve; give it
   * a `css` property, or write the whole transition yourself.
   */
  ease: Easing;
  /** fraction of the width the lower page travels */
  parallax: number;
  dimColor: string;
  /** lower-page overlay opacity at p = 1 (≈0.35 suits dark UIs) */
  dimMax: number;
  /** box-shadow on the incoming page */
  shadow: string;
  /** ms bounds for finishing an interactive pop */
  settleMin: number;
  settleMax: number;
  /** the curve the remaining distance of an interactive pop runs on; see `ease` */
  settleEase: Easing;
  /** px/s assumed when the pointer was slower than this */
  settleVelocityFloor: number;
  /** multiplies every duration, for slow motion and tests */
  timeScale: number;
}

/** The CSS custom property behind each option. */
export const IOS_TRANSITION_CSS_VARS: Readonly<Record<keyof IOSTransitionOptions, string>> = /*#__PURE__*/ Object.freeze({
  duration: '--sn-duration',
  ease: '--sn-easing',
  parallax: '--sn-parallax',
  dimColor: '--sn-dim-color',
  dimMax: '--sn-dim-max',
  shadow: '--sn-shadow',
  settleMin: '--sn-settle-min',
  settleMax: '--sn-settle-max',
  settleEase: '--sn-settle-easing',
  settleVelocityFloor: '--sn-settle-velocity-floor',
  timeScale: '--sn-time-scale',
});

export interface IOSTransition extends Transition {
  /** The JS options: the defaults with the caller's merged in. Mutable at runtime. */
  readonly options: IOSTransitionOptions;
  /** The values currently in force: `options` with the CSS variables applied over them. */
  readonly resolved: Readonly<IOSTransitionOptions>;
  /**
   * Re-reads the CSS variables, from `el` or from the container of the last
   * transition. Called at the start of every transition. Call it directly
   * after changing `options` or the variables mid-animation.
   */
  refresh(el?: Element | null): void;
}

/**
 * The iOS navigation transition: the upper page slides in from the trailing
 * edge with a shadow on its leading edge, while the lower page parallaxes
 * toward the leading edge and dims. Every value is a function of one number, p.
 *
 * Every option is also a CSS custom property on the container (see
 * `IOS_TRANSITION_CSS_VARS`), read when a transition starts. A variable that
 * is set wins over the JS option, so a stylesheet can slow the animation down
 * or restyle it per theme without the app rebuilding the transition.
 *
 * p is only ever written at the ends of a phase. The stack puts that phase's
 * duration and curve in `--sn-t` / `--sn-e` and CSS interpolates between the
 * two writes, so the animation costs a handful of style writes rather than one
 * per page per frame, and runs on the compositor rather than the main thread.
 */
export function createIOSTransition(options: Partial<IOSTransitionOptions> = {}): IOSTransition {
  const o: IOSTransitionOptions = {
    duration: 500,
    ease: easings.ios,
    parallax: 0.3,
    dimColor: '#000',
    dimMax: 0.1,
    shadow: '-3px 0 14px rgba(0,0,0,0.16)',
    settleMin: 120,
    settleMax: 400,
    settleEase: easings.easeOut,
    settleVelocityFloor: 900,
    timeScale: 1,
    ...options,
  };

  let root: Element | null = null;
  let r: IOSTransitionOptions = { ...o };

  const refresh = (el?: Element | null): void => {
    if (el !== undefined) root = el;
    const read = cssVars(root);
    const v = IOS_TRANSITION_CSS_VARS;
    r = {
      duration: parseTime(read(v.duration)) ?? o.duration,
      ease: parseEasing(read(v.ease)) ?? o.ease,
      parallax: parseRatio(read(v.parallax)) ?? o.parallax,
      dimColor: read(v.dimColor) ?? o.dimColor,
      dimMax: parseRatio(read(v.dimMax)) ?? o.dimMax,
      shadow: read(v.shadow) ?? o.shadow,
      settleMin: parseTime(read(v.settleMin)) ?? o.settleMin,
      settleMax: parseTime(read(v.settleMax)) ?? o.settleMax,
      settleEase: parseEasing(read(v.settleEase)) ?? o.settleEase,
      settleVelocityFloor: parseNumber(read(v.settleVelocityFloor)) ?? o.settleVelocityFloor,
      timeScale: parseNumber(read(v.timeScale)) ?? o.timeScale,
    };
  };

  // One overlay, moved to whichever page is underneath. Everything about it
  // except its colour and its opacity is a rule in the stylesheet.
  let dim: HTMLElement | null = null;
  const dimOf = (lower: StackEntry): HTMLElement => {
    if (!dim) {
      dim = document.createElement('div');
      dim.className = 'sn-dim';
      dim.setAttribute('aria-hidden', 'true');
    }
    dim.style.background = r.dimColor;
    if (dim.parentElement !== lower.el) lower.el.append(dim);
    return dim;
  };

  /** Four decimals is well past a subpixel, and keeps the style strings short. */
  const round = (n: number): number => Math.round(n * 1e4) / 1e4 || 0;
  /** A share of the page's own width, signed by the stylesheet's reading direction. */
  const shift = (fraction: number): string => `translate3d(calc(${round(fraction * 100)}% * var(--sn-dir,1)),0,0)`;

  return {
    options: o,
    get resolved(): Readonly<IOSTransitionOptions> {
      return r;
    },
    refresh,
    get duration(): number {
      return prefersReducedMotion() ? 0 : r.duration * r.timeScale;
    },
    get ease(): Easing {
      return r.ease;
    },

    /** How long the remaining distance of an interactive pop should take. */
    settle({ remainingPx, velocity }: SettleInput) {
      if (prefersReducedMotion()) return { duration: 0, ease: r.settleEase };
      const raw = (remainingPx / Math.max(Math.abs(velocity), r.settleVelocityFloor)) * 1000;
      return { duration: Math.min(r.settleMax, Math.max(r.settleMin, raw)) * r.timeScale, ease: r.settleEase };
    },

    begin(lower, upper) {
      refresh(upper.el.parentElement);
      upper.el.style.boxShadow = r.shadow;
      if (lower) dimOf(lower);
    },
    /**
     * The state at p, written declaratively. Two calls with `--sn-t` set to a
     * duration make an animation; a call per pointer move with `--sn-t: 0s`
     * makes a drag. Nothing here measures layout: the travel is a share of the
     * page, so a resize mid-transition stays honest.
     */
    apply(lower, upper, p) {
      upper.el.style.transform = shift(1 - p);
      if (lower) {
        lower.el.style.transform = shift(-p * r.parallax);
        dimOf(lower).style.opacity = String(p * r.dimMax);
      }
    },
    end(lower, upper) {
      upper.el.style.boxShadow = '';
      upper.el.style.transform = '';
      if (lower) lower.el.style.transform = '';
      dim?.remove();
    },
  };
}
