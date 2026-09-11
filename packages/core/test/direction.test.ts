import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDirection, createDirectionResolver, defaultStrategies, fromHint, fromHistory, fromStack, fromLevel, fromTree, always, segmentsOf } from '../src/direction.ts';

const ref = (url, extra = {}) => ({ key: url, segments: segmentsOf(url), ...extra });
const ctx = (from, to, extra = {}) => ({ from: from && ref(from), to: ref(to), ...extra });

test('segmentsOf ignores query, fragment and empty parts', () => {
  assert.deepEqual(segmentsOf('/items/42?x=1#top'), ['items', '42']);
  assert.deepEqual(segmentsOf('/'), []);
  assert.deepEqual(segmentsOf('a//b/'), ['a', 'b']);
});

test('fromHint honours an explicit direction and ignores auto', () => {
  assert.equal(fromHint()(ctx('/a', '/b', { hint: 'pop' })), 'pop');
  assert.equal(fromHint()(ctx('/a', '/b', { hint: 'auto' })), 'auto');
  assert.equal(resolveDirection([fromHint()], ctx('/a', '/b', { hint: 'auto' }), 'replace'), 'replace');
});

test('fromHistory: back pops, forward pushes, unknown delta gives no answer', () => {
  const s = fromHistory();
  assert.equal(s(ctx('/a', '/b', { trigger: 'history', historyDelta: -1 })), 'pop');
  assert.equal(s(ctx('/a', '/b', { trigger: 'history', historyDelta: 2 })), 'push');
  assert.equal(s(ctx('/a', '/b', { trigger: 'history' })), undefined);
  assert.equal(s(ctx('/a', '/b', { trigger: 'imperative', historyDelta: -1 })), undefined);
});

test('fromStack pops back to a page still kept beneath the top', () => {
  const s = fromStack();
  assert.equal(s(ctx('/c', '/a', { stack: ['/a', '/b', '/c'] })), 'pop');
  assert.equal(s(ctx('/c', '/c', { stack: ['/a', '/b', '/c'] })), undefined, 'the top itself');
  assert.equal(s(ctx('/c', '/x', { stack: ['/a', '/b', '/c'] })), undefined);
  assert.equal(s(ctx('/c', '/a', {})), undefined);
});

test('fromLevel compares explicit numbers', () => {
  const s = fromLevel();
  assert.equal(s({ from: ref('/a', { level: 1 }), to: ref('/b', { level: 2 }) }), 'push');
  assert.equal(s({ from: ref('/a', { level: 3 }), to: ref('/b', { level: 2 }) }), 'pop');
  assert.equal(s({ from: ref('/a', { level: 2 }), to: ref('/b', { level: 2 }) }), 'replace');
  assert.equal(fromLevel({ sameLevel: 'push' })({ from: ref('/a', { level: 2 }), to: ref('/b', { level: 2 }) }), 'push');
  assert.equal(s({ from: ref('/a'), to: ref('/b', { level: 2 }) }), undefined, 'needs both');
  assert.equal(s({ from: null, to: ref('/b', { level: 2 }) }), undefined);
});

test('fromTree reads the route tree', () => {
  const s = fromTree();
  assert.equal(s(ctx('/items', '/items/42')), 'push', 'descendant');
  assert.equal(s(ctx('/items/42', '/items')), 'pop', 'ancestor');
  assert.equal(s(ctx('/items/42', '/items/42/edit')), 'push');
  assert.equal(s(ctx('/items/42', '/settings')), 'pop', 'unrelated but shallower');
  assert.equal(s(ctx('/settings', '/items/42')), 'push', 'unrelated but deeper');
  assert.equal(s(ctx('/items/1', '/items/2')), 'replace', 'siblings');
  assert.equal(fromTree({ sameDepth: 'push' })(ctx('/items/1', '/items/2')), 'push');
  assert.equal(s(ctx('/a', '/a')), 'replace', 'same page');
  assert.equal(s(ctx(null, '/a')), undefined, 'nothing to compare against');
  assert.equal(s({ from: { key: 'x' }, to: ref('/a') }), undefined, 'no segments');
});

test('resolveDirection takes the first answer and falls back', () => {
  const strategies = [() => undefined, () => null, () => 'auto', () => 'pop', () => 'push'];
  assert.equal(resolveDirection(strategies, ctx('/a', '/b')), 'pop');
  assert.equal(resolveDirection([() => undefined], ctx('/a', '/b')), 'push');
  assert.equal(resolveDirection([], ctx('/a', '/b'), 'replace'), 'replace');
  assert.equal(resolveDirection([always('replace')], ctx('/a', '/b')), 'replace');
});

test('the default strategies prefer hint, then history, then stack, then level, then tree', () => {
  const resolve = createDirectionResolver();
  assert.equal(resolve.strategies.length, defaultStrategies().length);
  assert.equal(resolve.fallback, 'push');
  // hint beats everything
  assert.equal(resolve(ctx('/items', '/items/42', { hint: 'replace', trigger: 'history', historyDelta: -1 })), 'replace');
  // browser back beats the tree
  assert.equal(resolve(ctx('/items', '/items/42', { trigger: 'history', historyDelta: -1 })), 'pop');
  // a kept page beats numbering and the tree
  assert.equal(resolve({ from: ref('/a', { level: 1 }), to: ref('/b', { level: 5 }), stack: ['/b', '/a'] }), 'pop');
  // numbering beats the tree
  assert.equal(resolve({ from: ref('/items', { level: 5 }), to: ref('/items/42', { level: 1 }) }), 'pop');
  // the tree decides otherwise
  assert.equal(resolve(ctx('/items', '/items/42')), 'push');
  assert.equal(resolve(ctx('/items/42', '/items')), 'pop');
  // nothing known at all: fallback
  assert.equal(resolve({ from: null, to: { key: 'x' } }), 'push');
});
