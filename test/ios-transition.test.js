import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.js';
import { createIOSTransition } from '../lib/ios-transition.js';

installGlobals();

const entries = () => {
  const container = makeElement('div');
  const lower = { el: makeElement('section') };
  const upper = { el: makeElement('section') };
  container.append(lower.el);
  container.append(upper.el);
  return { container, lower, upper };
};

test('duration honours timeScale and reduced motion', () => {
  const t = createIOSTransition({ duration: 500, timeScale: 2 });
  assert.equal(t.duration, 1000);
  globalThis.matchMedia = () => ({ matches: true });
  assert.equal(t.duration, 0);
  globalThis.matchMedia = () => ({ matches: false });
});

test('settle derives duration from distance / velocity, clamped', () => {
  const t = createIOSTransition({ settleMin: 120, settleMax: 400, settleVelocityFloor: 900 });
  assert.equal(t.settle({ remainingPx: 200, velocity: 1000 }).duration, 200);
  assert.equal(t.settle({ remainingPx: 10, velocity: 5000 }).duration, 120, 'floor');
  assert.equal(t.settle({ remainingPx: 5000, velocity: 100 }).duration, 400, 'ceiling');
  assert.equal(t.settle({ remainingPx: 450, velocity: 0 }).duration, 500 > 400 ? 400 : 500, 'velocity floor applies when finger was slow');
  assert.equal(t.settle({ remainingPx: 180, velocity: -2000 }).duration, 120, 'uses |velocity|');
});

test('apply moves upper by (1-p)·w and lower by -p·parallax·w with dim', () => {
  const t = createIOSTransition({ parallax: 0.3, dimMax: 0.1 });
  const { lower, upper } = entries();
  t.begin(lower, upper);
  assert.equal(upper.el.style.boxShadow, t.options.shadow);
  t.apply(lower, upper, 0.5);
  assert.equal(upper.el.style.transform, 'translate3d(200px,0,0)');
  assert.equal(lower.el.style.transform, 'translate3d(-60px,0,0)');
  const dim = lower.el.children[0];
  assert.equal(dim.attrs['aria-hidden'], 'true');
  assert.equal(dim.style.opacity, '0.05');
  t.apply(lower, upper, 1);
  assert.equal(upper.el.style.transform, 'translate3d(0px,0,0)');
  assert.equal(dim.style.opacity, '0.1');
  t.end(lower, upper);
  assert.equal(upper.el.style.boxShadow, '');
  assert.equal(lower.el.children.length, 0, 'dim overlay removed');
});

test('apply works with no lower page (first push)', () => {
  const t = createIOSTransition();
  const { upper } = entries();
  t.begin(null, upper);
  t.apply(null, upper, 0);
  assert.equal(upper.el.style.transform, 'translate3d(400px,0,0)');
  t.end(null, upper);
});
