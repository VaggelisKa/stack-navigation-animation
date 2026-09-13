import { DOCUMENT, Location } from '@angular/common';
import {
  Directive,
  ElementRef,
  ErrorHandler,
  effect,
  inject,
  input,
  output,
  untracked,
  ViewContainerRef,
  type EmbeddedViewRef,
  type OnDestroy,
  type OnInit,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  ROUTER_CONFIGURATION,
  RouteReuseStrategy,
  Router,
  RouterOutlet,
  ActivatedRoute,
  type ActivatedRouteSnapshot,
  type DetachedRouteHandle,
} from '@angular/router';
import {
  createNativeStack,
  injectStyles,
  segmentsOf,
  type Direction,
  type NativeStack,
  type NativeTransitionOptions,
  type NavigationSource,
  type RouteRef,
  type StackEntry,
  type SwipeBackMode,
} from '@stacknav/core';
import { Subscription } from 'rxjs';
import { STACKNAV_CONFIG } from './config';
import { StackNavHistory } from './history';
import { StackNavRouteReuseStrategy, destroyHandle, type PageKeeper } from './route-reuse-strategy';
import { checkSetup, checkStrategy, warn } from './setup-checks';

declare const ngDevMode: boolean | undefined;

/** What the stack knows about a page, passed to direction strategies. */
export interface StackNavRouteRef extends RouteRef {
  snapshot: ActivatedRouteSnapshot;
}

/** A page the stack keeps alive. */
export interface StackNavPage {
  /** the page component */
  readonly instance: object;
  /** its host element, as the outlet created it */
  readonly el: HTMLElement;
  readonly key: string;
  readonly routeRef: StackNavRouteRef;
  /** the full app URL when the page was last active */
  url: string;
}

interface Page extends StackNavPage {
  routeRef: StackNavRouteRef;
  /** the router's handle, while it has the page detached */
  handle: DetachedRouteHandle | null;
  /** popped by an interactive pop, waiting for the router to catch up */
  pendingRemoval: boolean;
  /** the last scroll offset of every scroller inside the page, kept live */
  scroll: Map<Element, [number, number]>;
  stopScroll: () => void;
}

export interface StackNavActivation {
  page: StackNavPage;
  direction: Direction;
  animated: boolean;
  reused: boolean;
}

/** The stack was emptied by the router leaving its outlet; the pages are still kept. */
const EMPTIED: NavigationSource = 'suspend';
/** The outlet is showing one of the pages it had; the stack is put back as it was. */
const RESUMED: NavigationSource = 'resume';

/**
 * Puts the platform's native push/pop transition on Angular's own
 * `<router-outlet>`:
 *
 * ```html
 * <router-outlet stackNav />
 * ```
 *
 * The outlet keeps doing everything it does: it creates the page components,
 * binds their inputs, provides `ActivatedRoute` and hosts nested outlets. This
 * directive only listens to it. When the router activates a route, the page
 * that was showing is kept alive beneath the new one, and the change is
 * animated in the direction the strategies in `provideStackNav()` decide. The
 * page elements are the outlet's own: they are never wrapped or replaced, and
 * pages beneath the top keep their scroll position, form state and
 * subscriptions.
 *
 * The router puts every page next to the outlet, so the outlet's parent
 * element is the stack: the pages' scroll container, which needs a height.
 *
 * Keeping a page alive is the router's own detach/attach mechanism, driven by
 * `StackNavRouteReuseStrategy`, which `provideStackNav()` installs.
 */
@Directive({
  selector: 'router-outlet[stackNav]',
  exportAs: 'stackNav',
})
export class StackNav implements OnInit, OnDestroy, PageKeeper {
  /** Transition options for this stack, merged over `provideStackNav({ transition })`. Read once, when the stack is created. */
  readonly transition = input<Partial<NativeTransitionOptions> | undefined>(undefined, { alias: 'stackNavTransition' });
  /** Live override of the configured swipe policy. */
  readonly swipeBack = input<SwipeBackMode | undefined>(undefined, { alias: 'stackNavSwipeBack' });
  /** Every activation, with the direction that was resolved for it. */
  readonly activate = output<StackNavActivation>({ alias: 'stackNavActivate' });

