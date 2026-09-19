// The minimum DOM the engine needs: classList, style, parent/child, clientWidth,
// and inherited custom properties for getComputedStyle().
//
// Custom properties set through `style.setProperty` land in the same store
// `getComputedStyle` reads, as they would in a browser, so a test can set a
// variable the way an author would (`el.vars[name] = value`) and still see
// what the engine writes. There is no layout and no animation, so the property
// `commitStyles` resolves reads as undefined and every CSS transition reads as
// already finished.
const makeStyle = (vars: Record<string, string>) => {
  const priorities: Record<string, string> = {};
  const style: any = {
    setProperty: (k: string, v: string, priority = '') => {
      priorities[k] = priority;
      (k.startsWith('--') ? vars : style)[k] = v;
    },
    getPropertyPriority: (k: string) => priorities[k] ?? '',
    removeProperty: (k: string) => {
      delete priorities[k];
      delete (k.startsWith('--') ? vars : style)[k];
    },
    getPropertyValue: (k: string) => (k.startsWith('--') ? vars[k] : style[k]) ?? '',
  };
  return style;
};

export function makeElement(tag = 'div'): any {
  const classes = new Set();
  const vars: Record<string, string> = {};
  const el: any = {
    tagName: tag.toUpperCase(),
    style: makeStyle(vars),
    vars,
    parentElement: null,
    children: [],
    clientWidth: 400,
    attrs: {},
    listeners: {},
    classes,
    classList: {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      toggle: (c, force) =>
        force === undefined
          ? classes.has(c)
            ? classes.delete(c)
            : classes.add(c)
          : force
            ? classes.add(c)
            : classes.delete(c),
      contains: (c) => classes.has(c),
    },
    append(child) {
      if (child.parentElement) child.remove();
      child.parentElement = el;
      el.children.push(child);
    },
    insertBefore(child, before) {
      if (child.parentElement) child.remove();
      child.parentElement = el;
      const i = el.children.indexOf(before);
      el.children.splice(i < 0 ? el.children.length : i, 0, child);
    },
    remove() {
      if (!el.parentElement) return;
      const sib = el.parentElement.children;
      sib.splice(sib.indexOf(el), 1);
      el.parentElement = null;
      el.parentElement = null;
    },
    setAttribute(k, v) {
      el.attrs[k] = v;
    },
    getAttribute: (k) => el.attrs[k] ?? null,
    hasAttribute: (k) => k in el.attrs,
    removeAttribute(k) {
      delete el.attrs[k];
    },
    contains(node) {
      for (let n = node; n; n = n.parentElement) if (n === el) return true;
      return false;
    },
    // Focus is only what the focus tests need: the document remembers the last
    // element focused, and an element out of the tree is not connected.
    focus() {
      globalThis.document.activeElement = el;
    },
    addEventListener(type, fn) {
      (el.listeners[type] ||= new Set()).add(fn);
    },
    removeEventListener(type, fn) {
      el.listeners[type]?.delete(fn);
    },
    dispatch(type, ev) {
      const event = { type, target: el, ...ev, currentTarget: el };
      el.listeners[type]?.forEach((fn) => fn(event));
      if (event.bubbles) el.parentElement?.dispatch(type, event);
    },
    setPointerCapture() {},
    // Geometry is whatever a test says it is: `rectTop` stands in for layout,
    // and a test can make it a getter to watch the reads.
    getBoundingClientRect: () => ({ top: el.rectTop ?? 0, left: 0, width: 400, height: 0 }),
  };
  Object.defineProperty(el, 'isConnected', { get: () => !!el.parentElement });
  let owner: any;
  Object.defineProperty(el, 'ownerDocument', {
    get: () => owner ?? globalThis.document,
    set: (doc) => (owner = doc),
  });
  Object.defineProperty(el, 'className', {
    get: () => [...classes].join(' '),
    set: (v: string) => {
      classes.clear();
      for (const c of String(v).split(/\s+/).filter(Boolean)) classes.add(c);
    },
  });
  return el;
}

