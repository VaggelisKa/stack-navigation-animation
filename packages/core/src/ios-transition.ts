import { easings, prefersReducedMotion, type Easing } from './animate.ts';
import { cssVars, parseEasing, parseNumber, parseRatio, parseTime } from './css-vars.ts';
import type { SettleInput, StackEntry, Transition } from './navigation-stack.ts';

export interface IOSTransitionOptions {
  /** ms, programmatic push/pop */
  duration: number;
  /** the curve a programmatic push/pop runs on */
  ease: Easing;
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
  /** the curve the remaining distance of an interactive pop runs on */
  settleEase: Easing;
  /** px/s assumed when the finger was slower than this */
  settleVelocityFloor: number;
  /** multiplies every duration (slow motion / tests) */
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
  /** The JS options: the defaults with yours merged in. Mutable at runtime. */
  readonly options: IOSTransitionOptions;
  /** The values actually in force: `options` with the CSS variables applied over them. */
  readonly resolved: Readonly<IOSTransitionOptions>;
  /**
   * Re-read the CSS variables, from `el` or from the container of the last
   * transition. Called at the start of every transition; call it yourself
   * after changing `options` or the variables mid-animation.
   */
  refresh(el?: Element | null): void;
}

const DIM = /*#__PURE__*/ Symbol('dim');
type Dimmable = StackEntry & { [DIM]?: HTMLElement };

/**
 * The iOS navigation look: the upper page slides in from the trailing edge
 * with a soft shadow on its leading edge; the lower page parallaxes toward
 * the leading edge and dims. Everything is a function of one number, p.
 *
 * Every option is also a CSS custom property on the container (see
 * `IOS_TRANSITION_CSS_VARS`), read when a transition starts. A variable that
 * is set wins over the JS option, so a stylesheet can slow the animation down
 * or restyle it per theme without the app rebuilding the transition.
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

  const dimOf = (entry: Dimmable): HTMLElement => {
    let d = entry[DIM];
    if (!d) {
      d = document.createElement('div');
      d.setAttribute('aria-hidden', 'true');
      Object.assign(d.style, { position: 'fixed', inset: '0', pointerEvents: 'none', opacity: '0', zIndex: '2147483647' });
      entry[DIM] = d;
    }
    d.style.background = r.dimColor;
    if (d.parentElement !== entry.el) entry.el.append(d);
    return d;
  };

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
    apply(lower, upper, p) {
      const w = upper.el.parentElement?.clientWidth ?? 0;
      upper.el.style.transform = `translate3d(${(1 - p) * w}px,0,0)`;
      if (lower) {
        lower.el.style.transform = `translate3d(${-p * r.parallax * w}px,0,0)`;
        dimOf(lower).style.opacity = String(p * r.dimMax);
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
