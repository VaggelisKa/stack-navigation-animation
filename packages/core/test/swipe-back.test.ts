import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installGlobals, makeElement } from './dom-stub.ts';
import { createNativeStack } from '../src/index.ts';

installGlobals();
const property = 'overscroll-behavior-x';
function setup(root = makeElement('html')) {
  const container = makeElement();
  container.ownerDocument = { documentElement: root };
  const stack = createNativeStack({ container });
  return { root, container, stack };
}

test('browser is the default; live modes only request and release suppression', async () => {
  const { root, stack } = setup();
  root.style.setProperty(property, 'auto');
  await stack.push(makeElement(), { animated: false });
  await stack.push(makeElement(), { animated: false });
  const pages = stack.entries.slice();
  assert.equal(stack.swipeBack, 'browser');
  assert.equal(root.style.getPropertyValue(property), 'auto', 'browser mode leaves the document alone');
  for (let i = 0; i < 2; i++) {
    stack.setSwipeBack('disabled');
    stack.setSwipeBack('disabled');
    assert.equal(root.style.getPropertyValue(property), 'contain');
    stack.setSwipeBack('browser');
    assert.equal(root.style.getPropertyValue(property), 'auto');
    assert.deepEqual(stack.entries, pages, 'switching modes keeps the pages');
  }
  stack.destroy();
});

test('custom is no longer a mode', () => {
  const { stack } = setup();
  assert.throws(() => (stack.setSwipeBack as (mode: string) => void)('custom'), { name: 'TypeError' });
  assert.equal(stack.swipeBack, 'browser', 'a refused mode leaves the policy as it was');
  stack.destroy();
});

test('shared suppression lasts until the last stack releases it, restoring inline priority', () => {
  const { root, stack: a } = setup();
  root.style.setProperty(property, 'none', 'important');
  const { stack: b } = setup(root);
  a.setSwipeBack('disabled');
  b.setSwipeBack('disabled');
  a.setSwipeBack('browser');
  assert.equal(root.style.getPropertyValue(property), 'contain');
  a.destroy();
  b.destroy();
  assert.equal(root.style.getPropertyValue(property), 'none');
  assert.equal(root.style.getPropertyPriority(property), 'important');
  b.setSwipeBack('disabled');
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

test('destroy during an app-driven interactive pop cancels queued navigation instead of remounting pages', async () => {
  const { stack, container } = setup();
  await stack.push(makeElement(), { animated: false });
  await stack.push(makeElement(), { animated: false });
  // What an app that owns the edge does with its own pointer handling.
  const handle = stack.beginInteractivePop();
  assert.ok(handle);
  handle.update(0.4);
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
  // A drag released after destruction must not resurrect the page it was popping.
  await handle.finish({ complete: true });
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
