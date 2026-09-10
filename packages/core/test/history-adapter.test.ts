import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { NavigationStack } from '../src/navigation-stack.ts';
import { attachBrowserHistory, isIOSBrowser } from '../src/history-adapter.ts';

installGlobals();

const instant = { duration: 0, ease: (t) => t, settle: () => ({ duration: 0, ease: (t) => t }), apply() {} };

let stack, entries, index, popstate, calls;

beforeEach(async () => {
  entries = [{}];
  index = 0;
  calls = [];
  popstate = null;
  globalThis.history = {
    get state() {
      return entries[index];
    },
    pushState(s) {
      calls.push(['push', s]);
      entries.splice(index + 1);
      entries.push(s);
      index++;
    },
    replaceState(s) {
      calls.push(['replace', s]);
      entries[index] = s;
    },
    go(n) {
      calls.push(['go', n]);
      index = Math.max(0, Math.min(entries.length - 1, index + n));
      popstate?.({ state: entries[index] });
    },
    back() {
      this.go(-1);
    },
  };
  globalThis.window = {
    addEventListener: (t, fn) => t === 'popstate' && (popstate = fn),
    removeEventListener: (t) => t === 'popstate' && (popstate = null),
  };
  stack = new NavigationStack({ container: makeElement('div'), transition: instant });
  await stack.push(makeElement('section'));
});

test('attach writes the current depth into history.state', () => {
  attachBrowserHistory(stack);
  assert.deepEqual(history.state, { snDepth: 0 });
});

test('push adds a history entry; pop walks it back', async () => {
  attachBrowserHistory(stack);
  await stack.push(makeElement('section'));
  assert.deepEqual(history.state, { snDepth: 1 });
  await stack.push(makeElement('section'));
  assert.deepEqual(history.state, { snDepth: 2 });
  await stack.popTo(1);
  assert.deepEqual(calls[calls.length - 1], ['go', -2]);
  assert.deepEqual(history.state, { snDepth: 0 });
  assert.equal(stack.depth, 1);
});

test('browser back pops the stack', async () => {
  attachBrowserHistory(stack, { animateHistoryPop: false });
  await stack.push(makeElement('section'));
  await stack.push(makeElement('section'));
  const events = [];
  stack.on('pop', (d) => events.push(d));
  history.go(-1);
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(stack.depth, 2);
  assert.equal(events[0].source, 'history');
  assert.equal(calls.filter(([k]) => k === 'go').length, 1, 'no echo back into history');
});

test('browser forward with no handler bounces back', async () => {
  attachBrowserHistory(stack);
  await stack.push(makeElement('section'));
  history.go(-1);
  await new Promise((r) => setTimeout(r, 5));
  calls.length = 0;
  history.go(1);
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(calls.map(([k, v]) => [k, v]).filter(([k]) => k === 'go'), [['go', 1], ['go', -1]]);
  assert.equal(stack.depth, 1);
});

test('onForward is called instead of bouncing', async () => {
  let target;
  attachBrowserHistory(stack, { onForward: (t) => (target = t) });
  await stack.push(makeElement('section'));
  history.go(-1);
  await new Promise((r) => setTimeout(r, 5));
  history.go(1);
  assert.equal(target, 2);
});

test('the detach function stops listening', async () => {
  const off = attachBrowserHistory(stack);
  off();
  assert.equal(popstate, null);
  calls.length = 0;
  await stack.push(makeElement('section'));
  assert.equal(calls.length, 0);
});

test('isIOSBrowser is false without a navigator', () => {
  assert.equal(isIOSBrowser(), false);
});
