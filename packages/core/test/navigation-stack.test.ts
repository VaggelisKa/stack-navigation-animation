import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { NavigationStack } from '../src/navigation-stack.ts';

installGlobals();

const instantTransition = () => {
  const log = [];
  return {
    log,
    duration: 0,
    ease: (t) => t,
    settle: () => ({ duration: 0, ease: (t) => t }),
    begin: (l, u) => log.push(['begin', l?.el.id, u.el.id]),
    apply: (l, u, p) => log.push(['apply', l?.el.id, u.el.id, p]),
    end: (l, u) => log.push(['end', l?.el.id, u.el.id]),
  };
};

let container, t, stack;
const el = (id) => Object.assign(makeElement('section'), { id });

beforeEach(() => {
  container = makeElement('div');
  t = instantTransition();
  stack = new NavigationStack({ container, transition: t });
});

test('constructor requires container and transition', () => {
  assert.throws(() => new NavigationStack({}), /needs/);
  assert.ok(container.classList.contains('sn-container'));
});

test('push mounts the page, marks it top and visible', async () => {
  const a = el('a');
  const entry = await stack.push(a);
  assert.equal(entry.el, a);
  assert.equal(stack.depth, 1);
  assert.equal(a.parentElement, container);
  assert.ok(a.classList.contains('sn-page'));
  assert.ok(a.classList.contains('sn-page-visible'));
  assert.equal(a.style.transform, 'translate3d(0,0,0)');
});

test('push runs the transition from 0 to 1 and hides the lower page after', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  t.log.length = 0;
  await stack.push(b);
  assert.deepEqual(t.log[0], ['begin', 'a', 'b']);
  assert.deepEqual(t.log[1], ['apply', 'a', 'b', 0]);
  assert.deepEqual(t.log[t.log.length - 2], ['apply', 'a', 'b', 1]);
  assert.deepEqual(t.log[t.log.length - 1], ['end', 'a', 'b']);
  assert.ok(!a.classList.contains('sn-page-visible'), 'lower page hidden');
  assert.ok(b.classList.contains('sn-page-visible'));
  assert.equal(a.parentElement, container, 'lower page stays mounted');
});

test('push accepts a factory function and carries data', async () => {
  const entry = await stack.push(() => el('a'), { data: { id: 42 } });
  assert.equal(entry.el.id, 'a');
  assert.deepEqual(entry.data, { id: 42 });
});

test('pop removes the top page and reveals the one beneath', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  await stack.push(b);
  const events = [];
  stack.on('pop', (d) => events.push(d));
  const removed = await stack.pop();
  assert.equal(removed.el, b);
  assert.equal(b.parentElement, null);
  assert.equal(stack.depth, 1);
  assert.ok(a.classList.contains('sn-page-visible'));
  assert.equal(events.length, 1);
  assert.equal(events[0].removed.length, 1);
  assert.equal(events[0].source, 'api');
});

test('pop on a single-page stack is a no-op', async () => {
  await stack.push(el('a'));
  assert.equal(await stack.pop(), null);
  assert.equal(stack.depth, 1);
});

test('popTo removes intermediates without animating them', async () => {
  const pages = ['a', 'b', 'c', 'd'].map(el);
  for (const p of pages) await stack.push(p);
  t.log.length = 0;
  const events = [];
  stack.on('pop', (d) => events.push(d));
  const upper = await stack.popTo(1);
  assert.equal(upper.el.id, 'd');
  assert.equal(stack.depth, 1);
  assert.deepEqual(t.log[0], ['begin', 'a', 'd'], 'only the top animates, against the target');
  assert.deepEqual(events[0].removed.map((e) => e.el.id).sort(), ['b', 'c', 'd']);
  assert.ok(pages.slice(1).every((p) => p.parentElement === null));
});

test('popTo below 1 or at current depth does nothing', async () => {
  await stack.push(el('a'));
  await stack.push(el('b'));
  assert.equal(await stack.popTo(0), null);
  assert.equal(await stack.popTo(2), null);
  assert.equal(stack.depth, 2);
});

test('operations queue while a transition is busy', async () => {
  const a = el('a'), b = el('b'), c = el('c');
  const order = [];
  stack.on('push', ({ entry }) => order.push(entry.el.id));
  await Promise.all([stack.push(a), stack.push(b), stack.push(c)]);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(stack.depth, 3);
  assert.equal(stack.busy, false);
});

test('reset replaces the stack without animation', async () => {
  await stack.push(el('a'));
  await stack.push(el('b'));
  t.log.length = 0;
  const x = el('x'), y = el('y');
  const removed = await stack.reset([x, y]);
  assert.equal(removed.length, 2);
  assert.equal(t.log.length, 0);
  assert.equal(stack.depth, 2);
  assert.equal(stack.top.el, y);
  assert.ok(y.classList.contains('sn-page-visible'));
  assert.ok(!x.classList.contains('sn-page-visible'));
});

test('interactive pop: update drives p, finish(complete) pops', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  await stack.push(b);
  t.log.length = 0;
  const handle = stack.beginInteractivePop();
  assert.ok(handle);
  assert.equal(stack.busy, true);
  assert.equal(stack.beginInteractivePop(), null, 'no second gesture while busy');
  handle.update(0.6);
  handle.update(-1);
  assert.deepEqual(t.log[1], ['apply', 'a', 'b', 0.6]);
  assert.deepEqual(t.log[2], ['apply', 'a', 'b', 0], 'clamped to [0,1]');
  const events = [];
  stack.on('pop', (d) => events.push(d));
  await handle.finish({ complete: true, velocity: 800 });
  assert.equal(stack.depth, 1);
  assert.equal(stack.busy, false);
  assert.equal(b.parentElement, null);
  assert.equal(events[0].source, 'gesture');
});

