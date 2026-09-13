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
  type ComponentRef,
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
  type ActivatedRoute,
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
import { StackNavRouteReuseStrategy, type PageKeeper } from './route-reuse-strategy';
import { checkSetup, checkStrategy } from './setup-checks';

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
  /** the component's ref, known once the router has detached the page and handed it over */
  ref: ComponentRef<unknown> | null;
  /** the router's handle, while it has the page detached */
  handle: DetachedRouteHandle | null;
  /** popped by an interactive pop, waiting for the router to catch up */
  pendingRemoval: boolean;
  /** scroll offsets inside the page, taken before it left the DOM */
  scroll: ScrollOffsets | null;
}

type ScrollOffsets = Array<[Element, number, number]>;

export interface StackNavActivation {
  page: StackNavPage;
  direction: Direction;
  animated: boolean;
  reused: boolean;
}

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
  /** Transition options for this stack, merged over `provideStackNav({ transition })`. */
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
  /** Pages the router has detached and handed to us, by key. */
  private readonly kept = new Map<string, Page>();
  private active: Page | null = null;
  private leaving: Page | null = null;
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
        if (e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped) this.restorePending();
        else if (e instanceof NavigationEnd && this.active) this.active.url = e.urlAfterRedirects;
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
    for (const page of this.byInstance.values()) if (page.handle) page.ref?.destroy();
    this.byInstance.clear();
    this.byEl.clear();
    this.kept.clear();
    this.entries = [];
    this.stack?.destroy();
  }

  // ----------------------------------------------------------------- state
  /** Pages currently kept, bottom to top. The last one is on screen. */
  get pages(): readonly StackNavPage[] {
    return this.entries;
  }
  /** Whether a swipe has a kept page to reveal. */
  get canPop(): boolean {
    return this.entries.length > 1;
  }

  // --------------------------------------------- what the strategy asks us
  /** @internal The outlet is showing this route, so the router should detach it rather than destroy it. */
  showing(snapshot: ActivatedRouteSnapshot): boolean {
    const outlet = this.outlet;
    if (!outlet.isActivated) return false;
    const page = outlet.activatedRoute.snapshot === snapshot ? this.byInstance.get(outlet.component) : null;
    if (!page) return false;
    // The router is about to take the page out of the DOM, which resets every scroll offset in it.
    page.scroll = captureScroll(page.el);
    return true;
  }
  /** @internal The router detached a page and hands over its handle. True if it was one of ours. */
  keep(handle: DetachedRouteHandle): boolean {
    const ref = (handle as { componentRef?: ComponentRef<unknown> }).componentRef;
    const page = ref && this.byInstance.get(ref.instance as object);
    if (!page) return false;
    page.ref = ref;
    // An interactive pop already took it off screen; the router is only now
    // catching up, and this is the moment it stops owning the component.
    if (page.pendingRemoval) {
      this.destroyPage(page);
      return true;
    }
    page.handle = handle;
    this.kept.set(page.key, page);
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
    this.kept.delete(page.key);
    page.handle = null;
    return true;
  }

  /**
   * The kept page this route would re-attach. The key alone is not enough: a
   * componentless parent route (`{ path: 'search', loadChildren }`) and its
   * `''` child share one URL path, and only the child's route owns the page.
   */
  private keptFor(snapshot: ActivatedRouteSnapshot): Page | null {
    const page = this.kept.get(this.config.keyOf(snapshot));
    return page && page.routeRef.snapshot.routeConfig === snapshot.routeConfig ? page : null;
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
    const leaving = this.takeLeaving();
    let page = this.byInstance.get(instance) ?? null;
    const reused = !!page;
    if (!page) {
      const el = this.elementOf();
      if (!el) return;
      const key = this.config.keyOf(route.snapshot);
      page = { instance, el, key, routeRef: this.routeRefOf(route.snapshot, key), url: '', ref: null, handle: null, pendingRemoval: false, scroll: null };
      this.byInstance.set(instance, page);
      this.byEl.set(el, page);
    }
    // Hidden until the stack shows it, even if a transition is still running.
    page.el.classList.add(stack.pageClass);
    this.show(page, route, leaving, reused);
  }

  /** The router detached the page on screen: it stays alive, and the element is ours to keep. */
  private onDetached(instance: unknown): void {
    const page = this.pageOf(instance);
    if (!page) return;
    if (this.active === page) this.active = null;
    if (page.pendingRemoval) return;
    // Angular took the element out of the DOM. Put it back in the container,
    // where the stack has it hidden, until the router wants it again.
    const container = this.ensureStack().container;
    if (page.el.parentElement !== container) container.append(page.el);
    restoreScroll(page.scroll);
    // The router detaches before it activates, synchronously. If no
    // activation follows, the outlet is really empty.
    this.leaving = page;
    queueMicrotask(() => {
      if (this.leaving !== page) return;
      this.leaving = null;
      this.entries = [];
      this.runStackTask(this.stack.reset([]));
    });
  }

  /** The router destroyed the page outright, which only happens without `StackNavRouteReuseStrategy`. */
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
    // An interactive pop that completes takes the page out of the DOM; if the
    // router then refuses, the page comes back and wants its scroll offsets.
    stack.on('transitionstart', ({ upper, kind }) => {
      const page = kind === 'interactive' ? this.byEl.get(upper.el) : null;
      if (page) page.scroll = captureScroll(page.el);
    });
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
  private show(page: Page, route: ActivatedRoute, leaving: Page | null, reused: boolean): void {
    const nav = this.history.current;
    const from = leaving ?? this.entries[this.entries.length - 1] ?? null;
    // Resolvers may have rerun, and a custom keyOf may group several snapshots, so the old snapshot cannot be trusted.
    page.routeRef = this.routeRefOf(route.snapshot, page.key);
    const alreadyOnScreen = reused && !this.stack.busy && this.stack.top?.el === page.el;
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
    const animated = this.config.animated() && (nav?.animated ?? true) && (this.entries.length > 0 || !!leaving);

    const current = this.router.getCurrentNavigation();
    page.url = current ? this.router.serializeUrl(current.finalUrl ?? current.extractedUrl) : this.router.url;
    this.active = page;
    this.lastDirection = direction;
    this.place(page, direction, leaving);
    if (!alreadyOnScreen) {
      this.runStackTask(this.stack.present(page.el, direction, { key: page.key, animated, source: sourceOf(nav?.trigger) }));
    }
    // The router put the kept page back into the DOM just now, at zero.
    if (reused) restoreScroll(page.scroll);
    page.scroll = null;
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
      this.runStackTask(this.stack.push(page.el, { animated: false, key: page.key, source: 'restore' }));
      restoreScroll(page.scroll);
      page.scroll = null;
    }
  }

  /** Drops a page from every map. Does not touch the component. */
  private forget(page: Page): void {
    this.byInstance.delete(page.instance);
    this.byEl.delete(page.el);
    if (this.kept.get(page.key) === page) this.kept.delete(page.key);
    this.entries = this.entries.filter((p) => p !== page);
    if (this.active === page) this.active = null;
    if (this.leaving === page) this.leaving = null;
  }

  private destroyPage(page: Page): void {
    // A page the outlet still holds is the outlet's to destroy, never ours.
    const outlet = this.outlet;
    if (outlet.isActivated && outlet.component === page.instance) return;
    this.forget(page);
    page.ref?.destroy();
  }
}

function sourceOf(trigger: 'imperative' | 'history' | undefined): NavigationSource {
  return trigger === 'history' ? 'history' : 'api';
}

/**
 * Taking an element out of the DOM resets every scroll offset inside it, and
 * the router does exactly that to a page it detaches. These two keep what the
 * old outlet kept for free: the page's own offset and any scroller inside it.
 */
function captureScroll(root: HTMLElement): ScrollOffsets {
  const out: ScrollOffsets = [];
  if (root.scrollTop || root.scrollLeft) out.push([root, root.scrollTop, root.scrollLeft]);
  for (const el of root.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) out.push([el, el.scrollTop, el.scrollLeft]);
  return out;
}

function restoreScroll(saved: ScrollOffsets | null): void {
  if (!saved) return;
  for (const [el, top, left] of saved) {
    if (el.scrollTop !== top) el.scrollTop = top;
    if (el.scrollLeft !== left) el.scrollLeft = left;
  }
}
