// `manageFocus`: focus follows the pages, the way a native stack moves it.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeElement, installGlobals } from './dom-stub.ts';
import { NavigationStack } from '../src/navigation-stack.ts';

installGlobals();

const instant = () => ({
  duration: 0,
  ease: (t) => t,
  settle: () => ({ duration: 0, ease: (t) => t }),
  apply: () => {},
});

const page = (id) => Object.assign(makeElement('section'), { id });
const field = (parent) => {
  const input = makeElement('input');
  parent.append(input);
  return input;
};

let container;
const stackWith = (manageFocus) => new NavigationStack({ container, transition: instant(), manageFocus });

beforeEach(() => {
  container = makeElement('div');
  document.activeElement = null;
  document.hidden = false;
});

test('push moves focus into the page arriving on top', async () => {
  const stack = stackWith(true);
  const a = page('a'), b = page('b');
  await stack.push(a);
  assert.equal(document.activeElement, a);
  assert.equal(a.getAttribute('tabindex'), '-1', 'a page with nothing focusable is made focusable');
  await stack.push(b);
  assert.equal(document.activeElement, b);
});

test('pop gives focus back to the element the revealed page had it in', async () => {
  const stack = stackWith(true);
  const a = page('a'), b = page('b');
  await stack.push(a);
  const input = field(a);
  input.focus();
  await stack.push(b);
  assert.equal(document.activeElement, b, 'the page beneath lost focus to the new top');
  await stack.pop();
  assert.equal(document.activeElement, input);
});

test('pop falls back to the page when the remembered element is gone', async () => {
  const stack = stackWith(true);
  const a = page('a'), b = page('b');
  await stack.push(a);
  const input = field(a);
  input.focus();
  await stack.push(b);
  input.remove();
  await stack.pop();
  assert.equal(document.activeElement, a);
});

test('an interactive pop restores the revealed page the same way', async () => {
  const stack = stackWith(true);
  const a = page('a'), b = page('b');
  await stack.push(a);
  const input = field(a);
  input.focus();
  await stack.push(b);
  const handle = stack.beginInteractivePop();
  handle.update(0.5);
  await handle.finish({ complete: true });
  assert.equal(document.activeElement, input);
});

test('off by default: nothing is focused and no attribute is written', async () => {
  const stack = stackWith(undefined);
  const a = page('a'), b = page('b');
  await stack.push(a);
  const input = field(a);
  input.focus();
  await stack.push(b);
  assert.equal(document.activeElement, input);
  assert.equal(b.getAttribute('tabindex'), null);
  await stack.pop();
  assert.equal(document.activeElement, input);
});

test('focus that has moved outside the container is left alone', async () => {
  const stack = stackWith(true);
  const a = page('a'), b = page('b');
  await stack.push(a);
  field(a).focus();
  await stack.push(b);
  const elsewhere = makeElement('button');
  makeElement('dialog').append(elsewhere);
  elsewhere.focus();
  await stack.pop();
  assert.equal(document.activeElement, elsewhere);
});

test('a hidden document is never stolen from', async () => {
  const stack = stackWith(true);
  document.hidden = true;
  await stack.push(page('a'));
  assert.equal(document.activeElement, null);
});

test('the borrowed tabindex leaves with the page, and a page of its own is left alone', async () => {
  const stack = stackWith(true);
  const a = page('a'), b = page('b');
  b.setAttribute('tabindex', '0');
  await stack.push(a);
  await stack.push(b);
  assert.equal(b.getAttribute('tabindex'), '0', 'a page that says how it is focused keeps saying it');
  await stack.pop();
  assert.equal(b.getAttribute('tabindex'), '0', 'nothing was borrowed, so nothing is taken back');
  assert.equal(a.getAttribute('tabindex'), '-1', 'the page still mounted keeps the attribute it was given');
  await stack.replace(page('c'));
  assert.equal(a.getAttribute('tabindex'), null, 'unmounting takes the borrowed attribute back');
});

test('replace focuses the page that takes the top', async () => {
  const stack = stackWith(true);
  const a = page('a'), c = page('c');
  await stack.push(a);
  await stack.replace(c);
  assert.equal(document.activeElement, c);
});

test('removing the top page reveals the one beneath and its focus', async () => {
  const stack = stackWith(true);
  const a = page('a'), b = page('b');
  await stack.push(a);
  const input = field(a);
  input.focus();
  await stack.push(b);
  await stack.remove(b);
  assert.equal(document.activeElement, input);
});
