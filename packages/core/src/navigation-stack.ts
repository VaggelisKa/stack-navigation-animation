import { animationsFinished, commitStyles, cssDuration, cssEasing, nextFrame, supportsStartingStyle, tween, type CancellableTween, type Easing } from './animate.ts';

/** One mounted page. `key` and `data` belong to the caller; the stack only carries them. */
export interface StackEntry<T = unknown> {
  el: HTMLElement;
  index: number;
  key: string | null;
  data: T | null;
}

export interface SettleInput {
  remainingPx: number;
  velocity: number;
}

/**
 * Describes what the pages look like at any progress p (1 = upper page fully
 * open, 0 = upper page fully off-screen). Push runs p from 0 to 1, pop from
 * 1 to 0.
 *
 * `apply` is a declarative write, not a frame. For a timed phase the stack
 * calls it once, at the end, and CSS interpolates from where the pages already
 * were: the stack puts that phase's duration and curve in `--sn-t` / `--sn-e`
 * on the container, which the stylesheet's `transition` rules read. During a
 * drag `--sn-t` is `0s`, so the same write lands instantly. Keep `apply` to
 * `transform` and `opacity` and the browser keeps it off the main thread.
 *
 * Nothing writes where a phase *starts*, so a transition has to make sure that
 * is already true. The stack helps: whenever it comes to rest it calls `apply`
 * with p = 1 for every covered page, so a covered page stands where a pop
 * begins. A page arriving is the case JS cannot cover — it had no style a
 * moment ago — so its start belongs in an `@starting-style` rule, and `apply`
 * should write nothing at all where the stylesheet already puts a page, or the
 * inline declaration will outrank it.
 */
export interface Transition {
  readonly duration: number;
  /** Sampled to report `progress`; its `css` spelling is what drives the pixels. */
  readonly ease: Easing;
  settle(input: SettleInput): { duration: number; ease: Easing };
  /**
   * Re-read whatever the transition is configured from. Called once per
   * operation, before the stack touches the DOM, so that a transition reading
   * computed style has none of the stack's own writes to resolve.
   */
  refresh?(el: Element | null): void;
  /** Attach anything a page needs for as long as it is mounted, such as chrome that has to exist before the phase that animates it. */
  mount?(entry: StackEntry): void;
  unmount?(entry: StackEntry): void;
  begin?(lower: StackEntry | null, upper: StackEntry): void;
  apply(lower: StackEntry | null, upper: StackEntry, p: number): void;
  end?(lower: StackEntry | null, upper: StackEntry): void;
}

export type TransitionKind = 'push' | 'pop' | 'interactive';

/** Where an operation came from: `api`, `gesture`, `history`, or any value a port defines. */
export type NavigationSource = 'api' | 'gesture' | 'history' | (string & {});

export interface MountOptions<T = unknown> {
  animated?: boolean;
  data?: T | null;
  key?: string | null;
  source?: NavigationSource;
}

export interface PushEvent { entry: StackEntry; entries: StackEntry[]; source: NavigationSource }
export interface PopEvent { entry: StackEntry; removed: StackEntry[]; entries: StackEntry[]; source: NavigationSource }
export interface ReplaceEvent { entry: StackEntry; removed: StackEntry[]; entries: StackEntry[]; source: NavigationSource }
export interface ResetEvent { entries: StackEntry[]; removed: StackEntry[]; source: NavigationSource }
export interface TransitionEvent { lower: StackEntry | null; upper: StackEntry; kind: TransitionKind }
export interface ProgressEvent { lower: StackEntry | null; upper: StackEntry; p: number }

export interface StackEvents {
  push: PushEvent;
  pop: PopEvent;
  replace: ReplaceEvent;
  reset: ResetEvent;
  transitionstart: TransitionEvent;
  progress: ProgressEvent;
  transitionend: TransitionEvent;
}

export interface InteractivePopHandle {
  /** p = 1 fully open … 0 fully popped */
  update(p: number): void;
  /** Resolves when the settle animation ends. */
  finish(input: { complete: boolean; velocity?: number }): Promise<void>;
}