// A document just complete enough for injectStyles(): createElement, a head,
// and an id lookup that walks what has been appended.
export function makeDocument(): any {
  const find = (node: any, id: string): any => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const hit = find(child, id);
      if (hit) return hit;
    }
    return null;
  };
  const doc: any = {
    head: makeElement('head'),
    documentElement: makeElement('html'),
    createElement: makeElement,
    getElementById: (id: string) => find(doc.head, id) ?? find(doc.documentElement, id),
  };
  return doc;
}

// A shadow root: an element container with a host, and adoptedStyleSheets only
// where the test asks for it, which is how a browser without support behaves.
export function makeShadowRoot(doc: any, { adoptedStyleSheets = false } = {}): any {
  const root: any = makeElement('#shadow-root');
  root.host = makeElement('div');
  root.ownerDocument = doc;
  root.getElementById = (id: string) => root.children.find((c: any) => c.id === id) ?? null;
  if (adoptedStyleSheets) root.adoptedStyleSheets = [];
  return root;
}

// The constructed-stylesheet half of the browser API: enough for replaceSync.
export class FakeCSSStyleSheet {
  cssText = '';
  replaceSync(css: string) {
    this.cssText = css;
  }
}

// A window for the document-scrolling tests, with a `scrollTo` clamped to
// `scrollHeight` as a browser's is, and just enough of the event-target API
// (`addEventListener` / `removeEventListener` / `dispatchEvent`) for a test to
// fire a `resize` mid-transition. `installGlobals` leaves the document
// without one, so a test that wants scrolling installs it:
// `document.defaultView = makeWindow()`.
export function makeWindow({
  innerHeight = 800,
  innerWidth = 400,
  scrollHeight = Infinity,
} = {}): any {
  const listeners: Record<string, Set<(event: unknown) => void>> = {};
  const win: any = {
    scrollY: 0,
    innerHeight,
    innerWidth,
    scrollHeight,
    scrolls: [] as Array<{ top: number; behavior: string }>,
    history: { scrollRestoration: 'auto' },
    scrollTo(options: { top: number; behavior?: string }) {
      win.scrolls.push({ top: options.top, behavior: options.behavior ?? 'auto' });
      win.scrollY = Math.max(0, Math.min(options.top, win.scrollHeight - win.innerHeight));
    },
    addEventListener(type: string, fn: (event: unknown) => void) {
      (listeners[type] ||= new Set()).add(fn);
    },
    removeEventListener(type: string, fn: (event: unknown) => void) {
      listeners[type]?.delete(fn);
    },
    dispatchEvent(event: { type: string }) {
      listeners[event.type]?.forEach((fn) => fn(event));
      return true;
    },
  };
  return win;
}

export function installGlobals() {
  globalThis.document = {
    createElement: makeElement,
    body: makeElement('body'),
    activeElement: null,
    hidden: false,
    defaultView: null,
  };
  globalThis.performance ||= { now: () => Date.now() };
  globalThis.matchMedia = () => ({ matches: false });
  // Custom properties inherit, so walk up until one element declares the name.
  // This stub differs from a real browser in two ways. It resolves on detached
  // elements, where a browser returns an empty declaration, which lets the tests
  // skip building a document. And it returns values verbatim, where a browser
  // would already have substituted var(). Neither affects what is under test,
  // which is how the engine reads and parses the values it is given, but a
  // variable that only works here is possible, so new code reading variables
  // should also be checked in a real browser.
  globalThis.getComputedStyle = (el) => ({
    getPropertyValue(name) {
      for (let e = el; e; e = e.parentElement)
        if (e.vars?.[name] !== undefined) return e.vars[name];
      return '';
    },
  });
  // Instant rAF, so every tween finishes within a microtask or two.
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now() + 10_000), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
