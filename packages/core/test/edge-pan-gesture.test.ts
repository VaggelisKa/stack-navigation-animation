import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { NavigationStack } from '../src/navigation-stack.ts';
import { createEdgePanGesture } from '../src/edge-pan-gesture.ts';

installGlobals();

const instant = { duration: 0, ease: (t) => t, settle: () => ({ duration: 0, ease: (t) => t }), apply() {} };

let container, stack, gesture, strip, now;
const ptr = (x, y = 0, extra = {}) => ({ bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, ...extra });

beforeEach(async () => {
  now = 0;
  globalThis.performance = { now: () => now };
  container = makeElement('div');
  stack = new NavigationStack({ container, transition: instant });
  gesture = createEdgePanGesture().attach(stack);
  strip = container.children[0];
  await stack.push(makeElement('section'));
  await stack.push(makeElement('section'));
});

test('the strip states what is true and lets CSS decide whether to show it', async () => {
  assert.equal(strip.classList.contains('sn-edge'), true, 'positioned by the stylesheet');
  assert.equal(strip.style.width, '28px');
  assert.equal(container.classList.contains('sn-can-pop'), true);

  await stack.pop();
  assert.equal(container.classList.contains('sn-can-pop'), false, 'nothing to go back to');

  gesture.options.anywhere = true;
  gesture.options.edgeWidth = 44;
  gesture.refresh();
  assert.equal(container.classList.contains('sn-anywhere'), true, 'the whole page is the target');
  assert.equal(strip.style.width, '44px');
});

test('a drag past the threshold completes the pop', async () => {
  strip.dispatch('pointerdown', ptr(5));
  now += 16;
  strip.dispatch('pointermove', ptr(20));
  assert.equal(stack.busy, true, 'interactive pop began');
  now += 16;
  strip.dispatch('pointermove', ptr(260));
  strip.dispatch('pointerup', ptr(260));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 1);
});

test('a short drag released slowly snaps back', async () => {
  strip.dispatch('pointerdown', ptr(5));
  now += 100;
  strip.dispatch('pointermove', ptr(40));
  now += 100;
  strip.dispatch('pointermove', ptr(60));
  strip.dispatch('pointerup', ptr(60));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 2);
});

test('a fast flick completes regardless of distance', async () => {
  strip.dispatch('pointerdown', ptr(5));
  now += 10;
  strip.dispatch('pointermove', ptr(20));
  now += 10;
  strip.dispatch('pointermove', ptr(60)); // 55px in 20ms = 2750 px/s
  strip.dispatch('pointerup', ptr(60));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 1);
});

test('vertical movement hands the touch back to scrolling', () => {
  strip.dispatch('pointerdown', ptr(5, 0));
  strip.dispatch('pointermove', ptr(8, 30));
  assert.equal(stack.busy, false);
  strip.dispatch('pointermove', ptr(200, 30));
  assert.equal(stack.busy, false, 'drag was abandoned');
});

test('pointercancel never completes', async () => {
  strip.dispatch('pointerdown', ptr(5));
  now += 16;
  strip.dispatch('pointermove', ptr(300));
  strip.dispatch('pointercancel', ptr(300));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 2);
});

test('drags on the container body only count when anywhere is on', async () => {
  container.dispatch('pointerdown', ptr(100));
  container.dispatch('pointermove', ptr(300));
  assert.equal(stack.busy, false);
  gesture.options.anywhere = true;
  container.dispatch('pointerdown', ptr(100));
  now += 16;
  container.dispatch('pointermove', ptr(300));
  assert.equal(stack.busy, true);
  container.dispatch('pointerup', ptr(300));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 1);
});

test('the click after a drag release is swallowed', async () => {
  strip.dispatch('pointerdown', ptr(5));
  now += 16;
  strip.dispatch('pointermove', ptr(300));
  strip.dispatch('pointerup', ptr(300));
  let prevented = false;
  container.dispatch('click', { preventDefault: () => (prevented = true), stopPropagation() {} });
  assert.equal(prevented, true);
  await new Promise((r) => setTimeout(r, 5));
  prevented = false;
  container.dispatch('click', { preventDefault: () => (prevented = true), stopPropagation() {} });
  assert.equal(prevented, false, 'only the immediate click is swallowed');
});

// The stylesheet puts the strip on the trailing edge for a right-to-left
// container, so back is a drag to the left. The recognizer has to read the same
// --sn-dir the transition does, or the default gesture stops working in RTL.
test('right-to-left: back is a drag toward the leading edge', async () => {
  container.vars['--sn-dir'] = '-1';
  strip.dispatch('pointerdown', ptr(395));
  now += 16;
  strip.dispatch('pointermove', ptr(380));
  assert.equal(stack.busy, true, 'a leftward drag begins the interactive pop');
  now += 16;
  strip.dispatch('pointermove', ptr(140));
  strip.dispatch('pointerup', ptr(140));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 1, 'and completes it');
});

test('right-to-left: a drag the other way is not a back gesture', async () => {
  container.vars['--sn-dir'] = '-1';
  strip.dispatch('pointerdown', ptr(20));
  now += 16;
  strip.dispatch('pointermove', ptr(300));
  assert.equal(stack.busy, false);
  strip.dispatch('pointerup', ptr(300));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 2);
});

// Velocity is averaged over the whole gesture, so a cancelling flick is one
// that ends up behind where it started. These two are mirror images: if the
// sign of the velocity did not follow --sn-dir, the right-to-left one would
// read as a fast flick forward and complete instead.
test('a flick back past the start cancels', async () => {
  strip.dispatch('pointerdown', ptr(5));
  now += 10;
  strip.dispatch('pointermove', ptr(200));
  now += 10;
  strip.dispatch('pointermove', ptr(-20)); // -1250 px/s, past cancelVelocity
  strip.dispatch('pointerup', ptr(-20));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 2);
});

test('right-to-left: a flick back past the start cancels too', async () => {
  container.vars['--sn-dir'] = '-1';
  strip.dispatch('pointerdown', ptr(395));
  now += 10;
  strip.dispatch('pointermove', ptr(200));
  now += 10;
  strip.dispatch('pointermove', ptr(420)); // the same flick, mirrored
  strip.dispatch('pointerup', ptr(420));
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 2, 'the velocity sign follows the reading direction too');
});

test('detach removes the strip and listeners', () => {
  gesture.detach();
  assert.equal(container.children.includes(strip), false);
  assert.equal(container.listeners.pointerdown?.size ?? 0, 0);
});


test('a bubbling move from the edge strip updates progress exactly once', () => {
  const seen = [];
  stack.on('progress', ({ p }) => seen.push(p));
  strip.dispatch('pointerdown', ptr(5));
  now += 16;
  strip.dispatch('pointermove', ptr(100));
  assert.equal(seen.length, 1);
  assert.equal(seen[0], 1 - (100 - 5 - gesture.options.startSlop) / stack.width());
});
