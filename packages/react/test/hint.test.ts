import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHint } from '../src/hint.ts';

test('a string hint is a direction', () => {
  assert.deepEqual(readHint({ stacknav: 'pop' }, 'stacknav'), { direction: 'pop' });
});

test('an object hint passes through', () => {
  assert.deepEqual(readHint({ stacknav: { direction: 'replace', animated: false } }, 'stacknav'), { direction: 'replace', animated: false });
});

test('anything else is no hint', () => {
  assert.equal(readHint(null, 'stacknav'), undefined);
  assert.equal(readHint('pop', 'stacknav'), undefined);
  assert.equal(readHint({ other: 'pop' }, 'stacknav'), undefined);
  assert.equal(readHint({ stacknav: null }, 'stacknav'), undefined);
});
