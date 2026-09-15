import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { createNativeTransition } from '../src/native-transition.ts';
import { easings } from '../src/animate.ts';

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
  const t = createNativeTransition({ platform: 'ios', duration: 500, timeScale: 2 });
  assert.equal(t.duration, 1000);
  globalThis.matchMedia = () => ({ matches: true });
  assert.equal(t.duration, 0);
  globalThis.matchMedia = () => ({ matches: false });
});

test('settle derives duration from distance / velocity, clamped', () => {
  const t = createNativeTransition({ platform: 'ios', settleMin: 120, settleMax: 400, settleVelocityFloor: 900 });
  assert.equal(t.settle({ remainingPx: 200, velocity: 1000 }).duration, 200);
  assert.equal(t.settle({ remainingPx: 10, velocity: 5000 }).duration, 120, 'floor');
  assert.equal(t.settle({ remainingPx: 5000, velocity: 100 }).duration, 400, 'ceiling');
  assert.equal(t.settle({ remainingPx: 450, velocity: 0 }).duration, 500 > 400 ? 400 : 500, 'velocity floor applies when finger was slow');
  assert.equal(t.settle({ remainingPx: 180, velocity: -2000 }).duration, 120, 'uses |velocity|');
});

// The travel is a share of the page, not a pixel count, so the engine never
// measures the container and CSS keeps the reading direction.
const shift = (percent: string) => `translate3d(calc(${percent}% * var(--sn-dir,1)),0,0)`;

test('apply moves upper by (1-p) and lower by -p·parallax, with dim', () => {
  const t = createNativeTransition({ platform: 'ios', parallax: 0.3, dimMax: 0.1 });
  const { container, lower, upper } = entries();
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(upper.el.style.boxShadow, `var(--sn-shadow, ${t.options.shadow})`);
  t.apply(lower, upper, 0.5);
  assert.equal(upper.el.style.transform, shift('50'));
  assert.equal(lower.el.style.transform, shift('-15'));
  const dim = lower.el.children[0];
  assert.equal(dim.classes.has('sn-dim'), true, 'the overlay is styled by the stylesheet');
  assert.equal(dim.attrs['aria-hidden'], 'true');
  assert.equal(dim.style.opacity, '0.05');
  t.apply(lower, upper, 1);
  assert.equal(upper.el.style.transform, '', 'where the stylesheet already puts the page, nothing is written');
  assert.equal(dim.style.opacity, '0.1');
  t.end(lower, upper);
  assert.equal(upper.el.style.boxShadow, '');
  assert.equal(upper.el.style.transform, '');
  assert.equal(lower.el.children.length, 1, 'the overlay belongs to the page, not to the phase');
  assert.equal(lower.el.style.transform, shift('-30'), 'and the page beneath stays where a covered page rests');
});

// A phase can only fade something that already has an opacity to fade from. An
// overlay created when the phase begins has no resolved style behind it, so its
// first write lands at full strength: the dim would appear rather than arrive.
test('a page carries its overlay from the moment it is mounted', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower } = entries();
  t.refresh(container);
  t.mount(lower);
  const dim = lower.el.children[0];
  assert.equal(dim.classes.has('sn-dim'), true);
  assert.ok(!dim.style.opacity, 'at the opacity the stylesheet gives it, which is where the fade starts');
  t.mount(lower);
  assert.equal(lower.el.children.length, 1, 'and only ever one of them');
  t.unmount(lower);
  assert.equal(lower.el.children.length, 0, 'a page leaving takes it with it');
});

// Only CSS can say what an element looked like before it existed, so the values
// an @starting-style rule needs have to be somewhere CSS can read them. They go
// on the page, at the one moment writing an inherited custom property is free:
// on the container they would reach every element in every page kept in the
// stack, and stopping them at the page boundary costs more again.
test('a page is given the start states the stylesheet cannot work out for itself', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  t.refresh(container);
  t.mount(lower);
  assert.equal(lower.el.vars['--sn-enter-upper'], shift('100'), 'a page arriving on top comes from the trailing edge');
  assert.equal(lower.el.vars['--sn-enter-lower'], shift('-30'), 'a page arriving underneath comes from the parallax');
  assert.equal(lower.el.vars['--sn-enter-fade'], '1');
  assert.equal(container.vars['--sn-enter-upper'], undefined, 'and never on the container, where a later change would reach every page');
  Object.assign(container.vars, { '--sn-travel': '25%', '--sn-fade': '0' });
  t.refresh();
  t.mount(upper);
  assert.equal(upper.el.vars['--sn-enter-upper'], shift('25'), 'they follow the variables like everything else');
  assert.equal(upper.el.vars['--sn-enter-fade'], '0');
});