  private readonly outlet = inject(RouterOutlet, { self: true });
  /** The container the outlet inserts pages into: the same one, injected on the same element. */
  private readonly outletViews = inject(ViewContainerRef);
  /** The outlet element; the stack is its parent. */
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly config = inject(STACKNAV_CONFIG);
  private readonly history = inject(StackNavHistory);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly strategy = inject(RouteReuseStrategy);
  /** The route of the page this outlet lives in: the root route for a top-level outlet. */
  private readonly hostRoute = inject(ActivatedRoute);
  private unregister: (() => void) | null = null;
  private destroyed = false;

  /**
   * The underlying core stack. Chrome that just has to move with the pages is
   * usually best driven from CSS, off `--sn-t` / `--sn-e` and the
   * `sn-page-upper` / `sn-page-lower` classes; subscribe to `progress` when
   * you need the number itself.
   */
  stack!: NativeStack;
  /** The direction of the last activation. */
  lastDirection: Direction | null = null;

  private entries: Page[] = [];
  private readonly byInstance = new Map<object, Page>();
  private readonly byEl = new Map<HTMLElement, Page>();
  /** Pages the router has detached and handed to us. */
  private readonly kept = new Set<Page>();
  private active: Page | null = null;
  private leaving: Page | null = null;
  /** The page the outlet just detached; the router hands over its handle next. */
  private detaching: Page | null = null;
  /** The entries of an emptied outlet, until it shows one of them again or its host page is gone for good. */
  private suspended: Page[] | null = null;
  private readonly subs = new Subscription();

