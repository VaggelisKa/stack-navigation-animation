// Tiny animation toolkit: a cubic-bezier solver, a cancellable tween and the
// two easing curves the iOS transition uses.

export function cubicBezier(x1, y1, x2, y2) {
  const A = (a, b) => 1 - 3 * b + 3 * a;
  const B = (a, b) => 3 * b - 6 * a;
  const C = (a) => 3 * a;
  const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
  const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
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

export const easings = {
  linear: (t) => t,
  ios: cubicBezier(0.32, 0.72, 0, 1), // the usual approximation of UIKit's navigation curve
  easeOut: cubicBezier(0.2, 0.8, 0.2, 1),
};

/**
 * Animate a number from `from` to `to` over `duration` ms, calling `onUpdate`
 * every frame. Returns a promise that resolves when done; `promise.cancel()`
 * stops it early. A duration of 0 (or less) jumps straight to `to`.
 */
export function tween({ from, to, duration, ease = easings.linear, onUpdate }) {
  let raf = 0;
  let done = false;
  const promise = new Promise((resolve) => {
    if (duration <= 0) {
      onUpdate(to);
      done = true;
      return resolve();
    }
    const t0 = performance.now();
    const step = (now) => {
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
  });
  promise.cancel = () => {
    done = true;
    cancelAnimationFrame(raf);
  };
  return promise;
}

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
