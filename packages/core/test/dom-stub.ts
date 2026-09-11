// The minimum DOM the engine needs: classList, style, parent/child, clientWidth,
// and inherited custom properties for getComputedStyle().
export function makeElement(tag = 'div'): any {
  const classes = new Set();
  const el: any = {
    tagName: tag.toUpperCase(),
    style: {},
    vars: {},
    parentElement: null,
    children: [],
    clientWidth: 400,
    attrs: {},
    listeners: {},
    classList: {
      add: (...cs) => cs.forEach((c) => classes.add(c)),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      toggle: (c, force) => (force === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : force ? classes.add(c) : classes.delete(c)),
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
    },
    setAttribute(k, v) {
      el.attrs[k] = v;
    },
    addEventListener(type, fn) {
      (el.listeners[type] ||= new Set()).add(fn);
    },
    removeEventListener(type, fn) {
      el.listeners[type]?.delete(fn);
    },
    dispatch(type, ev) {
      el.listeners[type]?.forEach((fn) => fn({ type, currentTarget: el, ...ev }));
    },
    setPointerCapture() {},
  };
  return el;
}

export function installGlobals() {
  globalThis.document = { createElement: makeElement };
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
      for (let e = el; e; e = e.parentElement) if (e.vars?.[name] !== undefined) return e.vars[name];
      return '';
    },
  });
  // Instant rAF, so every tween finishes within a microtask or two.
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now() + 10_000), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
