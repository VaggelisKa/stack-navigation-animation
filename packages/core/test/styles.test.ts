import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STACKNAV_CSS } from '../src/styles.ts';

test('the stylesheet disables browser-owned transitions for reduced motion', () => {
  assert.match(STACKNAV_CSS, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(STACKNAV_CSS, /--sn-t:0s!important/);
});
