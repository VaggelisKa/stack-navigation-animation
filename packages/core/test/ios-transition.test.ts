import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { createIOSTransition } from '../src/ios-transition.ts';

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

test('apply states the travel as a fraction of the page, leaving the geometry to CSS', () => {
  const t = createIOSTransition();
  const { lower, upper } = entries();
  t.begin(lower, upper);
  t.apply(lower, upper, 0.5);
  assert.equal(upper.el.style.transform, 'translate3d(calc(50% * var(--sn-dir)),0,0)');
  assert.equal(lower.el.style.transform, 'translate3d(calc(-50% * var(--sn-parallax) * var(--sn-dir)),0,0)');
  const dim = lower.el.children[0];
  assert.equal(dim.classes.has('sn-dim'), true);
  assert.equal(dim.attrs['aria-hidden'], 'true');
  assert.equal(dim.style.opacity, 'calc(0.5 * var(--sn-dim))');
  t.apply(lower, upper, 1);
  assert.equal(upper.el.style.transform, 'translate3d(calc(0% * var(--sn-dir)),0,0)');
  assert.equal(dim.style.opacity, 'calc(1 * var(--sn-dim))');
  t.end(lower, upper);
  assert.equal(upper.el.style.transform, '');
  assert.equal(lower.el.children.length, 0, 'dim overlay removed');
});

test('apply reads no layout, so the width never enters JavaScript', () => {
  const t = createIOSTransition();
  const { container, lower, upper } = entries();
  Object.defineProperty(container, 'clientWidth', {
    get() {
      throw new Error('the transition measured the container');
    },
  });
  t.begin(lower, upper);
  t.apply(lower, upper, 0.25);
  t.end(lower, upper);
});

test('the look stays in the stylesheet unless an option overrides it', () => {
  const { container, lower, upper } = entries();
  container.style.setProperty('--sn-parallax', '0.8'); // the app's own theming
  createIOSTransition().begin(lower, upper);
  assert.equal(container.style.getPropertyValue('--sn-parallax'), '0.8', 'an unset option leaves the app alone');
  container.style.removeProperty('--sn-parallax');

  createIOSTransition({ parallax: 0.5, dimMax: 0.35, dimColor: '#123', shadow: 'none' }).begin(lower, upper);
  assert.equal(container.style.getPropertyValue('--sn-parallax'), '0.5');
  assert.equal(container.style.getPropertyValue('--sn-dim'), '0.35');
  assert.equal(container.style.getPropertyValue('--sn-dim-color'), '#123');
  assert.equal(container.style.getPropertyValue('--sn-shadow'), 'none');

  const t = createIOSTransition({ parallax: 0.5 });
  t.begin(lower, upper);
  t.options.parallax = undefined;
  t.begin(lower, upper);
  assert.equal(container.style.getPropertyValue('--sn-parallax'), '', 'clearing the option hands it back to CSS');
});

test('apply works with no lower page (first push)', () => {
  const t = createIOSTransition();
  const { upper } = entries();
  t.begin(null, upper);
  t.apply(null, upper, 0);
  assert.equal(upper.el.style.transform, 'translate3d(calc(100% * var(--sn-dir)),0,0)');
  t.end(null, upper);
});

test('the curve is handed to CSS, not evaluated for it', () => {
  const t = createIOSTransition();
  assert.equal(t.ease.css, 'cubic-bezier(0.32, 0.72, 0, 1)');
  assert.equal(t.settle({ remainingPx: 100, velocity: 900 }).ease.css, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
});
