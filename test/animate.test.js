import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cubicBezier, easings, tween } from '../lib/animate.js';

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