export interface NavigationStackOptions {
  container: HTMLElement;
  transition: Transition;
  pageClass?: string;
}

type Listener<E> = (detail: E) => void;

/**
 * A stack of page elements inside one container. The stack owns mounting,
 * ordering, visibility and the transition lifecycle. A `Transition` decides
 * what the pages look like at any progress p.
 *
 * Operations are serialized: one called during a transition waits its turn.
 */
export class NavigationStack {
  readonly container: HTMLElement;
  transition: Transition;
  readonly pageClass: string;
  entries: StackEntry[] = [];
  busy = false;
  private _destroyed = false;
  private _activeTransition: { lower: StackEntry | null; upper: StackEntry } | null = null;
  private _queue: Array<{ run: () => void; cancel: () => void }> = [];
  /** Whether the stylesheet can say where an arriving page comes from, or the engine has to. */
  private _startState: 'css' | 'write' | undefined;
  private _listeners = new Map<string, Set<Listener<unknown>>>();

  constructor({ container, transition, pageClass = 'sn-page' }: NavigationStackOptions) {
    if (!container || !transition) throw new Error('NavigationStack needs { container, transition }');
    this.container = container;
    this.transition = transition;
    this.pageClass = pageClass;
    container.classList.add('sn-container');
  }

  // ---------------------------------------------------------------- state
  get depth(): number {
    return this.entries.length;
  }
  get top(): StackEntry | null {
    return this.entries[this.entries.length - 1] || null;
  }
  width(): number {
    return this.container.clientWidth;
  }
  canPop(): boolean {
    return !this.busy && this.entries.length > 1;
  }
  /** The entry holding `el`, or the entry with `key`, if either is mounted. */
  entryOf(elOrKey: HTMLElement | string): StackEntry | null {
    return this.entries.find((e) => (typeof elOrKey === 'string' ? e.key === elOrKey : e.el === elOrKey)) || null;
  }

