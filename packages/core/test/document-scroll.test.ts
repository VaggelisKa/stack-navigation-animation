import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, makeWindow, installGlobals } from './dom-stub.ts';
import { NavigationStack } from '../src/navigation-stack.ts';

installGlobals();

// The stub has no layout, so geometry is modelled here: the container sits
// 80px down the document under a shell header, a page at rest sits at the
// container's top, and both move up as the document scrolls.
const HEADER = 80;

const instantTransition = () => ({
  duration: 0,
  ease: (t: number) => t,
  settle: () => ({ duration: 0, ease: (t: number) => t }),
  apply() {},
});

let container: any, win: any, stack: NavigationStack;
const el = (id: string) => {
  const page = Object.assign(makeElement('section'), { id });
  Object.defineProperty(page, 'rectTop', { get: () => container.rectTop });
  return page;
};
const scrollTo = (top: number) => win.scrollTo({ top });
/** What the stack had done by the time the transition began. */
const atStart = () => {
  const seen: any[] = [];
  stack.on('transitionstart', ({ lower, upper }) =>
    seen.push({
      scrollY: win.scrollY,
      height: container.style.height,
      tops: [lower?.el.style.top ?? '', upper.el.style.top ?? ''],
    }),
  );
  return seen;
};

beforeEach(() => {
  win = makeWindow({ innerHeight: 800 });
  globalThis.document.defaultView = win;
  container = makeElement('div');
  Object.defineProperty(container, 'rectTop', { get: () => HEADER - win.scrollY });
  stack = new NavigationStack({ container, transition: instantTransition(), scroll: 'document' });
});

test('document mode marks the container and takes scroll restoration from the browser', () => {
  assert.ok(container.classList.contains('sn-scroll-document'));
  assert.equal(stack.scroll, 'document');
  assert.equal(win.history.scrollRestoration, 'manual');
});

test('the default mode leaves the document alone', async () => {
  win.history.scrollRestoration = 'auto';
  const plain = new NavigationStack({
    container: makeElement('div'),
    transition: instantTransition(),
  });
  assert.equal(plain.scroll, 'page');
  await plain.push(el('a'));
  scrollTo(320);
  await plain.push(el('b'));
  await plain.pop();
  assert.equal(win.scrolls.length, 1, 'only the test scrolled');
  assert.equal(win.history.scrollRestoration, 'auto');
  assert.ok(!plain.container.classList.contains('sn-scroll-document'));
});

test('a push switches the document to the new page before the transition and holds the page beneath where it was', async () => {
  const a = el('a');
  await stack.push(a, { animated: false });
  scrollTo(320);
  const seen = atStart();
  await stack.push(el('b'));
  assert.equal(seen.length, 1);
  // The frame holds the 320px `a` was left at plus the viewport, and `a` moves
  // up by the 320px the switch to the top moved the container.
  assert.deepEqual(seen[0], { scrollY: 0, height: '1120px', tops: ['-320px', ''] });
  // At rest the frame is released and the page on top is where it belongs.
  assert.equal(container.style.height, '');
  assert.equal(a.style.top, '');
  assert.equal(win.scrollY, 0);
});

test('a pop puts the document back at the offset the page beneath was left at, before the slide', async () => {
  const a = el('a'),
    b = el('b');
  await stack.push(a, { animated: false });
  scrollTo(320);
  await stack.push(b);
  scrollTo(500);
  const seen = atStart();
  await stack.pop();
  // `b` was showing from 500px down and the document is now at 320px, so the
  // container moved down 180px and `b` moves up by as much. The frame is sized
  // for the taller of the two offsets, 500px.
  assert.deepEqual(seen[0], { scrollY: 320, height: '1300px', tops: ['', '-180px'] });
  assert.equal(win.scrollY, 320);
  assert.equal(container.style.height, '');
  assert.equal(b.style.top, '');
  assert.equal(stack.depth, 1);
});

test('an interactive pop let go returns the document to the top page before the settle', async () => {
  const a = el('a'),
    b = el('b');
  await stack.push(a, { animated: false });
  scrollTo(320);
  await stack.push(b);
  scrollTo(500);

  let handle = stack.beginInteractivePop()!;
  assert.equal(win.scrollY, 320, 'the page beneath is shown at its own offset from the first move');
  assert.equal(b.style.top, '-180px');
  await handle.finish({ complete: false });
  assert.equal(win.scrollY, 500, 'let go: back where the top page was');
  assert.equal(stack.depth, 2);
  assert.equal(a.style.top, '');
  assert.equal(b.style.top, '');
  assert.equal(container.style.height, '');

  handle = stack.beginInteractivePop()!;
  await handle.finish({ complete: true });
  assert.equal(win.scrollY, 320);
  assert.equal(stack.depth, 1);
});