test('the Android look slides a short way and fades, without dim or shadow', () => {
  const t = createNativeTransition({ platform: 'android' });
  const { container, lower, upper } = entries();
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(upper.el.classes.has('sn-page-android-fade'), true, 'opacity has its own short, linear timing');
  assert.equal(upper.el.style.boxShadow, 'var(--sn-shadow, none)');
  t.apply(lower, upper, 0);
  assert.equal(upper.el.style.transform, shift('25'), 'a quarter of the width, not the whole of it');
  assert.equal(upper.el.style.opacity, '0');
  t.apply(lower, upper, 0.5);
  assert.equal(upper.el.style.transform, shift('12.5'));
  assert.equal(upper.el.style.opacity, '0.5');
  assert.equal(lower.el.style.transform, shift('-12.5'), 'the page beneath moves the same distance');
  assert.equal(lower.el.children[0].style.opacity, '', 'Android does not dim, so the overlay is never written');
  t.apply(lower, upper, 1);
  assert.equal(upper.el.style.opacity, '', 'fully open is the page\'s own opacity, which is the stylesheet\'s to give');
  t.end(lower, upper);
  assert.equal(upper.el.style.opacity, '', 'the page gets its own opacity back');
  assert.equal(upper.el.classes.has('sn-page-android-fade'), false, 'fade timing is removed after the transition');
});

test('Android fade timing is only enabled when the resolved look fades', () => {
  for (const platform of ['ios', 'android'] as const) {
    const t = createNativeTransition({ platform });
    const { container, lower, upper } = entries();
    container.vars['--sn-fade'] = '1';
    t.refresh(container);
    t.begin(lower, upper);
    assert.equal(upper.el.classes.has('sn-page-android-fade'), false);
    t.end(lower, upper);
  }
});

test('the iOS look never writes opacity, so a page keeps its own', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  upper.el.style.opacity = '0.8';
  t.refresh(container);
  t.begin(lower, upper);
  t.apply(lower, upper, 0.5);
  assert.equal(upper.el.style.opacity, '0.8');
  t.end(lower, upper);
});

test('travel and fade are CSS variables too', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  Object.assign(container.vars, { '--sn-travel': '50%', '--sn-fade': '0.2' });
  t.refresh(container);
  t.begin(lower, upper);
  t.apply(lower, upper, 0);
  assert.equal(upper.el.style.transform, shift('50'));
  assert.equal(upper.el.style.opacity, '0.2');
  t.apply(lower, upper, 0.5);
  assert.equal(upper.el.style.opacity, '0.6');
  t.end(lower, upper);
});

test('apply works with no lower page (first push)', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, upper } = entries();
  t.refresh(container);
  t.begin(null, upper);
  t.apply(null, upper, 0);
  assert.equal(upper.el.style.transform, shift('100'));
  t.end(null, upper);
});

test('apply reads no layout, so the width never enters JavaScript', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  Object.defineProperty(container, 'clientWidth', {
    get() {
      throw new Error('the transition measured the container');
    },
  });
  t.refresh(container);
  t.begin(lower, upper);
  t.apply(lower, upper, 0.25);
  t.end(lower, upper);
});

test('the curve is handed to CSS, not evaluated for it', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(t.ease.css, 'cubic-bezier(0.32, 0.72, 0, 1)');
  assert.equal(t.settle({ remainingPx: 100, velocity: 900 }).ease.css, 'cubic-bezier(0.2, 0.8, 0.2, 1)');
  container.vars['--sn-easing'] = 'ease-in';
  t.refresh();
  assert.equal(t.ease.css, 'cubic-bezier(0.42, 0, 1, 1)', 'a curve parsed from CSS can be spelled back for CSS');
  t.end(lower, upper);
});

