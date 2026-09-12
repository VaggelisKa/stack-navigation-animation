import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubicBezier, easings, isTouchPrimary, prefersReducedMotion, tween } from '../src/animate.ts';

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
  for (const [x1, y1, x2, y2] of [[0, 0, 0, 1], [1, 0, 0, 1], [1, 0, 1, 1], [0.3, -1, 0.7, 2]]) {
    const ease = cubicBezier(x1, y1, x2, y2);
    for (const t of [0.01, 0.1, 0.25, 0.49, 0.5, 0.51, 0.75, 0.9, 0.99]) {
      const coord = (a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
      assert.ok(Math.abs(ease(coord(x1, x2)) - coord(y1, y2)) < 1e-5, `curve ${[x1, y1, x2, y2]} at ${t}`);
    }
  }
});

test('a cancelled tween resolves and does not schedule another frame from onUpdate', async () => {
  const frames = new Map();
  let nextId = 0;
  globalThis.requestAnimationFrame = (fn) => { frames.set(++nextId, fn); return nextId; };
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
  globalThis.matchMedia = (q) => { asked.push(q); return { matches: true }; };
  assert.equal(isTouchPrimary(), true);
  assert.equal(prefersReducedMotion(), true);
  assert.deepEqual(asked, ['(pointer: coarse)', '(prefers-reduced-motion: reduce)']);
  globalThis.matchMedia = () => ({ matches: false });
});