  constructor() {
    if (this.strategy instanceof StackNavRouteReuseStrategy) this.unregister = this.strategy.register(this);
    effect(() => {
      const mode = this.swipeBack() ?? this.config.swipeBack;
      this.stack?.setSwipeBack(mode);
    });
    // Subscribed before the outlet's own ngOnInit can activate anything, so
    // nothing is missed; whatever it activated already is adopted in ngOnInit.
    const outlet = this.outlet;
    this.subs.add(outlet.activateEvents.subscribe(() => this.onActivated()));
    this.subs.add(outlet.attachEvents.subscribe(() => this.onActivated()));
    this.subs.add(outlet.detachEvents.subscribe((instance) => this.onDetached(instance)));
    this.subs.add(outlet.deactivateEvents.subscribe((instance) => this.onDeactivated(instance)));
    // The setup an app has to get right around the stack, said once. Folded
    // away by a production build.
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      checkSetup(this.host, inject(ROUTER_CONFIGURATION, { optional: true })?.canceledNavigationResolution);
      checkStrategy(this.strategy instanceof StackNavRouteReuseStrategy);
    }
  }

  // ------------------------------------------------------------- lifecycle
  ngOnInit(): void {
    this.ensureStack();
    if (this.outlet.isActivated) this.onActivated();
    this.subs.add(
      this.router.events.subscribe((e) => {
        const ended = e instanceof NavigationEnd;
        const failed = e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped;
        // The detach/store handshake never outlives its navigation.
        if (ended || failed) this.detaching = null;
        if (failed) this.restorePending();
        else if (ended) this.onNavigationEnd(e);
      }),
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.leaving = null;
    this.unregister?.();
    this.subs.unsubscribe();
    // The page on screen belongs to the outlet's view and goes with it. The
    // detached ones belong to nobody else.
    for (const page of this.byInstance.values()) {
      page.stopScroll();
      if (page.handle) destroyHandle(page.handle);
    }
    this.byInstance.clear();
    this.byEl.clear();
    this.kept.clear();
    this.entries = [];
    this.stack?.destroy();
  }

  // ----------------------------------------------------------------- state
  /** Pages currently kept, bottom to top. The last one is on screen. */
  get pages(): readonly StackNavPage[] {
    return this.entries.slice();
  }
  /** Whether a swipe has a kept page to reveal. */
  get canPop(): boolean {
    return this.entries.length > 1;
  }

  // --------------------------------------------- what the strategy asks us
  /** @internal The outlet is showing this route, so the router should detach it rather than destroy it. */
  showing(snapshot: ActivatedRouteSnapshot): boolean {
    const outlet = this.outlet;
    return outlet.isActivated && outlet.activatedRoute.snapshot === snapshot && this.byInstance.has(outlet.component);
  }
  /** @internal The router detached a page and hands over its handle. True if it was one of ours. */
  keep(snapshot: ActivatedRouteSnapshot, handle: DetachedRouteHandle): boolean {
    const page = this.detaching;
    if (!page || snapshot.outlet !== this.outlet.name || page.routeRef.snapshot.routeConfig !== snapshot.routeConfig) return false;
    this.detaching = null;
    page.handle = handle;
    // An interactive pop already took it off screen; the router is only now
    // catching up, and this is the moment it stops owning the component.
    if (page.pendingRemoval) this.destroyPage(page);
    else this.kept.add(page);
    return true;
  }
  /** @internal */
  has(snapshot: ActivatedRouteSnapshot): boolean {
    return !!this.keptFor(snapshot);
  }
  /** @internal */
  retrieve(snapshot: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    return this.keptFor(snapshot)?.handle ?? null;
  }
  /** @internal The router took a handle back to re-attach it. */
  release(snapshot: ActivatedRouteSnapshot): boolean {
    const page = this.keptFor(snapshot);
    if (!page) return false;
    this.kept.delete(page);
    page.handle = null;
    return true;
  }
  /** @internal Every handle still held, for the router's injector cleanup. */
  handles(): DetachedRouteHandle[] {
    const handles: DetachedRouteHandle[] = [];
    for (const page of this.kept) if (page.handle) handles.push(page.handle);
    return handles;
  }

  /**
   * The kept page this route would re-attach. The key alone is not enough: a
   * componentless parent route (`{ path: 'search', loadChildren }`) and its
   * `''` child share one URL path, and only the child's route owns the page;
   * a custom `keyOf` may group several routes under one key; and another
   * stack, in a named outlet, may keep the same route.
   */
  private keptFor(snapshot: ActivatedRouteSnapshot): Page | null {
    if (snapshot.outlet !== this.outlet.name) return null;
    const key = this.config.keyOf(snapshot);
    for (const page of this.kept) if (page.key === key && page.routeRef.snapshot.routeConfig === snapshot.routeConfig) return page;
    return null;
  }

  // -------------------------------------------------- what the outlet says
  /** The outlet created a page, or re-attached a kept one. */
  private onActivated(): void {
    const outlet = this.outlet;
    if (!outlet.isActivated) return;
    const instance = outlet.component;
    if (this.active?.instance === instance) return;
    const stack = this.ensureStack();
    const route = outlet.activatedRoute;
    let page = this.byInstance.get(instance) ?? null;
    const reused = !!page;
    if (!page) {
      const el = this.elementOf();
      if (!el) {
        if (typeof ngDevMode === 'undefined' || ngDevMode) warn('no-element', 'the outlet activated a component without a host element, so the stack cannot show it.');
        return;
      }
      const key = this.config.keyOf(route.snapshot);
      page = { instance, el, key, routeRef: this.routeRefOf(route.snapshot, key), url: '', handle: null, pendingRemoval: false, ...watchScroll(el) };
      this.byInstance.set(instance, page);
      this.byEl.set(el, page);
    }
    const resumed = !!this.suspended && this.resume(page);
    const leaving = this.takeLeaving();
    // Hidden until the stack shows it, even if a transition is still running.
    page.el.classList.add(stack.pageClass);
    this.show(page, route, leaving, reused, resumed);
  }

  /** The router detached the page on screen: it stays alive, and the element is ours to keep. */
  private onDetached(instance: unknown): void {
    const page = this.pageOf(instance);
    if (!page) return;
    if (this.active === page) this.active = null;
    this.detaching = page;
    if (page.pendingRemoval) return;
    // Angular took the element out of the DOM, which reset every scroll
    // offset inside it. Put it back in the container, where the stack has it
    // hidden, until the router wants it again.
    const container = this.ensureStack().container;
    if (page.el.parentElement !== container) container.append(page.el);
    restoreScroll(page.scroll);
    // The router detaches before it activates, synchronously. If no
    // activation follows, the outlet is empty: the router left this outlet
    // altogether, or is detaching the page this whole stack lives in. Either
    // way the pages stay kept and the stack is suspended, to resume as it was
    // when the outlet shows one of them again, or to be dropped once a
    // navigation ends with the host page active and the outlet still empty.
    this.leaving = page;
    // A navigation ends in the same task as its activations, so NavigationEnd
    // is where that is known; the microtask is for a detach outside one.
    queueMicrotask(() => this.suspend(page));
  }

  private suspend(page: Page): void {
    if (this.leaving !== page) return;
    this.leaving = null;
    this.suspended = [...(this.suspended ?? []), ...this.entries];
    this.entries = [];
    this.runStackTask(this.stack.reset([], { source: EMPTIED }));
  }

  /**
   * The outlet shows a page again after being emptied. If it is one of the
   * suspended pages, the stack comes back as it was up to that page, and
   * whatever was above it is popped for good; anything else means the old
   * stack is gone. True when the page is placed by this.
   */
  private resume(page: Page): boolean {
    const suspended = this.suspended!;
    this.suspended = null;
    const i = suspended.indexOf(page);
    for (const p of suspended.slice(i + 1)) this.destroyPage(p);
    if (i < 0) return false;
    // A page beneath that the router no longer holds cannot be shown again.
    for (const p of suspended.slice(0, i)) if (!p.handle) this.forget(p);
    this.entries = suspended.slice(0, i + 1).filter((p) => p === page || p.handle);
    // The suspend unmounted the lower pages; mounting them again resets their scrollers.
    this.runStackTask(this.stack.reset(this.entries.map((p) => p.el), { source: RESUMED }).then(() => this.entries.forEach((p) => restoreScroll(p.scroll))));
    return true;
  }

  private onNavigationEnd(e: NavigationEnd): void {
    if (this.active) this.active.url = e.urlAfterRedirects;
    if (this.leaving) this.suspend(this.leaving);
    // Emptied while its host page stays active: the outlet was left for good, and so were its pages.
    if (this.suspended && !this.outlet.isActivated && this.hostIsActive()) {
      const suspended = this.suspended;
      this.suspended = null;
      for (const page of suspended) this.destroyPage(page);
    }
  }

  /** Whether the page this outlet lives in is part of the router's current state, rather than kept by a stack of its own. */
  private hostIsActive(): boolean {
    const target = this.hostRoute.snapshot;
    const inTree = (s: ActivatedRouteSnapshot): boolean => s === target || s.children.some(inTree);
    return inTree(this.router.routerState.snapshot.root);
  }

  /**
   * The router destroyed the page rather than detaching it: the strategy is
   * not installed, the outlet's `name` changed, or the router chose not to
   * keep this route.
   */
  private onDeactivated(instance: unknown): void {
    const page = this.pageOf(instance);
    if (!page) return;
    this.forget(page);
    this.runStackTask(this.stack.remove(page.el));
  }

  // -------------------------------------------------------------- internals
  private ensureStack(): NativeStack {
    if (this.stack) return this.stack;
    // The router inserts the pages next to the outlet, so its parent is the stack.
    const container = this.host.parentElement;
    if (!container) throw new Error('[stacknav] <router-outlet stackNav> needs a parent element: the router puts the pages next to the outlet, and that element is the stack.');
    const stack = (this.stack = createNativeStack({
      container,
      transition: { ...this.config.transition, ...(untracked(this.transition) || {}) },
      swipeBack: untracked(this.swipeBack) ?? this.config.swipeBack,
    }));
    if (this.config.injectStyles) injectStyles(this.document);
    stack.on('pop', (e) => this.onStackRemoved(e.removed, e.source));
    stack.on('replace', (e) => this.onStackRemoved(e.removed, e.source));
    stack.on('reset', (e) => this.onStackRemoved(e.removed, e.source));
    return stack;
  }

  /** Teardown cancels queued navigation; report other failures through Angular. */
  private runStackTask(task: Promise<unknown>): void {
    void task.catch((error: unknown) => {
      if (this.destroyed && error instanceof Error && error.name === 'AbortError') return;
      this.errorHandler.handleError(error);
    });
  }

  private takeLeaving(): Page | null {
    const leaving = this.leaving;
    this.leaving = null;
    return leaving;
  }

  private pageOf(instance: unknown): Page | null {
    return (typeof instance === 'object' && instance && this.byInstance.get(instance)) || null;
  }

  /**
   * The host element of the page the outlet just put on screen. The outlet
   * creates or inserts it as the last view of its own container, which this
   * directive reads off the same element.
   */
  private elementOf(): HTMLElement | null {
    const views = this.outletViews;
    const view = views.get(views.length - 1) as EmbeddedViewRef<unknown> | null;
    return (view?.rootNodes.find((n: Node) => n.nodeType === Node.ELEMENT_NODE) as HTMLElement | undefined) ?? null;
  }

  /** Decides the direction, places the page in the stack, and makes it the active one. */
  private show(page: Page, route: ActivatedRoute, leaving: Page | null, reused: boolean, resumed = false): void {
    const nav = this.history.current;
    const from = leaving ?? this.entries[this.entries.length - 1] ?? null;
    // Resolvers may have rerun, and a custom keyOf may group several snapshots, so the old snapshot cannot be trusted.
    page.routeRef = this.routeRefOf(route.snapshot, page.key);
    // Placed already: by the resume, or by an interactive pop the router is catching up with.
    const alreadyOnScreen = resumed || (reused && !this.stack.busy && this.stack.top?.el === page.el);
    let direction = this.config.resolve({
      from: from?.routeRef ?? null,
      to: page.routeRef,
      trigger: nav?.trigger ?? 'imperative',
      historyDelta: nav?.historyDelta,
      hint: nav?.hint,
      stack: this.entries.map((p) => p.key),
    });
    // After a swipe the page beneath is already showing and the one that left
    // is gone. A pop onto anything else has nothing to pop, so just show the page.
    if (!leaving && this.stack.top && direction === 'pop' && !reused) direction = 'replace';
    const animated = !alreadyOnScreen && this.config.animated() && (nav?.animated ?? true) && (this.entries.length > 0 || !!leaving);

    const current = this.router.getCurrentNavigation();
    page.url = current ? this.router.serializeUrl(current.finalUrl ?? current.extractedUrl) : this.router.url;
    this.active = page;
    this.lastDirection = direction;
    this.place(page, direction, leaving);
    // The router put a kept page back into the DOM just now, at zero. A push
    // of a page kept lower down moves the element again once the stack gets
    // to it, so the offsets are written back after that too.
    if (reused) restoreScroll(page.scroll);
    if (!alreadyOnScreen) {
      const task = this.stack.present(page.el, direction, { key: page.key, animated, source: sourceOf(nav?.trigger) });
      this.runStackTask(reused ? task.then(() => restoreScroll(page.scroll)) : task);
    }
    this.activate.emit({ page, direction, animated, reused });
  }

  /** Mirrors what the stack will do, synchronously, so `pages` and the next direction stay correct. */
  private place(page: Page, direction: Direction, leaving: Page | null): void {
    const entries = this.entries;
    const drop = (p: Page | null) => {
      const i = p ? entries.indexOf(p) : -1;
      if (i >= 0) entries.splice(i, 1);
    };
    if (direction === 'pop' && entries.includes(page)) {
      entries.splice(entries.indexOf(page) + 1);
      return;
    }
    if (direction !== 'push') drop(leaving);
    drop(page);
    entries.push(page);
  }

  private routeRefOf(snapshot: ActivatedRouteSnapshot, key: string): StackNavRouteRef {
    return { key, segments: segmentsOf(key), level: this.config.levelOf(snapshot), data: snapshot.data, snapshot };
  }

  private onStackRemoved(removed: StackEntry[], source: NavigationSource): void {
    // A suspended stack only unmounts: the router still holds the pages' routes.
    if (source === EMPTIED) return;
    for (const entry of removed) {
      const page = this.byEl.get(entry.el);
      if (!page) continue;
      if (source === 'gesture') {
        // The page is still the outlet's until the router catches up (or refuses).
        page.pendingRemoval = true;
        if (this.active === page) this.active = null;
        this.entries = this.entries.filter((p) => p !== page);
        this.navigateBackAfterGesture();
      } else {
        this.destroyPage(page);
      }
    }
  }

  /** The interactive pop already revealed the page beneath. Bring the router in line with it. */
  private navigateBackAfterGesture(): void {
    const lower = this.entries[this.entries.length - 1];
    if (!lower) return;
    const previous = this.history.previousUrl;
    if (previous != null && this.sameUrl(previous, lower.url)) {
      this.location.back();
    } else {
      void this.router.navigateByUrl(lower.url, { info: { [this.config.infoKey]: { direction: 'pop', animated: false } } });
    }
  }

  private sameUrl(a: string, b: string): boolean {
    const norm = (u: string) => this.router.serializeUrl(this.router.parseUrl(u));
    return norm(a) === norm(b);
  }

  /** The router refused the navigation the pop asked for, so put the page back. */
  private restorePending(): void {
    for (const page of this.byInstance.values()) {
      if (!page.pendingRemoval) continue;
      page.pendingRemoval = false;
      this.entries.push(page);
      this.active = page;
      // The pop took the element out of the DOM; the push puts it back, possibly only once the stack is free.
      this.runStackTask(this.stack.push(page.el, { animated: false, key: page.key, source: 'restore' }).then(() => restoreScroll(page.scroll)));
    }
  }

  /** Drops a page from every map. Does not touch the component. */
  private forget(page: Page): void {
    page.stopScroll();
    this.byInstance.delete(page.instance);
    this.byEl.delete(page.el);
    this.kept.delete(page);
    this.entries = this.entries.filter((p) => p !== page);
    if (this.active === page) this.active = null;
    if (this.leaving === page) this.leaving = null;
    if (this.detaching === page) this.detaching = null;
  }

  private destroyPage(page: Page): void {
    // A page the outlet still holds is the outlet's to destroy, never ours.
    const outlet = this.outlet;
    if (outlet.isActivated && outlet.component === page.instance) return;
    const handle = page.handle;
    page.handle = null;
    this.forget(page);
    if (handle) destroyHandle(handle);
  }
}

