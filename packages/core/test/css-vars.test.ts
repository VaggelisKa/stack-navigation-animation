import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { cssVars, parseEasing, parseNumber, parseRatio, parseTime } from '../src/css-vars.ts';
import { easings } from '../src/animate.ts';

installGlobals();

test('parseTime reads ms, s and bare numbers', () => {
  assert.equal(parseTime('500ms'), 500);
  assert.equal(parseTime('0.4s'), 400);
  assert.equal(parseTime('.5S'), 500);
  assert.equal(parseTime('300'), 300);
  assert.equal(parseTime('fast'), undefined);
  assert.equal(parseTime('1.2.3ms'), undefined);
  assert.equal(parseTime(undefined), undefined);
});

test('parseRatio treats 30% and 0.3 alike', () => {
  assert.equal(parseRatio('0.3'), 0.3);
  assert.equal(parseRatio('30%'), 0.3);
  assert.equal(parseRatio('0'), 0);
  assert.equal(parseRatio('half%'), undefined);
  assert.equal(parseNumber('900'), 900);
  assert.equal(parseNumber('900px'), undefined);
});

test('parseEasing accepts keywords and cubic-bezier', () => {
  assert.equal(parseEasing('linear'), easings.linear);
  assert.equal(parseEasing('ios'), easings.ios);
  assert.equal(parseEasing('ios-settle'), easings.easeOut);
  const curve = parseEasing('cubic-bezier(0.32, 0.72, 0, 1)');
  assert.equal(typeof curve, 'function');
  assert.ok(Math.abs(curve!(0.5) - easings.ios(0.5)) < 1e-9, 'same curve as the ios easing');
  assert.equal(parseEasing('cubic-bezier(0, 1)'), undefined, 'needs four numbers');
  assert.equal(parseEasing('springy'), undefined);
  assert.equal(parseEasing('android'), easings.android);
  assert.equal(parseEasing('android-settle'), easings.androidSettle);
});

test('parseEasing accepts linear() with and without positions', () => {
  const even = parseEasing('linear(0, 0.5, 1)')!;
  assert.equal(even(0.25), 0.25, 'unpositioned stops are spread evenly');
  assert.equal(even.css, 'linear(0, 0.5, 1)');
  const skewed = parseEasing('linear(0, 0.8 20%, 1)')!;
  assert.ok(Math.abs(skewed(0.1) - 0.4) < 1e-9);
  assert.ok(Math.abs(skewed(0.6) - 0.9) < 1e-9);
  assert.equal(skewed(1), 1);
  const held = parseEasing('linear(0, 1 30% 60%, 0.5)')!;
  assert.equal(held(0.45), 1, 'two positions hold the value between them');
  assert.equal(held(1), 0.5);
  const backwards = parseEasing('linear(0, 0.5 60%, 0.7 40%, 1)')!;
  assert.ok(Math.abs(backwards(0.8) - 0.85) < 1e-9, 'a position never goes back: the 40% stop is pushed to 60%');
  const android = parseEasing(easings.android.css)!;
  assert.ok(Math.abs(android(0.2) - easings.android(0.2)) < 0.01, 'the spelling round-trips within the sampling tolerance');
  assert.equal(parseEasing('linear(1)'), undefined, 'needs two stops');
  assert.equal(parseEasing('linear(0, 1 20px)'), undefined, 'positions are percentages');
});

test('cssVars inherits from ancestors and ignores blanks', () => {
  const root = makeElement('div');
  const child = makeElement('div');
  root.append(child);
  root.vars['--sn-duration'] = ' 250ms ';
  child.vars['--sn-parallax'] = '';
  const read = cssVars(child);
  assert.equal(read('--sn-duration'), '250ms');
  assert.equal(read('--sn-parallax'), undefined, 'blank counts as unset');
  assert.equal(read('--sn-nope'), undefined);
  assert.equal(cssVars(null)('--sn-duration'), undefined);
});

test('parseEasing does not mistake inherited object keys for curves', () => {
  // The keyword map is null-prototype. Before that, `__proto__` returned
  // Object.prototype, which is truthy but not callable, and the resulting
  // TypeError was thrown inside a rAF callback where nothing could catch it,
  // leaving the stack busy forever.
  for (const word of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
    assert.equal(parseEasing(word), undefined, word);
  }
});

test('parseEasing rejects bezier control points CSS would reject', () => {
  assert.equal(typeof parseEasing('cubic-bezier(0, -2, 1, 3)'), 'function', 'y is unbounded');
  assert.equal(parseEasing('cubic-bezier(2, 0, -1, 1)'), undefined, 'x must be within [0, 1]');
  assert.equal(parseEasing('cubic-bezier(0, 0, 1.5, 1)'), undefined);
  assert.equal(parseEasing('cubic-bezier(0, 0, 1, 1, 1)'), undefined, 'needs exactly four');
  assert.equal(parseEasing('cubic-bezier(0, 0, x, 1)'), undefined);
});

test('the parsers all tolerate surrounding whitespace from a stylesheet', () => {
  assert.equal(parseTime(' 250ms '), 250);
  assert.equal(parseNumber(' 900 '), 900);
  assert.equal(parseRatio(' 30% '), 0.3);
  assert.equal(parseEasing(' LINEAR '), easings.linear);
});

test('calc() is not understood, and falls back rather than breaking', () => {
  // Unregistered custom properties reach getComputedStyle with math functions
  // unevaluated, so this is what the engine actually sees. Documented, not fixed.
  assert.equal(parseTime('calc(2 * 100ms)'), undefined);
  assert.equal(parseRatio('calc(30% / 2)'), undefined);
});
