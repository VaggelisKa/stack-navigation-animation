// A small animation toolkit: a cubic-bezier solver, a cancellable tween, and
// the easing curves the iOS transition uses.

export type Easing = (t: number) => number;

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const A = (a: number, b: number) => 1 - 3 * b + 3 * a;
  const B = (a: number, b: number) => 3 * b - 6 * a;
  const C = (a: number) => 3 * a;
  const calc = (t: number, a: number, b: number) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t: number, a: number, b: number) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const s = slope(t, x1, x2);
      if (s === 0) break;
      t -= (calc(t, x1, x2) - x) / s;
    }
    return calc(t, y1, y2);
  };
}

// `#__PURE__` marks the module-load calls as droppable, so a bundler that does
// not honour the package's `sideEffects` flag can still leave this module out
// when nothing here is imported.
export const easings: { linear: Easing; ios: Easing; easeOut: Easing } = {
  linear: (t) => t,
  ios: /*#__PURE__*/ cubicBezier(0.32, 0.72, 0, 1), // the common approximation of UIKit's navigation curve
  easeOut: /*#__PURE__*/ cubicBezier(0.2, 0.8, 0.2, 1),
};

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
 * `promise.cancel()` stops it early. A duration of 0 or less jumps straight
 * to `to`.
 */
export function tween({ from, to, duration, ease = easings.linear, onUpdate }: TweenOptions): CancellableTween {
  let raf = 0;
  let done = false;
  const promise = new Promise<void>((resolve) => {
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
  };
  return promise;
}

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