test('interactive pop: finish(cancel) restores the upper page', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  await stack.push(b);
  const handle = stack.beginInteractivePop();
  handle.update(0.3);
  await handle.finish({ complete: false });
  assert.equal(stack.depth, 2);
  assert.equal(stack.top.el, b);
  assert.ok(b.classList.contains('sn-page-visible'));
  assert.ok(!a.classList.contains('sn-page-visible'));
  assert.equal(stack.busy, false);
});

test('interactive pop passes remaining distance and velocity to settle', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  await stack.push(b);
  let got;
  t.settle = (arg) => ((got = arg), { duration: 0, ease: (x) => x });
  const handle = stack.beginInteractivePop();
  handle.update(0.25);
  await handle.finish({ complete: true, velocity: 1234 });
  assert.equal(got.remainingPx, 0.25 * 400);
  assert.equal(got.velocity, 1234);
});

test('on() returns an unsubscribe function', async () => {
  let n = 0;
  const off = stack.on('push', () => n++);
  await stack.push(el('a'));
  off();
  await stack.push(el('b'));
  assert.equal(n, 1);
});

test('destroy unmounts every page', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  await stack.push(b);
  stack.destroy();
  assert.equal(stack.depth, 0);
  assert.equal(a.parentElement, null);
  assert.ok(!container.classList.contains('sn-container'));
});

// ------------------------------------------------------------ router-style operations

test('popWith reveals a page that is already beneath the top, removing intermediates', async () => {
  const pages = ['a', 'b', 'c', 'd'].map(el);
  for (const p of pages) await stack.push(p);
  t.log.length = 0;
  const upper = await stack.popWith(pages[1]);
  assert.equal(upper.el.id, 'd');
  assert.deepEqual(stack.entries.map((e) => e.el.id), ['a', 'b']);
  assert.deepEqual(t.log[0], ['begin', 'b', 'd']);
  assert.equal(pages[2].parentElement, null, 'intermediate c is gone');
});

test('popWith mounts a fresh page beneath the top and pops onto it', async () => {
  const a = el('a'), b = el('b'), x = el('x');
  await stack.push(a);
  await stack.push(b);
  t.log.length = 0;
  const events = [];
  stack.on('pop', (d) => events.push(d));
  await stack.popWith(x, { key: 'x', source: 'history' });
  assert.deepEqual(stack.entries.map((e) => e.el.id), ['a', 'x']);
  assert.deepEqual(t.log[0], ['begin', 'x', 'b'], 'b animates out over x');
  assert.deepEqual(container.children.map((c) => c.id), ['a', 'x'], 'x was inserted beneath b in the DOM, b removed');
  assert.ok(x.classList.contains('sn-page-visible'));
  assert.equal(stack.top.key, 'x');
  assert.equal(events[0].source, 'history');
  assert.deepEqual(stack.entries.map((e) => e.index), [0, 1], 'indexes renumbered');
});

test('popWith on an empty stack mounts the page', async () => {
  const a = el('a');
  await stack.popWith(a);
  assert.equal(stack.top.el, a);
});

test('popWith on the top page is a no-op', async () => {
  const a = el('a');
  await stack.push(a);
  assert.equal(await stack.popWith(a), null);
  assert.equal(stack.depth, 1);
});

test('replace swaps the top page without animation', async () => {
  const a = el('a'), b = el('b'), c = el('c');
  await stack.push(a);
  await stack.push(b);
  t.log.length = 0;
  const events = [];
  stack.on('replace', (d) => events.push(d));
  const removed = await stack.replace(c, { key: 'c' });
  assert.equal(removed.el, b);
  assert.equal(b.parentElement, null);
  assert.deepEqual(stack.entries.map((e) => e.el.id), ['a', 'c']);
  assert.equal(t.log.length, 0, 'no transition ran');
  assert.ok(c.classList.contains('sn-page-visible'));
  assert.equal(events[0].removed[0].el, b);
});

test('present dispatches on direction', async () => {
  const a = el('a'), b = el('b'), c = el('c');
  await stack.present(a, 'push');
  await stack.present(b, 'push');
  await stack.present(c, 'replace');
  assert.deepEqual(stack.entries.map((e) => e.el.id), ['a', 'c']);
  await stack.present(a, 'pop');
  assert.deepEqual(stack.entries.map((e) => e.el.id), ['a']);
});

test('pushing an element already lower in the stack moves it to the top', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  await stack.push(b);
  await stack.push(a);
  assert.deepEqual(stack.entries.map((e) => e.el.id), ['b', 'a']);
  assert.deepEqual(container.children.map((c) => c.id), ['b', 'a']);
});

test('remove drops a page beneath the top silently', async () => {
  const a = el('a'), b = el('b'), c = el('c');
  for (const p of [a, b, c]) await stack.push(p);
  const entry = await stack.remove(b);
  assert.equal(entry.el, b);
  assert.deepEqual(stack.entries.map((e) => e.el.id), ['a', 'c']);
  assert.equal(await stack.remove(b), null);
  assert.equal(stack.entryOf(c).index, 1);
  assert.equal(stack.entryOf('nope'), null);
});
