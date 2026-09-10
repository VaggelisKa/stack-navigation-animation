import { tween } from './animate.js';

/**
 * A stack of page elements inside one container. The stack owns mounting,
 * ordering, visibility and the transition lifecycle; a `transition` object
 * decides what the pages look like at any progress p (1 = upper page fully
 * open, 0 = upper page fully off-screen).
 *
 * Transition contract:
 *   { duration, ease, settle({ remainingPx, velocity }) -> { duration, ease },
 *     begin?(lower, upper), apply(lower, upper, p), end?(lower, upper) }
 */
export class NavigationStack {
  constructor({ container, transition, pageClass = 'sn-page' }) {
    if (!container || !transition) throw new Error('NavigationStack needs { container, transition }');
    this.container = container;
    this.transition = transition;
    this.pageClass = pageClass;
    this.entries = [];
    this.busy = false;
    this._queue = [];
    this._listeners = new Map();
    container.classList.add('sn-container');
  }

  // ---------------------------------------------------------------- state
  get depth() {
    return this.entries.length;
  }
  get top() {
    return this.entries[this.entries.length - 1] || null;
  }
  width() {
    return this.container.clientWidth;
  }
  canPop() {
    return !this.busy && this.entries.length > 1;
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event).delete(fn);
  }
  _emit(event, detail) {
    const set = this._listeners.get(event);
    if (set) set.forEach((fn) => fn(detail));
  }

  // ------------------------------------------------------------ operations
  /**
   * Push an element (or a function returning one). Resolves with the entry
   * once the transition has finished. `data` is yours; it rides on the entry.
   */
  push(elOrFactory, { animated = true, data = null, source = 'api' } = {}) {
    return this._run(async () => {
      const el = typeof elOrFactory === 'function' ? elOrFactory() : elOrFactory;
      const lower = this.top;
      const upper = this._mount(el, this.entries.length, data);
      this.entries.push(upper);
      await this._transition(lower, upper, 0, 1, animated, 'push');
      this._settle();
      this._emit('push', { entry: upper, entries: this.entries.slice(), source });
      return upper;
    });
  }

  /** Pop one level. Resolves with the removed entry (its element is detached, not destroyed). */
  pop(opts = {}) {
    return this.popTo(this.entries.length - 1, opts);
  }

  /** Pop until `depth` entries remain (≥ 1). Intermediates are removed without animation. */
  popTo(depth, { animated = true, source = 'api' } = {}) {
    return this._run(async () => {
      if (depth < 1 || this.entries.length <= depth) return null;
      const upper = this.entries.pop(); // the page the user is looking at: it animates out
      const removed = [];
      while (this.entries.length > depth) removed.push(this._unmount(this.entries.pop())); // intermediates: gone silently
      const lower = this.top;
      await this._transition(lower, upper, 1, 0, animated, 'pop');
      removed.push(this._unmount(upper));
      this._settle();
      this._emit('pop', { entry: upper, removed, entries: this.entries.slice(), source });
      return upper;
    });
  }

  /** Replace the whole stack without animation. Returns the removed entries. */
  reset(elements, { source = 'api' } = {}) {
    return this._run(async () => {
      const removed = [];
      while (this.entries.length) removed.push(this._unmount(this.entries.pop()));
      elements.forEach((el, i) => this.entries.push(this._mount(el, i, null)));
      this._settle();
      this._emit('reset', { entries: this.entries.slice(), removed, source });
      return removed;
    });
  }

  /**
   * Start a finger-driven pop. Returns null if the stack can't pop right now.
   *   handle.update(p)                      p = 1 fully open … 0 fully popped
   *   handle.finish({ complete, velocity }) resolves when the settle animation ends
   */
  beginInteractivePop() {
    if (!this.canPop()) return null;
    this._setBusy(true);
    const upper = this.top;
    const lower = this.entries[this.entries.length - 2];
    let p = 1;
    this._begin(lower, upper, 'interactive');
    return {
      update: (v) => {
        p = Math.min(1, Math.max(0, v));
        this._apply(lower, upper, p);
      },
      finish: async ({ complete, velocity = 0 }) => {
        const remainingPx = (complete ? p : 1 - p) * this.width();
        const { duration, ease } = this.transition.settle({ remainingPx, velocity });
        await tween({ from: p, to: complete ? 0 : 1, duration, ease, onUpdate: (v) => this._apply(lower, upper, v) });
        this._end(lower, upper, 'interactive');
        if (complete) {
          this.entries.pop();
          this._unmount(upper);
        }
        this._settle();
        this._setBusy(false);
        if (complete) this._emit('pop', { entry: upper, removed: [upper], entries: this.entries.slice(), source: 'gesture' });
        this._drain();
      },
    };
  }

  destroy() {
    while (this.entries.length) this._unmount(this.entries.pop());
    this.container.classList.remove('sn-container');
  }

  // -------------------------------------------------------------- internals
  _setBusy(v) {
    this.busy = v;
    this.container.classList.toggle('sn-busy', v);
  }

  /** Serialize operations: while a transition runs, later calls wait their turn. */
  _run(fn) {
    return new Promise((resolve, reject) => {
      const task = async () => {
        this._setBusy(true);
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          this._setBusy(false);
          this._drain();
        }
      };
      if (this.busy) this._queue.push(task);
      else task();
    });
  }
  _drain() {
    if (!this.busy && this._queue.length) this._queue.shift()();
  }

  _mount(el, index, data) {
    el.classList.add(this.pageClass);
    if (el.parentElement !== this.container) this.container.append(el);
    return { el, index, data };
  }
  _unmount(entry) {
    entry.el.classList.remove(this.pageClass, 'sn-page-visible');
    entry.el.style.transform = '';
    entry.el.remove();
    return entry;
  }

  _begin(lower, upper, kind) {
    if (lower) lower.el.classList.add('sn-page-visible');
    upper.el.classList.add('sn-page-visible');
    this.transition.begin?.(lower, upper);
    this._emit('transitionstart', { lower, upper, kind });
  }
  _apply(lower, upper, p) {
    this.transition.apply(lower, upper, p);
    this._emit('progress', { lower, upper, p });
  }
  _end(lower, upper, kind) {
    this.transition.end?.(lower, upper);
    this._emit('transitionend', { lower, upper, kind });
  }
  async _transition(lower, upper, from, to, animated, kind) {
    this._begin(lower, upper, kind);
    this._apply(lower, upper, from);
    const duration = animated ? this.transition.duration : 0;
    await tween({ from, to, duration, ease: this.transition.ease, onUpdate: (p) => this._apply(lower, upper, p) });
    this._end(lower, upper, kind);
  }

  /** Only the top page is visible; every page's transform is reset. */
  _settle() {
    const top = this.top;
    this.entries.forEach((e) => {
      e.el.classList.toggle('sn-page-visible', e === top);
      e.el.style.transform = e === top ? 'translate3d(0,0,0)' : '';
    });
  }
}