function sourceOf(trigger: 'imperative' | 'history' | undefined): NavigationSource {
  return trigger === 'history' ? 'history' : 'api';
}

/**
 * Taking an element out of the DOM resets every scroll offset inside it, and
 * the router does exactly that to a page it detaches. Rather than walk the
 * page for scrollers at that moment, on the main thread, right as a push
 * starts, the offsets are recorded as they happen: `scroll` does not bubble,
 * but a capturing listener on the page element sees every scroller inside it.
 */
function watchScroll(el: HTMLElement): Pick<Page, 'scroll' | 'stopScroll'> {
  const scroll = new Map<Element, [number, number]>();
  const onScroll = (e: Event) => {
    const t = e.target;
    if (t instanceof Element) scroll.set(t, [t.scrollTop, t.scrollLeft]);
  };
  el.addEventListener('scroll', onScroll, { capture: true, passive: true });
  return { scroll, stopScroll: () => el.removeEventListener('scroll', onScroll, { capture: true }) };
}

/** Writes the recorded offsets back. A scroller the page has since replaced is dropped. */
function restoreScroll(scroll: Map<Element, [number, number]>): void {
  for (const [el, [top, left]] of scroll) {
    if (!el.isConnected) {
      scroll.delete(el);
      continue;
    }
    if (el.scrollTop !== top) el.scrollTop = top;
    if (el.scrollLeft !== left) el.scrollLeft = left;
  }
}