test('a cancelled interactive pop is back at the top page offset for the settle, not after it', async () => {
  const a = el('a'),
    b = el('b');
  await stack.push(a, { animated: false });
  scrollTo(320);
  await stack.push(b);
  // Once both pages are out of the flow the document is only as tall as the
  // frame, so an offset the frame leaves no room for is one the browser clamps
  // away -- which is what makes the frame's height worth asserting.
  Object.defineProperty(win, 'scrollHeight', {
    get: () => HEADER + (parseFloat(container.style.height) || Infinity),
  });
  scrollTo(500);

  const handle = stack.beginInteractivePop()!;
  assert.equal(container.style.height, '1300px', 'the frame holds the taller of the two offsets');
  assert.equal(win.scrollY, 320);
  const done = handle.finish({ complete: false });
  assert.equal(win.scrollY, 500, 'back at the top page offset before the settle runs, not after');
  await done;
  assert.equal(win.scrollY, 500);
  assert.equal(container.style.height, '');
});

test('the first page keeps the document where the app has it; a new page starts at the top', async () => {
  scrollTo(100);
  await stack.push(el('a'), { animated: false });
  assert.equal(win.scrollY, 100);
  await stack.push(el('b'));
  assert.equal(win.scrollY, 0);
});

test('replace, remove and reset show the page that ends up on top at its own offset', async () => {
  const a = el('a'),
    c = el('c'),
    d = el('d');
  await stack.push(a, { animated: false });
  scrollTo(320);
  await stack.replace(c);
  assert.equal(win.scrollY, 0, 'a fresh page starts at the top');
  await stack.push(a);
  assert.equal(win.scrollY, 320, 'the replaced page kept its offset');
  await stack.remove(a);
  assert.equal(win.scrollY, 0, 'back to c');
  scrollTo(40);
  await stack.reset([]);
  assert.equal(win.scrollY, 40, 'an emptied stack leaves the document where it is');
  await stack.reset([c, d]);
  assert.equal(win.scrollY, 0, 'd has never been shown');
  await stack.reset([c]);
  assert.equal(win.scrollY, 40, 'c is back where it was emptied at');
});

test('a page put back after a refused pop returns to where it was left', async () => {
  const a = el('a'),
    b = el('b');
  await stack.push(a, { animated: false });
  scrollTo(320);
  await stack.push(b);
  scrollTo(500);
  await stack.pop();
  assert.equal(win.scrollY, 320);
  await stack.push(b, { animated: false });
  assert.equal(win.scrollY, 500, 'offsets are kept by element, not by entry');
});

test('a page shorter than its offset lands where the browser clamps it', async () => {
  const a = el('a'),
    b = el('b');
  await stack.push(a, { animated: false });
  scrollTo(320);
  await stack.push(b);
  // `a` lost most of its content while beneath `b`.
  win.scrollHeight = 900;
  await stack.pop();
  assert.equal(win.scrollY, 100);
});

test('every scroll the stack makes is instant, whatever the root scroll-behavior says', async () => {
  await stack.push(el('a'), { animated: false });
  await stack.push(el('b'));
  await stack.pop();
  const own = win.scrolls.filter((s: any) => s.behavior !== 'auto');
  assert.ok(own.length > 0);
  assert.ok(own.every((s: any) => s.behavior === 'instant'));
});

test('destroy closes the frame and drops the mode class', async () => {
  const a = el('a'),
    b = el('b');
  await stack.push(a, { animated: false });
  await stack.push(b);
  stack.beginInteractivePop();
  assert.notEqual(container.style.height, '');
  stack.destroy();
  assert.equal(container.style.height, '');
  assert.equal(a.style.top, '');
  assert.equal(b.style.top, '');
  assert.ok(!container.classList.contains('sn-scroll-document'));
});

test('a container with no window has nothing to scroll', async () => {
  globalThis.document.defaultView = null;
  const orphan = new NavigationStack({
    container: makeElement('div'),
    transition: instantTransition(),
    scroll: 'document',
  });
  await orphan.push(el('a'), { animated: false });
  await orphan.push(el('b'));
  await orphan.pop();
  assert.equal(orphan.depth, 1);
});
