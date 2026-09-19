import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { NavigationStack } from '../src/navigation-stack.ts';

installGlobals();

/**
 * The runtime half of the read-only state tests: `entries` is handed out live
 * rather than copied, so a consumer that holds on to it keeps seeing the
 * stack, and `busy` still tracks the transition and the gesture exactly as it
 * did when it was a plain field. The type-level half -- that neither can be
 * written from outside -- is in `stack-state.types.test.ts`, where tsc checks
 * it.
 */

const instantTransition = () => ({
  duration: 0,
  ease: (t) => t,
  settle: () => ({ duration: 0, ease: (t) => t }),
  apply: () => {},
});

let container, stack;
const el = (id) => Object.assign(makeElement('section'), { id });

beforeEach(() => {
  container = makeElement('div');
  stack = new NavigationStack({ container, transition: instantTransition() });
});

test('entries is the same array on every read, and reflects pushes and pops', async () => {
  const live = stack.entries;
  assert.equal(stack.entries, live, 'identity is stable across reads');
  assert.deepEqual(live, []);

  await stack.push(el('a'));
  assert.equal(stack.entries, live, 'a push does not swap the array');
  assert.equal(live.length, 1);
  assert.equal(live[0].el.id, 'a');

  await stack.push(el('b'));
  assert.deepEqual(
    live.map((e) => e.el.id),
    ['a', 'b'],
  );

  await stack.pop();
  assert.equal(stack.entries, live);
  assert.deepEqual(
    live.map((e) => e.el.id),
    ['a'],
  );

  await stack.reset([el('x'), el('y')]);
  assert.equal(stack.entries, live, 'not even a reset swaps the array');
  assert.deepEqual(
    live.map((e) => e.el.id),
    ['x', 'y'],
  );
});

test('the entries on an event detail is a snapshot, not the live array', async () => {
  const seen = [];
  stack.on('push', (d) => seen.push(d.entries));
  await stack.push(el('a'));
  await stack.push(el('b'));
  assert.notEqual(seen[0], stack.entries);
  assert.equal(seen[0].length, 1, 'the first snapshot did not grow with the second push');
  assert.equal(seen[1].length, 2);
});

test('busy is true for the length of a transition and false after it', async () => {
  await stack.push(el('a'));
  assert.equal(stack.busy, false, 'settled between operations');
  const pending = stack.push(el('b'));
  assert.equal(stack.busy, true, 'while the push runs');
  assert.ok(container.classList.contains('sn-busy'));
  await pending;
  assert.equal(stack.busy, false);
  assert.equal(container.classList.contains('sn-busy'), false);
});

test('busy is true for the length of an interactive pop and false after it', async () => {
  await stack.push(el('a'));
  await stack.push(el('b'));
  assert.equal(stack.busy, false);
  const handle = stack.beginInteractivePop();
  assert.equal(stack.busy, true, 'while the gesture is held');
  handle.update(0.4);
  assert.equal(stack.busy, true, 'a drag does not end it');
  await handle.finish({ complete: true });
  assert.equal(stack.busy, false);
  assert.equal(stack.depth, 1);
});

test('busy comes back down when an interactive pop is cancelled', async () => {
  await stack.push(el('a'));
  await stack.push(el('b'));
  const handle = stack.beginInteractivePop();
  assert.equal(stack.busy, true);
  handle.cancel();
  assert.equal(stack.busy, false);
  assert.equal(stack.depth, 2, 'the page stayed');
});
