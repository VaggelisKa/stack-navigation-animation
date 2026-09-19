import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  animationsFinished,
  commitStyles,
  cubicBezier,
  easings,
  isTouchPrimary,
  linearEasing,
  prefersReducedMotion,
  tween,
} from '../src/animate.ts';

test('cubicBezier is clamped and passes through the endpoints', () => {
  const f = cubicBezier(0.32, 0.72, 0, 1);
  assert.equal(f(-1), 0);
  assert.equal(f(0), 0);
  assert.equal(f(1), 1);
  assert.equal(f(2), 1);
});

test('cubicBezier(0,0,1,1) is linear', () => {
  const f = cubicBezier(0, 0, 1, 1);
  for (const x of [0.1, 0.25, 0.5, 0.9]) assert.ok(Math.abs(f(x) - x) < 1e-6, `f(${x}) = ${f(x)}`);
});

test('the iOS curve is monotonic and front-loaded', () => {
  let prev = 0;
  for (let i = 1; i <= 20; i++) {
    const y = easings.ios(i / 20);
    assert.ok(y >= prev, 'monotonic');
    prev = y;
  }
  assert.ok(easings.ios(0.5) > 0.5, 'more than half the distance is covered by half time');
});

/** AOSP's fast_out_extra_slow_in, solved exactly: two cubic segments, the second starting where the first ends. */
const fastOutExtraSlowIn = (x: number): number => {
  // A row per cubic segment, four control points each.
  // prettier-ignore
  const segs = [
    [[0, 0], [0.05, 0], [0.133333, 0.06], [0.166666, 0.4]],
    [[0.166666, 0.4], [0.208333, 0.82], [0.25, 1], [1, 1]],
  ];
  const [p0, p1, p2, p3] = segs[x < 0.166666 ? 0 : 1];
  const at = (t: number, k: 0 | 1) =>
    (1 - t) ** 3 * p0[k] +
    3 * (1 - t) ** 2 * t * p1[k] +
    3 * (1 - t) * t * t * p2[k] +
    t ** 3 * p3[k];
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 40; i++)
    at((lo + hi) / 2, 0) < x ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2);
  return at((lo + hi) / 2, 1);
};

test('the Android curve follows fast_out_extra_slow_in and is spelled as linear()', () => {
  const f = easings.android;
  assert.equal(f(0), 0);
  assert.equal(f(1), 1);
  for (let i = 1; i < 100; i++) {
    const x = i / 100;
    assert.ok(
      Math.abs(f(x) - fastOutExtraSlowIn(x)) < 0.01,
      `f(${x}) = ${f(x)}, the path gives ${fastOutExtraSlowIn(x)}`,
    );
  }
  assert.ok(f(0.1) < 0.1, 'a slow start, unlike the iOS curve');
  assert.ok(f(0.25) > 0.75, 'then most of the way by a quarter of the time');
  let prev = 0;
  for (let i = 1; i <= 40; i++) {
    const y = f(i / 40);
    assert.ok(y >= prev, 'monotonic');
    prev = y;
  }
  assert.match(f.css!, /^linear\(0 0%, .*1 100%\)$/);
});

test('linearEasing joins its points with straight lines', () => {
  const f = linearEasing([
    [0, 0],
    [0.5, 1],
    [1, 0],
  ]);
  assert.equal(f(0.25), 0.5);
  assert.equal(f(0.5), 1);
  assert.equal(f(0.75), 0.5);
  assert.equal(f(-1), 0);
  assert.equal(f(2), 0);
  assert.equal(f.css, 'linear(0 0%, 1 50%, 0 100%)');
  assert.equal(
    linearEasing(
      [
        [0, 0],
        [1, 1],
      ],
      'linear',
    ).css,
    'linear',
    'a spelling of its own is kept',
  );
});

test('linearEasing refuses a table it cannot draw a line through', () => {
  // It used to be built happily and throw at the first call instead.
  assert.throws(() => linearEasing([]), TypeError);
  assert.throws(() => linearEasing([[0, 0]]), TypeError);
});

test('tween with zero duration jumps to the end synchronously', async () => {
  const seen = [];
  await tween({ from: 0, to: 1, duration: 0, onUpdate: (v) => seen.push(v) });
  assert.deepEqual(seen, [1]);
});

test('tween animates from → to and resolves', async () => {
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 1);
  globalThis.cancelAnimationFrame = clearTimeout;
  const seen = [];
  await tween({ from: 0, to: 10, duration: 20, onUpdate: (v) => seen.push(v) });
  assert.equal(seen[seen.length - 1], 10);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1]);
});

test('tween.cancel stops further updates', async () => {
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 1);
  globalThis.cancelAnimationFrame = clearTimeout;
  const seen = [];
  const t = tween({ from: 0, to: 10, duration: 1000, onUpdate: (v) => seen.push(v) });
  t.cancel();
  await new Promise((r) => setTimeout(r, 20));
  assert.ok(seen.length <= 1);
});

