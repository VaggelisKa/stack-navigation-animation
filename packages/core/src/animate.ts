// A small animation toolkit. The pages themselves are moved by CSS (see
// styles.ts), so what is here is the arithmetic CSS cannot do for the engine:
// a curve it can both hand to CSS and sample in JS, the spellings CSS wants,
// a cancellable tween used only to report progress, and the two helpers that
// hand a run over to the browser.

/**
 * An easing curve. Callable, so the engine can sample it; `css` is the same
 * curve spelled for `transition-timing-function`, which is what actually
 * drives the pixels. A plain `(t) => number` is still a valid easing, it just
 * falls back to `linear` on the CSS side.
 */
export interface Easing {
  (t: number): number;
  readonly css?: string;
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  // The coefficients are constant for the lifetime of a curve.
  const ax = 1 - 3 * x2 + 3 * x1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 1 - 3 * y2 + 3 * y1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const f = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    // Newton converges quickly for ordinary curves. Flat slopes can send it
    // outside [0, 1], so fall back to a bounded search when it fails.
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-8) return sampleY(t);
      const slope = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(slope) < 1e-8) break;
      const next = t - error / slope;
      if (next < 0 || next > 1) break;
      t = next;
    }
    let lo = 0, hi = 1;
    for (let i = 0; i < 30; i++) {
      t = (lo + hi) / 2;
      if (sampleX(t) < x) lo = t;
      else hi = t;
    }
    return sampleY(t);
  };
  return Object.assign(f, { css: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})` });
}

// `#__PURE__` marks the module-load calls as droppable, so a bundler that does
// not honour the package's `sideEffects` flag can still leave this module out
// when nothing here is imported.
export const easings: { linear: Easing; ios: Easing; easeOut: Easing } = {
  linear: /*#__PURE__*/ Object.assign((t: number) => t, { css: 'linear' }),
  ios: /*#__PURE__*/ cubicBezier(0.32, 0.72, 0, 1), // the common approximation of UIKit's navigation curve
  easeOut: /*#__PURE__*/ cubicBezier(0.2, 0.8, 0.2, 1),
};

/** How an easing should be spelled for CSS. A curve with no spelling runs linearly. */
export const cssEasing = (ease: Easing | undefined): string => ease?.css ?? 'linear';

/** How a duration should be spelled for CSS. */
export const cssDuration = (ms: number): string => (ms > 0 ? `${ms}ms` : '0s');

export interface TweenOptions {
  from: number;
  to: number;
  duration: number;
  ease?: Easing;
  onUpdate: (value: number) => void;
}

export type CancellableTween = Promise<void> & { cancel(): void };

/**
 * Animates a number from `from` to `to` over `duration` ms, calling `onUpdate`
 * every frame. Returns a promise that resolves when the tween is done;
 * `promise.cancel()` stops it early and resolves the promise. A duration of
 * 0 or less jumps straight to `to`.
 *
 * The engine does not use this to move pages, CSS does that. It uses it to
 * report `progress` to listeners, and only while someone is listening.
 */
export function tween({ from, to, duration, ease = easings.linear, onUpdate }: TweenOptions): CancellableTween {
  let raf = 0;
  let done = false;
  let finish: () => void;
  const promise = new Promise<void>((resolve) => {
    finish = resolve;
    if (duration <= 0) {
      onUpdate(to);
      done = true;
      return resolve();
    }
    const t0 = performance.now();
    const step = (now: number) => {
      if (done) return;
      const k = Math.min(1, (now - t0) / duration);
      onUpdate(from + (to - from) * ease(k));
      if (done) return;
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        done = true;
        resolve();
      }
    };
    raf = requestAnimationFrame(step);
  }) as CancellableTween;
  promise.cancel = () => {
    done = true;
    cancelAnimationFrame(raf);
    finish();
  };
  return promise;
}

/**
 * Commits the styles written so far, so the *next* write is seen as a change
 * and starts a CSS transition from here instead of being collapsed into it.
 * One forced layout per transition, in place of a frame of JavaScript per
 * frame of animation.
 */
export function commitStyles(el: HTMLElement): void {
  void el.offsetWidth;
}

/**
 * Resolves once the CSS transitions of `properties` on these elements have
 * finished. Nothing running resolves immediately: no transition started, a
 * zero duration, `prefers-reduced-motion`, an element that is not being
 * rendered. Interrupted animations reject, which counts as finished.
 *
 * Only the named properties are waited on, so an app is free to keep its own
 * animation running on a page without stalling the stack.
 */
export function animationsFinished(els: Array<HTMLElement | null | undefined>, properties: readonly string[] = ['transform', 'opacity']): Promise<void> {
  const running: Array<Promise<unknown>> = [];
  for (const el of els) {
    if (typeof el?.getAnimations !== 'function') continue;
    for (const animation of el.getAnimations()) {
      const property = (animation as { transitionProperty?: string }).transitionProperty;
      if (property && properties.includes(property)) running.push(animation.finished.catch(() => {}));
    }
  }
  return running.length ? Promise.all(running).then(() => {}) : Promise.resolve();
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
