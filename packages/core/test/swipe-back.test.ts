import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installGlobals, makeElement } from './dom-stub.ts';
import { createIOSStack } from '../src/index.ts';

installGlobals();
const property = 'overscroll-behavior-x';
function setup(root = makeElement('html')) {
  const container = makeElement();
  container.ownerDocument = { documentElement: root };
  const stack = createIOSStack({ container });
  return { root, container, stack };
}

test('browser is the default; live modes install and remove only our gesture', async () => {
  const { root, container, stack } = setup();
  root.style.setProperty(property, 'auto');
  await stack.push(makeElement(), { animated: false });
  await stack.push(makeElement(), { animated: false });
  const pages = stack.entries.slice();
  assert.equal(stack.swipeBack, 'browser');
  assert.equal(container.children.some((el) => el.className === 'sn-edge'), false);
  for (let i = 0; i < 2; i++) {
    stack.setSwipeBack('custom');
    stack.setSwipeBack('custom');
    assert.equal(container.children.filter((el) => el.className === 'sn-edge').length, 1);
    assert.equal(root.style.getPropertyValue(property), 'contain');
    stack.setSwipeBack('disabled');
    assert.equal(container.children.some((el) => el.className === 'sn-edge'), false);
    assert.equal(container.classList.contains('sn-swipe-custom'), false);
    assert.equal(root.style.getPropertyValue(property), 'contain');
    stack.setSwipeBack('browser');
    assert.equal(root.style.getPropertyValue(property), 'auto');
    assert.deepEqual(stack.entries, pages);
  }
  stack.destroy();
});

test('shared suppression lasts until the last stack releases it, restoring inline priority', () => {
  const { root, stack: a } = setup();
  root.style.setProperty(property, 'none', 'important');
  const { stack: b } = setup(root);
  a.setSwipeBack('disabled');
  b.setSwipeBack('custom');
  a.setSwipeBack('browser');
  assert.equal(root.style.getPropertyValue(property), 'contain');
  a.destroy();
  b.destroy();
  assert.equal(root.style.getPropertyValue(property), 'none');
  assert.equal(root.style.getPropertyPriority(property), 'important');
  b.setSwipeBack('custom');
  assert.equal(root.style.getPropertyValue(property), 'none', 'destroyed stack cannot reacquire suppression');
});

test('cleanup removes its own declaration but preserves newer application styles', () => {
  const { root, stack } = setup();
  stack.setSwipeBack('disabled');
  stack.setSwipeBack('browser');
  assert.equal(root.style.getPropertyValue(property), '');
  stack.setSwipeBack('disabled');
  root.style.setProperty(property, 'none');
  stack.destroy();
  assert.equal(root.style.getPropertyValue(property), 'none');
});

test('changing mode during a drag cancels it without popping or leaving the stack busy', async () => {
  const { stack, container } = setup();
  await stack.push(makeElement(), { animated: false });
  await stack.push(makeElement(), { animated: false });
  stack.setSwipeBack('custom');
  const strip = container.children.find((el) => el.className === 'sn-edge');
  const pointer = (x) => ({ bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: 0 });
  strip.dispatch('pointerdown', pointer(5));
  strip.dispatch('pointermove', pointer(250));
  assert.equal(stack.busy, true);
  stack.setSwipeBack('browser');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(stack.depth, 2);
  assert.equal(stack.busy, false);
  stack.setSwipeBack('custom');
  assert.equal(container.children.filter((el) => el.className === 'sn-edge').length, 1);
  stack.destroy();
});

test('destroy during a drag cancels queued navigation instead of remounting pages', async () => {
  const { stack, container } = setup();
  await stack.push(makeElement(), { animated: false });
  await stack.push(makeElement(), { animated: false });
  stack.setSwipeBack('custom');
  const strip = container.children.find((el) => el.className === 'sn-edge');
  const pointer = (x) => ({ bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: 0 });
  strip.dispatch('pointerdown', pointer(5));
  strip.dispatch('pointermove', pointer(250));
  assert.equal(stack.busy, true);
  const pages = stack.entries.slice();
  let factoryCalls = 0;
  const events: string[] = [];
  stack.on('push', () => events.push('push'));
  stack.on('transitionend', () => events.push('transitionend'));
  const pending = Promise.allSettled([
    stack.push(() => { factoryCalls++; return makeElement(); }),
    stack.present(makeElement(), 'replace'),
  ]);
  stack.destroy();
  const results = await pending;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(factoryCalls, 0, 'queued factories never execute after destruction');
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'rejected']);
  for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.name, 'AbortError');
  assert.equal(stack.depth, 0);
  assert.equal(container.children.length, 0);
  assert.equal(stack.busy, false);
  assert.equal(container.style.getPropertyValue('--sn-t'), '');
  assert.deepEqual(events, []);
  for (const { el } of pages) {
    assert.equal(el.children.length, 0, 'transition overlays are cleaned up');
    assert.equal(el.style.boxShadow, '', 'transition shadows are cleaned up');
  }
  await assert.rejects(stack.push(makeElement()), { name: 'AbortError' });
});
