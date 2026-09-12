import { easings, prefersReducedMotion, type Easing } from './animate.ts';
import { cssVars, parseEasing, parseNumber, parseRatio, parseTime } from './css-vars.ts';
import type { SettleInput, StackEntry, Transition } from './navigation-stack.ts';
import { detectPlatform, type Platform } from './platform.ts';

export interface NativeTransitionOptions {
  /**
   * Whose push/pop to imitate. `auto` (the default) asks the browser and
   * falls back to `ios`. It picks the defaults for everything below; an
   * option given explicitly wins over the platform's, as a CSS variable wins
   * over both.
   */
  platform: Platform | 'auto';
  /** ms, programmatic push/pop */
  duration: number;
  /**
   * the curve a programmatic push/pop runs on. CSS runs it, so it has to be
   * one CSS can spell: everything `cubicBezier()`, `bezierPath()` and
   * `parseEasing()` build carries a `css` property. A bare `(t) => number` of
   * your own has none, so the pages would run `linear` while `progress`
   * reported your curve; give it a `css` property, or write the whole
   * transition yourself.
   */
  ease: Easing;
  /** fraction of the width the upper page travels (1 = from off-screen; Android slides a short way and fades) */
  travel: number;
  /** fraction of the width the lower page travels */
  parallax: number;
  /** opacity of the upper page when fully closed (1 = no fade) */
  fade: number;
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

/** Every option except the platform, which is decided once and has no CSS variable. */
export type NativeTransitionPreset = Readonly<Omit<NativeTransitionOptions, 'platform'>>;

/**
 * Each platform's own push/pop, as its system animates it.
 *
 * - `ios`: UIKit's navigation push. The upper page slides the full width with
 *   a shadow on its leading edge, the lower page parallaxes 30% and dims.
 * - `android`: the framework's activity open/close since Android 13
 *   (`activity_open_enter.xml` and friends): both pages slide 96 dp, about a
 *   quarter of a phone, over 450 ms on `fast_out_extra_slow_in`, and the
 *   upper page fades through the first part of it. No shadow, no dim.
 */
export function nativeTransitionPreset(platform: Platform): NativeTransitionPreset {
  const shared = { settleMin: 120, settleMax: 400, settleVelocityFloor: 900, timeScale: 1, dimColor: '#000' };
  return platform === 'android'
    ? { ...shared, duration: 450, ease: easings.android, travel: 0.25, parallax: 0.25, fade: 0, dimMax: 0, shadow: 'none', settleEase: easings.androidSettle }
    : { ...shared, duration: 500, ease: easings.ios, travel: 1, parallax: 0.3, fade: 1, dimMax: 0.1, shadow: '-3px 0 14px rgba(0,0,0,0.16)', settleEase: easings.easeOut };
}

/** The CSS custom property behind each option. */
export const NATIVE_TRANSITION_CSS_VARS: Readonly<Record<keyof NativeTransitionPreset, string>> = /*#__PURE__*/ Object.freeze({
  duration: '--sn-duration',
  ease: '--sn-easing',
  travel: '--sn-travel',
  parallax: '--sn-parallax',
  fade: '--sn-fade',
  dimColor: '--sn-dim-color',
  dimMax: '--sn-dim-max',
  shadow: '--sn-shadow',
  settleMin: '--sn-settle-min',
  settleMax: '--sn-settle-max',
  settleEase: '--sn-settle-easing',
  settleVelocityFloor: '--sn-settle-velocity-floor',
  timeScale: '--sn-time-scale',
});

export interface NativeTransition extends Transition {
  /** The JS options: the platform's preset with the caller's merged in. `platform` is the one chosen. Mutable at runtime. */
  readonly options: NativeTransitionOptions & { platform: Platform };
  /** The values currently in force: `options` with the CSS variables applied over them. */
  readonly resolved: Readonly<NativeTransitionOptions & { platform: Platform }>;
  /**
   * Re-reads the CSS variables, from `el` or from the container of the last
   * transition. Called at the start of every transition. Call it directly
   * after changing `options` or the variables mid-animation.
   */
  refresh(el?: Element | null): void;
}

/**
 * The platform's navigation transition: the upper page slides in from the
 * trailing edge while the lower page parallaxes toward the leading edge. On
 * iOS the upper page travels the full width under a shadow and the lower page
 * dims; on Android both travel a short way and the upper page fades. Every
 * value is a function of one number, p.
 *
 * Every option is also a CSS custom property on the container (see
 * `NATIVE_TRANSITION_CSS_VARS`), read when a transition starts. A variable
 * that is set wins over the JS option, so a stylesheet can slow the animation
 * down or restyle it per theme without the app rebuilding the transition.
 *
 * p is only ever written at the ends of a phase. The stack puts that phase's
 * duration and curve in `--sn-t` / `--sn-e` and CSS interpolates between the
 * two writes, so the animation costs a handful of style writes rather than one
 * per page per frame, and runs on the compositor rather than the main thread.
 */
export function createNativeTransition(options: Partial<NativeTransitionOptions> = {}): NativeTransition {
  const platform = !options.platform || options.platform === 'auto' ? detectPlatform() : options.platform;
  const o: NativeTransitionOptions & { platform: Platform } = { ...nativeTransitionPreset(platform), ...options, platform };

  let root: Element | null = null;
  let r: NativeTransitionOptions & { platform: Platform } = { ...o };

  const refresh = (el?: Element | null): void => {
    if (el !== undefined) root = el;
    const read = cssVars(root);
    const v = NATIVE_TRANSITION_CSS_VARS;
    r = {
      platform: o.platform,
      duration: parseTime(read(v.duration)) ?? o.duration,
      ease: parseEasing(read(v.ease)) ?? o.ease,
      travel: parseRatio(read(v.travel)) ?? o.travel,
      parallax: parseRatio(read(v.parallax)) ?? o.parallax,
      fade: parseRatio(read(v.fade)) ?? o.fade,
      dimColor: read(v.dimColor) ?? o.dimColor,
      dimMax: parseRatio(read(v.dimMax)) ?? o.dimMax,
      shadow: read(v.shadow) ?? o.shadow,
      settleMin: parseTime(read(v.settleMin)) ?? o.settleMin,
      settleMax: parseTime(read(v.settleMax)) ?? o.settleMax,
      settleEase: parseEasing(read(v.settleEase)) ?? o.settleEase,
      settleVelocityFloor: parseNumber(read(v.settleVelocityFloor)) ?? o.settleVelocityFloor,
      timeScale: parseNumber(read(v.timeScale)) ?? o.timeScale,
    };
    if (dim?.parentElement) dim.style.setProperty('--sn-dim-fallback', o.dimColor);
  };

  // One overlay, moved to whichever page is underneath. Everything about it
  // except its opacity is a rule in the stylesheet; JS supplies the fallback colour.
  let dim: HTMLElement | null = null;
  const dimOf = (lower: StackEntry): HTMLElement => {
    if (!dim) {
      dim = document.createElement('div');
      dim.className = 'sn-dim';
      dim.setAttribute('aria-hidden', 'true');
    }
    dim.style.setProperty('--sn-dim-fallback', o.dimColor);
    if (dim.parentElement !== lower.el) lower.el.append(dim);
    return dim;
  };

  /** Four decimals is well past a subpixel, and keeps the style strings short. */
  const round = (n: number): number => Math.round(n * 1e4) / 1e4 || 0;
  /** A share of the page's own width, signed by the stylesheet's reading direction. */
  const shift = (fraction: number): string => `translate3d(calc(${round(fraction * 100)}% * var(--sn-dir,1)),0,0)`;

  return {
    options: o,
    get resolved(): Readonly<NativeTransitionOptions & { platform: Platform }> {
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
      upper.el.style.boxShadow = `var(--sn-shadow, ${o.shadow})`;
      if (lower) dimOf(lower);
    },
    /**
     * The state at p, written declaratively. Two calls with `--sn-t` set to a
     * duration make an animation; a call per pointer move with `--sn-t: 0s`
     * makes a drag. Nothing here measures layout: the travel is a share of the
     * page, so a resize mid-transition stays honest.
     */
    apply(lower, upper, p) {
      upper.el.style.transform = shift((1 - p) * r.travel);
      // Only a look that fades writes opacity: a property that is not written
      // starts no transition, and a page's own opacity is left alone.
      if (r.fade < 1) upper.el.style.opacity = String(round(r.fade + (1 - r.fade) * p));
      if (lower) {
        lower.el.style.transform = shift(-p * r.parallax);
        dim!.style.opacity = String(p * r.dimMax);
      }
    },
    end(lower, upper) {
      upper.el.style.boxShadow = '';
      upper.el.style.transform = '';
      upper.el.style.opacity = '';
      if (lower) lower.el.style.transform = '';
      dim?.remove();
    },
  };
}