// Generate inputs from the parametric curve itself: this checks the inverse
// solver against known points without duplicating its numerical algorithm.
test('Bezier sampling agrees with curves with flat slopes and overshoot', () => {
  for (const [x1, y1, x2, y2] of [
    [0, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 1, 1],
    [0.3, -1, 0.7, 2],
  ]) {
    const ease = cubicBezier(x1, y1, x2, y2);
    for (const t of [0.01, 0.1, 0.25, 0.49, 0.5, 0.51, 0.75, 0.9, 0.99]) {
      const coord = (a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
      assert.ok(
        Math.abs(ease(coord(x1, x2)) - coord(y1, y2)) < 1e-5,
        `curve ${[x1, y1, x2, y2]} at ${t}`,
      );
    }
  }
});

test('a cancelled tween resolves and does not schedule another frame from onUpdate', async () => {
  const frames = new Map();
  let nextId = 0;
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++nextId, fn);
    return nextId;
  };
  globalThis.cancelAnimationFrame = (id) => frames.delete(id);
  const t = tween({ from: 0, to: 1, duration: 1000, onUpdate: () => t.cancel() });
  const frame = frames.get(nextId);
  frames.delete(nextId);
  frame(performance.now());
  await t;
  assert.equal(frames.size, 0);
});

test('media helpers ask the right queries, and are false without matchMedia', () => {
  const asked = [];
  globalThis.matchMedia = undefined;
  assert.equal(isTouchPrimary(), false, 'no matchMedia');
  assert.equal(prefersReducedMotion(), false, 'no matchMedia');
  globalThis.matchMedia = (q) => {
    asked.push(q);
    return { matches: true };
  };
  assert.equal(isTouchPrimary(), true);
  assert.equal(prefersReducedMotion(), true);
  assert.deepEqual(asked, ['(pointer: coarse)', '(prefers-reduced-motion: reduce)']);
  globalThis.matchMedia = () => ({ matches: false });
});

// The commit exists to separate two writes made in one task. Style resolution
// is enough for that; measuring the box would also lay out the page being
// mounted, inside the navigation task, for a number nobody reads.
test('commitStyles resolves style without measuring the box', () => {
  const reads: string[] = [];
  const el = {
    get offsetWidth(): number {
      throw new Error('commitStyles forced layout');
    },
  } as unknown as HTMLElement;
  const previous = globalThis.getComputedStyle;
  globalThis.getComputedStyle = ((target: unknown) => {
    reads.push(target === el ? 'element' : 'something else');
    return {
      get opacity() {
        reads.push('opacity');
        return '1';
      },
    };
  }) as unknown as typeof getComputedStyle;
  try {
    commitStyles(el);
  } finally {
    globalThis.getComputedStyle = previous;
  }
  assert.deepEqual(
    reads,
    ['element', 'opacity'],
    'one property, on the element itself, that cannot depend on geometry',
  );
});

// ------------------------------------------------------- animationsFinished
/** An element running one transition on `property`, reporting through `finished`. */
const animating = (finished: Promise<unknown>, property = 'transform') =>
  ({ getAnimations: () => [{ transitionProperty: property, finished }] }) as unknown as HTMLElement;

const pending = new Promise<never>(() => {});
/** Resolves to 'pending' if `promise` has not settled within a couple of macrotasks. */
const settledSoon = (promise: Promise<unknown>) =>
  Promise.race([
    promise.then(() => 'settled'),
    new Promise((r) => setTimeout(() => r('pending'), 20)),
  ]);

test('animationsFinished waits only for the named properties, and for nothing without them', async () => {
  assert.equal(
    await settledSoon(animationsFinished([null, undefined, {} as HTMLElement])),
    'settled',
    'nothing running',
  );
  assert.equal(
    await settledSoon(animationsFinished([animating(pending, 'width')])),
    'settled',
    'a property nobody asked about',
  );
  assert.equal(await settledSoon(animationsFinished([animating(pending)])), 'pending');
});

// The stack hangs on this wait, so an animation that never reports back must
// not hold it for the lifetime of the tab.
test('animationsFinished gives up after its timeout', async () => {
  const started = Date.now();
  await animationsFinished([animating(pending)], undefined, 30);
  assert.ok(Date.now() - started >= 25, `waited ${Date.now() - started}ms`);
  assert.equal(
    await settledSoon(animationsFinished([animating(pending)], undefined, 0)),
    'pending',
    'no timeout means wait',
  );
});

test('a finished animation wins the race and leaves no timer behind', async () => {
  const timers = new Set<unknown>();
  const [setT, clearT] = [globalThis.setTimeout, globalThis.clearTimeout];
  globalThis.setTimeout = ((fn: () => void, ms: number) => {
    const id = setT(fn, ms);
    timers.add(id);
    return id;
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id: unknown) => {
    timers.delete(id);
    return clearT(id as Parameters<typeof clearTimeout>[0]);
  }) as typeof clearTimeout;
  try {
    // A rejected `finished` is an interrupted animation, which counts as finished.
    await animationsFinished(
      [
        animating(Promise.resolve()),
        animating(Promise.reject(new Error('interrupted')), 'opacity'),
      ],
      undefined,
      60_000,
    );
    assert.equal(
      timers.size,
      0,
      'the watchdog timer is cleared, so it neither fires nor holds the process open',
    );
  } finally {
    globalThis.setTimeout = setT;
    globalThis.clearTimeout = clearT;
  }
});

test('commitStyles is a no-op where there is no getComputedStyle', () => {
  const previous = globalThis.getComputedStyle;
  // A server, or a test runner without a DOM.
  (globalThis as { getComputedStyle?: unknown }).getComputedStyle = undefined;
  try {
    assert.doesNotThrow(() => commitStyles({} as HTMLElement));
  } finally {
    globalThis.getComputedStyle = previous;
  }
});
