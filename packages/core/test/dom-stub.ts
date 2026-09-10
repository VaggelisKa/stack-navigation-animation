// The smallest DOM the engine needs: classList, style, parent/child, clientWidth.
export function makeElement(tag = 'div'): any {
  const classes = new Set();
  const el: any = {
    tagName: tag.toUpperCase(),
    style: {},
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
  // Instant rAF: every tween finishes within a microtask or two.
  globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now() + 10_000), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
