import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDirectionResolver, segmentsOf, type RouteRef } from '@stacknav/core';
import { activate, createModel, dropPending, removed, restore, top, type StackModel } from '../src/model.ts';

const resolve = createDirectionResolver();
let n = 0;
const el = () => ({ id: ++n }) as unknown as HTMLElement;
const ref = (path: string, level?: number): RouteRef => ({ key: path, segments: segmentsOf(path), level });

function show(model: StackModel, path: string, opts: { level?: number; nav?: Parameters<typeof activate>[2]; onScreen?: boolean; animated?: boolean } = {}) {
  return activate(model, ref(path, opts.level), opts.nav, {
    resolve,
    animated: opts.animated ?? true,
    node: path,
    previousNode: 'prev',
    createElement: el,
    isOnScreen: () => opts.onScreen ?? false,
  });
}
const keys = (m: StackModel) => m.views.map((v) => v.key).join(',');

test('the first page is pushed without animation', () => {
  const m = createModel();
  const a = show(m, '/')!;
  assert.equal(a.direction, 'push');
  assert.equal(a.animated, false);
  assert.equal(a.reused, false);
  assert.equal(a.present, true);
  assert.equal(keys(m), '/');
  assert.equal(m.mounted.length, 1);
});

test('activating the same key again does nothing', () => {
  const m = createModel();
  show(m, '/');
  assert.equal(show(m, '/'), null);
  assert.equal(m.mounted.length, 1);
});

test('a descendant pushes and the leaving page keeps its last node', () => {
  const m = createModel();
  show(m, '/');
  const a = show(m, '/items/3')!;
  assert.equal(a.direction, 'push');
  assert.equal(a.animated, true);
  assert.equal(keys(m), '/,/items/3');
  assert.equal(m.views[0].node, 'prev');
  assert.equal(m.views[1].node, '/items/3');
});

test('going back to a kept page pops and drops everything above it', () => {
  const m = createModel();
  show(m, '/');
  show(m, '/items/3');
  show(m, '/items/3/reviews');
  const a = show(m, '/')!;
  assert.equal(a.direction, 'pop');
  assert.equal(a.reused, true);
  assert.equal(a.present, true);
  assert.equal(keys(m), '/');
  // the dropped pages stay mounted until the stack says they are gone
  assert.equal(m.mounted.length, 3);
  const gone = removed(m, [m.mounted[1].el, m.mounted[2].el], false);
  assert.equal(gone.length, 2);
  assert.equal(m.mounted.length, 1);
});

test('an ancestor that is not kept pops onto a fresh page', () => {
  const m = createModel();
  show(m, '/items/3'); // deep link
  const a = show(m, '/')!;
  assert.equal(a.direction, 'pop');
  assert.equal(a.reused, false);
  assert.equal(keys(m), '/');
});

test('a sibling replaces, and a hint overrides', () => {
  const m = createModel();
  show(m, '/');
  show(m, '/items/1');
  assert.equal(show(m, '/items/2')!.direction, 'replace');
  assert.equal(keys(m), '/,/items/2');
  assert.equal(show(m, '/items/3', { nav: { hint: 'push' } })!.direction, 'push');
  assert.equal(keys(m), '/,/items/2,/items/3');
});

test('numbers on the routes decide between unrelated pages', () => {
  const m = createModel();
  show(m, '/');
  assert.equal(show(m, '/settings', { level: 2 })!.direction, 'push');
  assert.equal(show(m, '/about', { level: 3 })!.direction, 'push');
  assert.equal(show(m, '/settings', { level: 2 })!.direction, 'pop');
  assert.equal(keys(m), '/,/settings');
});

test('browser back is a pop even to a page that is not kept', () => {
  const m = createModel();
  show(m, '/about', { level: 3 });
  const a = show(m, '/settings', { level: 2, nav: { trigger: 'history', historyDelta: -1 } })!;
  assert.equal(a.direction, 'pop');
});

test('animated: false on the navigation is honoured', () => {
  const m = createModel();
  show(m, '/');
  assert.equal(show(m, '/items/7', { nav: { animated: false } })!.animated, false);
  assert.equal(show(m, '/items/8', { animated: false })!.animated, false);
});

test('a swipe leaves the page mounted until the router lands elsewhere', () => {
  const m = createModel();
  show(m, '/');
  show(m, '/items/3');
  const popped = m.views[1];
  removed(m, [popped.el], true);
  assert.equal(keys(m), '/');
  assert.equal(popped.pendingRemoval, true);
  assert.equal(m.mounted.length, 2);
  assert.equal(top(m)!.key, '/');
  // the router catches up: the revealed page is already on screen, nothing to present
  const a = show(m, '/', { onScreen: true })!;
  assert.equal(a.present, false);
  assert.equal(a.reused, true);
  assert.equal(dropPending(m).length, 1);
  assert.equal(m.mounted.length, 1);
});

test('a swipe followed by a navigation to a third page replaces rather than pops', () => {
  const m = createModel();
  show(m, '/');
  show(m, '/items/3');
  removed(m, [m.views[1].el], true);
  const a = show(m, '/items/3/reviews', { nav: { trigger: 'history', historyDelta: -1 } })!;
  // history says pop, but the popped page is gone and the page beneath is showing
  assert.equal(a.direction, 'replace');
  assert.equal(keys(m), '/items/3/reviews');
});

test('the router refusing a swipe puts the page back', () => {
  const m = createModel();
  show(m, '/');
  show(m, '/items/3');
  const popped = m.views[1];
  removed(m, [popped.el], true);
  assert.equal(restore(m, popped), true);
  assert.equal(keys(m), '/,/items/3');
  assert.equal(popped.pendingRemoval, false);
  assert.equal(restore(m, popped), false);
});

test('the router coming straight back to a swiped page restores it without animating', () => {
  const m = createModel();
  show(m, '/');
  show(m, '/items/3');
  const popped = m.views[1];
  removed(m, [popped.el], true);
  // the key is still the popped page's: nothing happens until the router moves
  assert.equal(show(m, '/items/3'), null);
  // the router moved to another page, then back to the swiped one before the stack was told to drop it
  m.lastKey = '/';
  const a = show(m, '/items/3')!;
  assert.equal(a.page, popped);
  assert.equal(a.animated, false);
  assert.equal(keys(m), '/,/items/3');
  assert.equal(m.mounted.length, 2);
});

test('each page gets a unique id even when keys repeat', () => {
  const m = createModel();
  show(m, '/');
  show(m, '/items/1');
  removed(m, [m.views[1].el], false); // a pop finished before the router came back to it
  m.views.splice(1);
  m.lastKey = '/';
  show(m, '/items/1');
  const ids = m.mounted.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});