test('CSS variables on the container override the JS options', () => {
  const t = createNativeTransition({ platform: 'ios', duration: 500, parallax: 0.3, dimMax: 0.1 });
  const { container, lower, upper } = entries();
  Object.assign(container.vars, {
    '--sn-duration': '0.2s',
    '--sn-parallax': '50%',
    '--sn-dim-max': '0.4',
    '--sn-dim-color': '#123456',
    '--sn-shadow': 'none',
    '--sn-easing': 'linear',
    '--sn-time-scale': '2',
  });
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(t.duration, 400, '200ms × timeScale 2');
  assert.equal(t.ease(0.25), 0.25, 'linear');
  assert.equal(t.resolved.shadow, 'none');
  t.apply(lower, upper, 0.5);
  assert.equal(lower.el.style.transform, shift('-25'), 'parallax 50% of a half-open page');
  assert.equal(lower.el.children[0].style.opacity, '0.2');
  assert.equal(t.resolved.dimColor, '#123456');
  assert.equal(lower.el.children[0].vars['--sn-dim-fallback'], t.options.dimColor);
  assert.equal(t.options.duration, 500, 'the JS options are left alone');
  assert.equal(t.resolved.duration, 200, 'resolved reports what is in force');
  t.end(lower, upper);
});

test('unset variables fall through to the JS options', () => {
  const t = createNativeTransition({ platform: 'ios', duration: 300, parallax: 0.5 });
  const { container, lower, upper } = entries();
  container.vars['--sn-duration'] = 'not-a-time';
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(t.duration, 300, 'an unparseable value is ignored');
  t.apply(lower, upper, 1);
  assert.equal(lower.el.style.transform, shift('-50'));
  t.end(lower, upper);
});

test('settle timing and curve come from the variables too', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  Object.assign(container.vars, { '--sn-settle-min': '50ms', '--sn-settle-max': '80ms', '--sn-settle-easing': 'linear' });
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(t.settle({ remainingPx: 10, velocity: 5000 }).duration, 50);
  assert.equal(t.settle({ remainingPx: 5000, velocity: 100 }).duration, 80);
  assert.equal(t.settle({ remainingPx: 10, velocity: 5000 }).ease(0.5), 0.5);
  t.end(lower, upper);
});

test('refresh re-reads variables changed mid-stack', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(t.duration, 500);
  container.vars['--sn-duration'] = '120ms';
  t.refresh();
  assert.equal(t.duration, 120);
  t.end(lower, upper);
});

test('zero is a value, not an absence', () => {
  const t = createNativeTransition({ platform: 'ios', parallax: 0.3, dimMax: 0.1, duration: 500 });
  const { container, lower, upper } = entries();
  Object.assign(container.vars, { '--sn-parallax': '0', '--sn-dim-max': '0', '--sn-duration': '0ms', '--sn-time-scale': '0' });
  t.refresh(container);
  t.begin(lower, upper);
  t.apply(lower, upper, 1);
  assert.equal(t.resolved.parallax, 0, 'a flat transition is a legitimate thing to ask for');
  assert.equal(t.resolved.dimMax, 0);
  assert.equal(t.duration, 0);
  assert.equal(lower.el.children[0].style.opacity, '', 'a dim of zero is the overlay left alone');
  assert.equal(lower.el.style.transform, '', 'and a parallax of zero leaves the page where the stylesheet puts it');
  t.end(lower, upper);
});

test('ease and settleEase are settable from JS as well', () => {
  const ease = (x: number) => x * x;
  const settleEase = (x: number) => 1 - x;
  const t = createNativeTransition({ platform: 'ios', ease, settleEase });
  const { container, upper } = entries();
  t.refresh(container);
  t.begin(null, upper);
  assert.equal(t.ease, ease);
  assert.equal(t.settle({ remainingPx: 100, velocity: 1000 }).ease, settleEase);
  t.end(null, upper);
});

test('an easing the engine cannot read never reaches the tween', () => {
  const t = createNativeTransition({ platform: 'ios' });
  const { container, lower, upper } = entries();
  container.vars['--sn-easing'] = '__proto__';
  t.refresh(container);
  t.begin(lower, upper);
  assert.equal(typeof t.ease, 'function', 'falls back to the default curve');
  assert.equal(t.ease, easings.ios);
  t.end(lower, upper);
});
