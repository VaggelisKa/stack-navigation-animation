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
  assert.equal(a.style.transform, '', 'at rest the page sits where the stylesheet puts it');
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

test('the pages taking part carry their role, and drop it when it is over', async () => {
  const a = el('a'), b = el('b');
  await stack.push(a);
  const roles = [];
  stack.on('progress', () => roles.push([[...a.classes], [...b.classes]]));
  await stack.push(b);
  const during = roles[0];
  assert.ok(during[0].includes('sn-page-lower'), 'lower page is marked while it moves');
  assert.ok(during[1].includes('sn-page-upper'), 'upper page is marked while it moves');
  assert.ok(!a.classList.contains('sn-page-lower'));
  assert.ok(!b.classList.contains('sn-page-upper'));
});

// What CSS is told, at the moment it is told: --sn-t and --sn-e have to be in
// force *before* the endpoint is written, or the browser has nothing to
// interpolate over.
const timings = () => {
  const seen = [];
  const inner = t.apply;
  t.apply = (l, u, p) => {
    seen.push([p, container.style.getPropertyValue('--sn-t'), container.style.getPropertyValue('--sn-e')]);
    inner(l, u, p);
  };
  return seen;
};

test('the container carries the phase timing for CSS, and 0s the rest of the time', async () => {
  t.duration = 300;
  t.ease = Object.assign((x) => x, { css: 'cubic-bezier(0.32, 0.72, 0, 1)' });
  await stack.push(el('a'));
  const seen = timings();
  await stack.push(el('b'));
  assert.deepEqual(seen[0], [0, '0s', 'linear'], 'the near end lands instantly');
  assert.deepEqual(seen[1], [1, '300ms', 'cubic-bezier(0.32, 0.72, 0, 1)'], 'the far end is a 300ms run on the iOS curve');
  assert.equal(container.style.getPropertyValue('--sn-t'), '0s', 'and nothing is animating once it is over');
});

test('an unanimated operation never asks CSS to animate', async () => {
  t.duration = 300;
  await stack.push(el('a'));
  const seen = timings();
  await stack.push(el('b'), { animated: false });
  assert.deepEqual(seen.map((s) => s[1]), ['0s', '0s']);
});

test('the interactive drag pins --sn-t at 0s so the page tracks the finger', async () => {
  t.duration = 300;
  await stack.push(el('a'));
  await stack.push(el('b'));
  t.settle = () => ({ duration: 250, ease: Object.assign((x) => x, { css: 'ease-out' }) });
  const seen = timings();
  const handle = stack.beginInteractivePop();
  handle.update(0.6);
  handle.update(0.4);
  await handle.finish({ complete: true, velocity: 900 });
  assert.deepEqual(seen.slice(0, 2), [[0.6, '0s', 'linear'], [0.4, '0s', 'linear']], 'every move is instant');
  assert.deepEqual(seen[2], [0, '250ms', 'ease-out'], 'only the release is a run CSS owns');
});

test('progress still ends at the target, and nothing ticks when nobody listens', async () => {
  t.duration = 50;
  await stack.push(el('a'));
  const seen = [];
  const off = stack.on('progress', ({ p }) => seen.push(p));
  await stack.push(el('b'));
  assert.equal(seen[0], 0);
  assert.equal(seen[seen.length - 1], 1, 'listeners always see the far end');
  off();
  const applied = [];
  t.apply = (l, u, p) => applied.push(p);
  await stack.push(el('c'));
  assert.deepEqual(applied, [0, 1], 'with no listeners the stack writes the two ends and stops');
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

test('the stack reads a transition\'s timing only after begin() has run', async () => {
  // The iOS transition resolves its CSS variables in begin(), so a stack that
  // read duration or ease first would apply every variable one transition late.
  const { createIOSTransition } = await import('../src/ios-transition.ts');
  const inner = createIOSTransition({ duration: 500 });
  const reads = [];
  const spy = {
    begin: (l, u) => (reads.push('begin'), inner.begin(l, u)),
    apply: (l, u, p) => inner.apply(l, u, p),
    end: (l, u) => (reads.push('end'), inner.end(l, u)),
    settle: (i) => (reads.push(`settle:${inner.settle(i).duration}`), inner.settle(i)),
    get duration() {
      reads.push(`duration:${inner.duration}`);
      return inner.duration;
    },
    get ease() {
      reads.push('ease');
      return inner.ease;
    },
  };
  container.vars['--sn-duration'] = '250ms';
  container.vars['--sn-settle-max'] = '80ms';
  const s = new NavigationStack({ container, transition: spy });

  await s.push(el('a'), { animated: false });
  reads.length = 0;
  await s.push(el('b'));
  assert.deepEqual(reads.slice(0, 2), ['begin', 'duration:250'], 'the very first animated push already sees 250ms');

  reads.length = 0;
  const h = s.beginInteractivePop();
  h.update(0.4);
  await h.finish({ complete: true, velocity: 100 });
  assert.deepEqual(reads.slice(0, 2), ['begin', 'settle:80'], 'and so does the settle after a swipe');
});