  on<K extends keyof StackEvents>(event: K, fn: Listener<StackEvents[K]>): () => void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    const set = this._listeners.get(event)!;
    set.add(fn as Listener<unknown>);
    return () => {
      set.delete(fn as Listener<unknown>);
    };
  }
  private _emit<K extends keyof StackEvents>(event: K, detail: StackEvents[K]): void {
    if (this._destroyed) return;
    const set = this._listeners.get(event);
    if (set) set.forEach((fn) => fn(detail));
  }

  // ------------------------------------------------------------ operations
  /**
   * Pushes an element, or a function returning one. Resolves with the entry
   * once the transition has finished. An element already mounted lower in the
   * stack is moved to the top.
   */
  push<T = unknown>(elOrFactory: HTMLElement | (() => HTMLElement), { animated = true, data = null, key = null, source = 'api' }: MountOptions<T> = {}): Promise<StackEntry> {
    return this._run(async () => {
      const el = typeof elOrFactory === 'function' ? elOrFactory() : elOrFactory;
      this._forget(el);
      const lower = this.top;
      const upper = this._mount(el, this.entries.length, data, key);
      this.entries.push(upper);
      await this._transition(lower, upper, 0, 1, animated, 'push');
      this._settle();
      this._emit('push', { entry: upper, entries: this.entries.slice(), source });
      return upper;
    });
  }

  /** Pops one level. Resolves with the removed entry; its element is detached, not destroyed. */
  pop(opts: { animated?: boolean; source?: NavigationSource } = {}): Promise<StackEntry | null> {
    return this.popTo(this.entries.length - 1, opts);
  }

  /** Pops until `depth` entries remain (≥ 1). Intermediate pages are removed without animation. */
  popTo(depth: number, { animated = true, source = 'api' }: { animated?: boolean; source?: NavigationSource } = {}): Promise<StackEntry | null> {
    return this._run(async () => {
      if (depth < 1 || this.entries.length <= depth) return null;
      return this._popRevealing(depth, animated, source);
    });
  }

  /**
   * Pops the top page, revealing `el`. If `el` is already mounted beneath the
   * top, everything above it is removed, as in `popTo`. If it is not mounted,
   * it is placed directly beneath the top first, so a page that no longer
   * exists (for example a fresh instance after a deep link) still arrives with
   * a pop.
   */
  popWith<T = unknown>(el: HTMLElement, { animated = true, data = null, key = null, source = 'api' }: MountOptions<T> = {}): Promise<StackEntry | null> {
    return this._run(async () => {
      if (!this.entries.length) {
        const entry = this._mount(el, 0, data, key);
        this.entries.push(entry);
        this._settle();
        this._emit('push', { entry, entries: this.entries.slice(), source });
        return null;
      }
      const top = this.top!;
      if (top.el === el) return null;
      const existing = this.entries.findIndex((e) => e.el === el);
      if (existing >= 0) return this._popRevealing(existing + 1, animated, source);
      const lower = this._mount(el, this.entries.length - 1, data, key, top.el);
      this.entries.splice(this.entries.length - 1, 0, lower);
      return this._popRevealing(this.entries.length - 1, animated, source);
    });
  }

  /** Swaps the top page for `el` without animation. Returns the removed entry. */
  replace<T = unknown>(el: HTMLElement, { data = null, key = null, source = 'api' }: MountOptions<T> = {}): Promise<StackEntry | null> {
    return this._run(async () => {
      const old = this.top;
      if (old && old.el === el) return null;
      this._forget(el);
      const removed = old ? [this._unmount(this.entries.pop()!)] : [];
      const entry = this._mount(el, this.entries.length, data, key);
      this.entries.push(entry);
      this._settle();
      this._emit('replace', { entry, removed, entries: this.entries.slice(), source });
      return removed[0] || null;
    });
  }

  /**
   * Convenience for ports that already resolved the direction: `push`, `pop`
   * (via `popWith`) or `replace`.
   */
  present<T = unknown>(el: HTMLElement, direction: 'push' | 'pop' | 'replace', opts: MountOptions<T> = {}): Promise<StackEntry | null> {
    if (direction === 'pop') return this.popWith(el, opts);
    if (direction === 'replace') return this.replace(el, opts);
    return this.push(el, opts);
  }

  /** Removes a mounted page without animation, wherever it sits. Returns its entry, or null. */
  remove(el: HTMLElement, { source = 'api' }: { source?: NavigationSource } = {}): Promise<StackEntry | null> {
    return this._run(async () => {
      const entry = this._forget(el);
      if (!entry) return null;
      this._settle();
      this._emit('pop', { entry, removed: [entry], entries: this.entries.slice(), source });
      return entry;
    });
  }

  /** Replaces the whole stack without animation. Returns the removed entries. */
  reset(elements: HTMLElement[], { source = 'api' }: { source?: NavigationSource } = {}): Promise<StackEntry[]> {
    return this._run(async () => {
      const removed: StackEntry[] = [];
      while (this.entries.length) removed.push(this._unmount(this.entries.pop()!));
      elements.forEach((el, i) => this.entries.push(this._mount(el, i, null, null)));
      this._settle();
      this._emit('reset', { entries: this.entries.slice(), removed, source });
      return removed;
    });
  }

  /** Starts a pointer-driven pop. Returns null if the stack cannot pop right now. */
  beginInteractivePop(): InteractivePopHandle | null {
    if (!this.canPop()) return null;
    this.transition.refresh?.(this.container);
    this._setBusy(true);
    const upper = this.top!;
    const lower = this.entries[this.entries.length - 2];
    let p = 1;
    this._begin(lower, upper, 'interactive');
    return {
      update: (v) => {
        if (this._destroyed) return;
        p = Math.min(1, Math.max(0, v));
        this._apply(lower, upper, p);
      },
      finish: async ({ complete, velocity = 0 }) => {
        if (this._destroyed) return;
        const remainingPx = (complete ? p : 1 - p) * this.width();
        const { duration, ease } = this.transition.settle({ remainingPx, velocity });
        await this._animate(lower, upper, p, complete ? 0 : 1, duration, ease);
        if (this._destroyed) return;
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

  /** Terminal: queued and subsequent navigation reject with AbortError. */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._listeners.clear();
    for (const task of this._queue.splice(0)) task.cancel();
    this.busy = false;
    const active = this._activeTransition;
    this._activeTransition = null;
    if (active) {
      this.transition.end?.(active.lower, active.upper);
      // During a pop the outgoing page has already left entries.
      if (!this.entries.includes(active.upper)) this._unmount(active.upper);
    }
    while (this.entries.length) this._unmount(this.entries.pop()!);
    this.container.classList.remove('sn-container', 'sn-busy');
    this.container.style.removeProperty('--sn-t');
    this.container.style.removeProperty('--sn-e');
  }

  // -------------------------------------------------------------- internals
  private _setBusy(v: boolean): void {
    if (this._destroyed) return;
    this.busy = v;
    this.container.classList.toggle('sn-busy', v);
  }

  /** Serializes operations: while a transition runs, later calls wait their turn. */
  private _run<R>(fn: () => Promise<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const cancel = () => reject(new DOMException('NavigationStack has been destroyed', 'AbortError'));
      if (this._destroyed) return cancel();
      const task = async () => {
        // Before the stack has written anything of its own, so that a
        // transition reading computed style resolves nothing on our account.
        this.transition.refresh?.(this.container);
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
      if (this.busy) this._queue.push({ run: task, cancel });
      else task();
    });
  }
  private _drain(): void {
    if (!this._destroyed && !this.busy && this._queue.length) this._queue.shift()!.run();
  }

  private async _popRevealing(depth: number, animated: boolean, source: NavigationSource): Promise<StackEntry> {
    const upper = this.entries.pop()!; // the visible page: it animates out
    const removed: StackEntry[] = [];
    while (this.entries.length > depth) removed.push(this._unmount(this.entries.pop()!)); // intermediate pages: removed without animation
    const lower = this.top;
    await this._transition(lower, upper, 1, 0, animated, 'pop');
    if (this._destroyed) return upper;
    removed.push(this._unmount(upper));
    this._settle();
    this._emit('pop', { entry: upper, removed, entries: this.entries.slice(), source });
    return upper;
  }

  private _mount(el: HTMLElement, index: number, data: unknown, key: string | null, before: HTMLElement | null = null): StackEntry {
    el.classList.add(this.pageClass);
    // Unconditionally, even for a page the host has already put in the
    // container: `@starting-style` only speaks for an element that was not
    // being rendered a moment ago, and the stack cannot know what the host did
    // with it first. Placing it here is what makes the page arriving new.
    if (before) this.container.insertBefore(el, before);
    else this.container.append(el);
    const entry = { el, index, key, data };
    this.transition.mount?.(entry);
    return entry;
  }
  private _unmount(entry: StackEntry): StackEntry {
    this.transition.unmount?.(entry);
    entry.el.classList.remove(this.pageClass, 'sn-page-visible', 'sn-page-upper', 'sn-page-lower');
    entry.el.style.transform = '';
    entry.el.style.opacity = '';
    entry.el.remove();
    return entry;
  }
  /** Drops `el` from the entries if it is mounted. Returns its old entry. */
  private _forget(el: HTMLElement): StackEntry | null {
    const i = this.entries.findIndex((e) => e.el === el);
    if (i < 0) return null;
    const [entry] = this.entries.splice(i, 1);
    return this._unmount(entry);
  }

  /**
   * The duration and curve of the phase in flight, as CSS reads them. `0s`
   * means land where you are told, now, which is what a drag wants and what
   * `prefers-reduced-motion` reduces every phase to.
   */
  private _timing(duration: number, ease?: Easing): void {
    if (this._destroyed) return;
    this.container.style.setProperty('--sn-t', cssDuration(duration));
    this.container.style.setProperty('--sn-e', cssEasing(ease));
  }

  private _begin(lower: StackEntry | null, upper: StackEntry, kind: TransitionKind): void {
    this._activeTransition = { lower, upper };
    this._timing(0);
    lower?.el.classList.add('sn-page-visible', 'sn-page-lower');
    upper.el.classList.add('sn-page-visible', 'sn-page-upper');
    this.transition.begin?.(lower, upper);
    this._emit('transitionstart', { lower, upper, kind });
  }
  private _apply(lower: StackEntry | null, upper: StackEntry, p: number): void {
    this.transition.apply(lower, upper, p);
    this._emit('progress', { lower, upper, p });
  }
  private _end(lower: StackEntry | null, upper: StackEntry, kind: TransitionKind): void {
    if (this._destroyed) return;
    this._activeTransition = null;
    this._timing(0);
    upper.el.classList.remove('sn-page-upper');
    lower?.el.classList.remove('sn-page-lower');
    this.transition.end?.(lower, upper);
    this._emit('transitionend', { lower, upper, kind });
  }

  /**
   * Hands the run from `from` to `to` over to the browser: say how long and on
   * what curve, write where the pages are going, then wait to be told they
   * arrived. No frame of it is ours, and neither is the style resolution —
   * where the pages are leaving from was settled long before this task.
   */
  private async _animate(lower: StackEntry | null, upper: StackEntry, from: number, to: number, duration: number, ease: Easing): Promise<void> {
    if (duration <= 0 || from === to) return this._apply(lower, upper, to);
    this._timing(duration, ease);
    this.transition.apply(lower, upper, to);
    const ticker = this._ticker(lower, upper, from, to, duration, ease);
    // A frame before asking what is running: `getAnimations()` has to resolve
    // pending style before it can answer, and asking here would resolve the
    // writes just made — the whole cost this engine is arranged to avoid. By
    // the next frame the browser has done that work as part of its own.
    await nextFrame();
    await animationsFinished([upper.el, lower?.el]);
    ticker?.cancel();
    this._timing(0);
    this._emit('progress', { lower, upper, p: to });
  }

  /**
   * `progress` used to be a by-product of animating in JS. Now that CSS
   * animates, reporting it costs a frame loop, so one only runs while someone
   * is subscribed. Chrome that just has to move with the pages is better off
   * reading `--sn-t` / `--sn-e` and the `sn-page-upper` / `sn-page-lower`
   * classes in CSS, which keeps it on the compositor too.
   */
  private _ticker(lower: StackEntry | null, upper: StackEntry, from: number, to: number, duration: number, ease: Easing): CancellableTween | null {
    if (!this._listeners.get('progress')?.size) return null;
    return tween({ from, to, duration, ease, onUpdate: (p) => this._emit('progress', { lower, upper, p }) });
  }

  private async _transition(lower: StackEntry | null, upper: StackEntry, from: number, to: number, animated: boolean, kind: TransitionKind): Promise<void> {
    this._begin(lower, upper, kind);
    // Where the phase starts is not written, it is already true: a covered page
    // was left standing there when the stack last settled, and a page arriving
    // takes its start from the stylesheet's `@starting-style`. Asked once, on
    // the first transition, because a browser that has never heard of the rule
    // leaves an arriving page with nothing to come from; there the engine
    // writes the start state and commits it, exactly as it used to.
    this._startState ??= supportsStartingStyle() ? 'css' : 'write';
    if (this._startState === 'write') {
      this._apply(lower, upper, from);
      commitStyles(upper.el);
    } else this._emit('progress', { lower, upper, p: from });
    await this._animate(lower, upper, from, to, animated ? this.transition.duration : 0, this.transition.ease);
    this._end(lower, upper, kind);
  }

  /** Makes only the top page visible, returns every page to its resting state, renumbers the indexes. */
  private _settle(): void {
    const top = this.top;
    this.entries.forEach((e, i) => {
      e.index = i;
      e.el.classList.toggle('sn-page-visible', e === top);
      // Only the top goes back to the identity; the rest are parked below.
      if (e === top) e.el.style.transform = '';
    });
    // A covered page rests where a covered page belongs, which is also where
    // the pop that reveals it begins. Writing it now, with no phase running and
    // nothing transitioning these pages, is what lets that pop start without
    // resolving any style at all.
    if (top) for (let i = 0; i < this.entries.length - 1; i++) this.transition.apply(this.entries[i], top, 1);
  }
}
