import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryTracker } from '../src/history-tracker.ts';

test('the first entry is imperative with nothing behind it', () => {
  const t = createHistoryTracker();
  assert.deepEqual(t.record('a', 'POP'), { trigger: 'imperative', historyDelta: undefined });
  assert.equal(t.canGoBack, false);
  assert.equal(t.previousKey, null);
});

test('push, then back and forward, report their deltas', () => {
  const t = createHistoryTracker();
  t.record('a', 'POP');
  assert.deepEqual(t.record('b', 'PUSH'), { trigger: 'imperative', historyDelta: undefined });
  t.record('c', 'PUSH');
  assert.equal(t.previousKey, 'b');
  assert.deepEqual(t.record('a', 'POP'), { trigger: 'history', historyDelta: -2 });
  assert.deepEqual(t.record('b', 'POP'), { trigger: 'history', historyDelta: 1 });
  assert.equal(t.currentKey, 'b');
});

test('recording the current key again is a no-op that returns the same record', () => {
  const t = createHistoryTracker();
  t.record('a', 'POP');
  const r = t.record('b', 'PUSH');
  assert.equal(t.record('b', 'PUSH'), r);
  assert.equal(t.record('b', 'POP'), r);
});

test('replace keeps the entry behind it', () => {
  const t = createHistoryTracker();
  t.record('a', 'POP');
  t.record('b', 'PUSH');
  t.record('c', 'REPLACE');
  assert.equal(t.previousKey, 'a');
  assert.deepEqual(t.record('a', 'POP'), { trigger: 'history', historyDelta: -1 });
});

test('a push after going back drops the forward entries', () => {
  const t = createHistoryTracker();
  t.record('a', 'POP');
  t.record('b', 'PUSH');
  t.record('a', 'POP');
  t.record('c', 'PUSH');
  assert.deepEqual(t.record('b', 'POP'), { trigger: 'history', historyDelta: undefined });
});
