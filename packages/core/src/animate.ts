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
/**
 * Straight lines through `points` (`[x, y]` pairs, x from 0 to 1 and never
 * decreasing), the curve CSS `linear()` draws. Spelled for CSS the same way
 * unless `css` says otherwise. A browser without `linear()` (Chrome < 113,
 * Safari < 17.2, Firefox < 112) runs its default `ease` instead.
 */
export function linearEasing(points: ReadonlyArray<readonly [number, number]>, css?: string): Easing {
  const f = (t: number): number => {
    if (t <= points[0][0]) return points[0][1];
    let i = 1;
    while (i < points.length - 1 && points[i][0] < t) i++;
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    return x1 > x0 ? y0 + (y1 - y0) * Math.min(1, (t - x0) / (x1 - x0)) : y1;
  };
  return Object.assign(f, { css: css ?? `linear(${points.map(([x, y]) => `${y} ${x * 100}%`).join(', ')})` });
}

export const easings: { linear: Easing; ios: Easing; easeOut: Easing; android: Easing; androidSettle: Easing } = {
  linear: /*#__PURE__*/ Object.assign((t: number) => t, { css: 'linear' }),
  ios: /*#__PURE__*/ cubicBezier(0.32, 0.72, 0, 1), // the common approximation of UIKit's navigation curve
  easeOut: /*#__PURE__*/ cubicBezier(0.2, 0.8, 0.2, 1),
  // AOSP's `fast_out_extra_slow_in`, the interpolator behind activity open and
  // close since Android 13 (frameworks/base, core/res/res/interpolator). It is
  // a path of two cubics, `M0,0 C0.05,0 0.133,0.06 0.167,0.4 C0.208,0.82 0.25,1
  // 1,1`, which one `cubic-bezier()` cannot bend into; these stops follow it
  // to within 0.006 and are what CSS gets.
  android: /*#__PURE__*/ linearEasing([
    [0, 0], [0.03125, 0.008], [0.0625, 0.033], [0.09375, 0.08], [0.125, 0.162], [0.140625, 0.225], [0.15625, 0.313],
    [0.1640625, 0.375], [0.171875, 0.451], [0.1796875, 0.517], [0.1875, 0.571], [0.203125, 0.649], [0.21875, 0.702],
    [0.25, 0.773], [0.28125, 0.819], [0.3125, 0.853], [0.375, 0.899], [0.5, 0.951], [0.625, 0.977], [0.75, 0.991], [1, 1],
  ]),
  // The "standard decelerate" Android's predictive-back guidelines ask for
  // when a released gesture runs out.
  androidSettle: /*#__PURE__*/ cubicBezier(0, 0, 0, 1),
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
// The default is spelled out rather than taken from `easings`, so a bundle that
// only needs the tween does not carry the curves.
export function tween({ from, to, duration, ease = (t) => t, onUpdate }: TweenOptions): CancellableTween {
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
 * Whether the browser understands `@starting-style`, which is the only way to
 * say what a page looked like before it was inserted. Where it is not
 * understood a push has nothing to animate from and would simply land, so the
 * engine writes that start state itself and commits it, as it did before the
 * rule existed: slower, but it moves.
 *
 * Asked by inserting the rule, because CSSOM rejects an at-rule it does not
 * know. Somewhere with no stylesheet to ask — a server, a test — the answer is
 * yes, which costs nothing there and leaves the decision to CSS.
 */
export function supportsStartingStyle(doc: Document | null = typeof document === 'undefined' ? null : document): boolean {
  if (!doc) return true;
  let style: HTMLStyleElement | undefined;
  try {
    style = doc.createElement('style');
    (doc.head ?? doc.documentElement).append(style);
    if (!style.sheet) return true;
    style.sheet.insertRule('@starting-style{.sn-starting-style-probe{opacity:0}}');
    return true;
  } catch (e) {
    return !(e instanceof Error && e.name === 'SyntaxError');
  } finally {
    style?.remove();
  }
}

/** The next rendering opportunity, or now where there are no frames (a server, a test). */
export function nextFrame(): Promise<void> {
  return typeof requestAnimationFrame === 'function'
    ? new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    : Promise.resolve();
}

/**
 * The engine no longer needs this: a phase now begins from where the pages
 * already rest, so there is nothing of its own left to commit. It is still
 * here for an application that writes a start state itself and wants the
 * next write to be seen as a change rather than collapsed into it.
 *
 * Commits the styles written so far, so the *next* write is seen as a change
 * and starts a CSS transition from here instead of being collapsed into it.
 *
 * What a transition takes its start value from is the resolved style, and
 * style resolution is document-wide, so reading one property commits every
 * write made so far, the page beneath included -- which is why it is not free,
 * and why the engine went to the trouble of not needing it: on an eight-deep
 * stack of heavy pages this cost about 6 ms inside the navigation task.
 * Asking for `offsetWidth` commits the writes too, but it forces layout as
 * well; `opacity` cannot depend on geometry, so asking for it resolves style
 * and stops.
 */
export function commitStyles(el: HTMLElement): void {
  if (typeof getComputedStyle === 'function') void getComputedStyle(el).opacity;
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

/** `matchMedia`, and false where there is none: a server, a test. */
export const matchesMedia = (query: string): boolean =>
  typeof matchMedia === 'function' && matchMedia(query).matches;

export const prefersReducedMotion = (): boolean => matchesMedia('(prefers-reduced-motion: reduce)');

/**
 * Whether the primary pointer is coarse: a phone or a tablet, not a mouse. The
 * test to reach for when a behaviour is meant for handhelds only. It is a media
 * query, so it answers again after the device changes — a tablet docked to a
 * trackpad stops being touch-primary.
 */
export const isTouchPrimary = (): boolean => matchesMedia('(pointer: coarse)');
