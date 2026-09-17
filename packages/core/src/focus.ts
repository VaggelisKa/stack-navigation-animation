// Focus, moved with the pages, for stacks that ask for it (`manageFocus`).
//
// A page beneath the top is `visibility: hidden`, and the browser answers that
// by blurring whatever was focused inside it: focus lands on `<body>`, and
// nothing puts it back when the page is revealed again. A native stack moves
// focus to the screen arriving and hands it back to the screen returning, so
// this does the same, and only that. It never traps focus, never touches
// `tabindex` on anything but the page element, and gives up the moment focus
// is somewhere the stack does not own.
import type { StackEntry } from './navigation-stack.ts';

/** What had focus inside a page when it went beneath, keyed by the page element. */
const remembered = new WeakMap<HTMLElement, Element>();
/** Pages made focusable here, so the attribute leaves with the page. */
const borrowed = new WeakSet<HTMLElement>();

function documentOf(el: HTMLElement): Document | null {
  return el.ownerDocument ?? (typeof document === 'undefined' ? null : document);
}

function within(root: Element, node: Element | null | undefined): boolean {
  return !!node && (root === node || !!root.contains?.(node));
}

/** Records what has focus inside `page`, which is about to go beneath the top. */
export function rememberFocus(page: StackEntry | null): void {
  if (!page) return;
  const active = documentOf(page.el)?.activeElement;
  // The page element itself is not worth remembering: it is where a reveal
  // lands anyway, and only this module ever focuses it.
  if (active && active !== page.el && within(page.el, active)) remembered.set(page.el, active);
  else remembered.delete(page.el);
}

/**
 * Puts focus in the page now on top. `restore` is a reveal: the element that
 * page had focus in gets it back, if it is still there.
 */
export function moveFocus(container: HTMLElement, page: StackEntry | null, restore: boolean): void {
  if (!page) return;
  const doc = documentOf(page.el);
  if (!doc || doc.hidden) return;
  const active = doc.activeElement;
  // Focus that went somewhere else while the transition ran -- a dialog, a
  // toolbar, another stack -- is not ours to take back. An element that has
  // left the document is not somewhere else: it is the page that just popped,
  // and the browser has already dropped focus to the body.
  if (active && active !== doc.body && active.isConnected !== false && !within(container, active))
    return;
  const previous = restore ? remembered.get(page.el) : undefined;
  if (previous && previous.isConnected !== false && within(page.el, previous)) {
    (previous as HTMLElement).focus?.({ preventScroll: true });
    // Asking is not getting: an element disabled, hidden or no longer focusable
    // since it was remembered takes nothing, and the browser says so by leaving
    // focus where it was. Then the page itself is the answer, as if the element
    // had gone altogether.
    if (doc.activeElement === previous) return;
  }
  focusable(page.el).focus?.({ preventScroll: true });
}

/** A page is only focusable if it says so, so say so for it. */
function focusable(el: HTMLElement): HTMLElement {
  if (!el.hasAttribute?.('tabindex')) {
    el.setAttribute('tabindex', '-1');
    borrowed.add(el);
  }
  return el;
}

/**
 * Called for every page the stack unmounts: a borrowed attribute is not the
 * page's to keep. A page whose `tabindex` has changed since it was borrowed is
 * saying the app owns it now, so the borrowing is simply forgotten.
 */
export function releaseFocus(el: HTMLElement): void {
  if (borrowed.delete(el) && el.getAttribute?.('tabindex') === '-1')
    el.removeAttribute?.('tabindex');
}
