import { DOCUMENT, Location } from '@angular/common';
import {
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  Output,
  ViewContainerRef,
  inject,
  input,
  reflectComponentType,
  type ComponentRef,
  type EnvironmentInjector,
  type OnDestroy,
  type OnInit,
  type Type,
} from '@angular/core';
import {
  ActivatedRoute,
  ChildrenOutletContexts,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  PRIMARY_OUTLET,
  ROUTER_OUTLET_DATA,
  Router,
  type ActivatedRouteSnapshot,
  type OutletContext,
  type RouterOutletContract,
} from '@angular/router';
import {
  createIOSStack,
  injectStyles,
  segmentsOf,
  type Direction,
  type EdgePanGestureOptions,
  type IOSStack,
  type IOSTransitionOptions,
  type NavigationSource,
  type RouteRef,
  type StackEntry,
} from '@stacknav/core';
import { Subscription, combineLatest, from, of, switchMap } from 'rxjs';
import { StackNavActivatedRoute } from './activated-route-proxy';
import { STACKNAV_CONFIG } from './config';
import { StackNavHistory } from './history';

/** What the outlet knows about a page, for direction strategies. */
export interface StackNavRouteRef extends RouteRef {
  snapshot: ActivatedRouteSnapshot;
}

/** A page the outlet keeps alive. */
export interface StackNavView {
  readonly ref: ComponentRef<unknown>;
  readonly el: HTMLElement;
  readonly key: string;
  readonly routeRef: StackNavRouteRef;
  /** the full app URL when the page was last active */
  url: string;
  route: ActivatedRoute;
}

interface View extends StackNavView {
  routeRef: StackNavRouteRef;
  proxy: StackNavActivatedRoute | null;
  savedContexts: Map<string, OutletContext> | null;
  /** popped by the swipe gesture; waiting for the router to catch up */
  pendingRemoval: boolean;
  inputs: Subscription | null;
}

export interface StackNavActivation {
  view: StackNavView;
  direction: Direction;
  animated: boolean;
  reused: boolean;
}

/**
 * A router outlet (`RouterOutletContract`) that keeps a stack of pages and
 * moves between them with the iOS push/pop transition. Use it where you would
 * use `<router-outlet>`; the router drives it the same way:
 *
 * ```html
 * <sn-outlet />
 * ```
 *
 * Pages beneath the top stay alive (scroll position, form state, subscriptions),
 * a swipe from the leading edge pops interactively, and the direction of every
 * navigation is decided by the strategies configured in `provideStackNav()`.
 * The element needs a height; it is the pages' scroll container.
 */
@Directive({
  selector: 'sn-outlet',
  exportAs: 'snOutlet',
  host: { style: 'display: block' },
})
export class StackNavOutlet implements RouterOutletContract, OnInit, OnDestroy {
  /** Outlet name, like `router-outlet`'s. Static. */
  @Input() name: string = PRIMARY_OUTLET;
  /** Per-outlet transition options, merged over `provideStackNav({ transition })`. */
  @Input() transition: Partial<IOSTransitionOptions> | undefined;
  /** Per-outlet gesture options, merged over `provideStackNav({ gesture })`; `false` disables the swipe. */
  @Input() gesture: Partial<EdgePanGestureOptions> | false | undefined;
  /** Same as `router-outlet`'s: available to pages through `ROUTER_OUTLET_DATA`. */
  readonly routerOutletData = input<unknown>(undefined);

  /** A page component was created. */
  @Output('activate') activateEvents = new EventEmitter<unknown>();
  /** A page component was destroyed. */
  @Output('deactivate') deactivateEvents = new EventEmitter<unknown>();
  /** A kept page was shown again, or a detached one re-attached. */
  @Output('attach') attachEvents = new EventEmitter<unknown>();
  @Output('detach') detachEvents = new EventEmitter<unknown>();
  /** Every activation, with the direction that was resolved for it. */
  @Output('navigated') navigatedEvents = new EventEmitter<StackNavActivation>();

  private readonly parentContexts = inject(ChildrenOutletContexts);
  private readonly location = inject(ViewContainerRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly config = inject(STACKNAV_CONFIG);
  private readonly history = inject(StackNavHistory);
  private readonly router = inject(Router);
  private readonly browserLocation = inject(Location);
  private readonly document = inject(DOCUMENT);

  /** The underlying core stack; subscribe to `progress` to drive your own chrome. */
  stack!: IOSStack;
  /** The direction of the last activation. */
  lastDirection: Direction | null = null;

  /** Inputs are bound when the router was configured `withComponentInputBinding()`. */
  readonly supportsBindingToComponentInputs?: true;

  private views: View[] = [];
  private readonly byEl = new Map<HTMLElement, View>();
  private readonly detached = new Map<ComponentRef<unknown>, View>();
  private activeView: View | null = null;
  private leaving: View | null = null;
  private activated: ComponentRef<unknown> | null = null;
  private _activatedRoute: ActivatedRoute | null = null;
  private subs = new Subscription();

  constructor() {
    if (this.router.componentInputBindingEnabled) this.supportsBindingToComponentInputs = true;
  }

  // ------------------------------------------------------------- lifecycle
  ngOnInit(): void {
    const gesture = this.gesture === false || this.config.gesture === false ? false : { ...(this.config.gesture || {}), ...(this.gesture || {}) };
    this.stack = createIOSStack({
      container: this.host,
      transition: { ...this.config.transition, ...(this.transition || {}) },
      gesture: gesture || {},
    });
    if (gesture === false) this.stack.gesture.detach();
    if (this.config.injectStyles) injectStyles(this.document);

    this.stack.on('pop', (e) => this.onStackRemoved(e.removed, e.source));
    this.stack.on('replace', (e) => this.onStackRemoved(e.removed, e.source));
    this.stack.on('reset', (e) => this.onStackRemoved(e.removed, e.source));
    if (this.config.detachInactiveViews) {
      this.stack.on('transitionstart', ({ lower, upper }) => {
        for (const entry of [lower, upper]) {
          const view = entry && this.byEl.get(entry.el);
          if (view) view.ref.changeDetectorRef.reattach();
        }
      });
      for (const event of ['push', 'pop', 'replace', 'reset'] as const) this.stack.on(event, () => this.syncChangeDetection());
    }
    this.subs.add(
      this.router.events.subscribe((e) => {
        if (e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped) this.restorePending();
        else if (e instanceof NavigationEnd && this.activeView) this.activeView.url = e.urlAfterRedirects;
      }),
    );

    this.parentContexts.onChildOutletCreated(this.name, this);
    const context = this.parentContexts.getContext(this.name);
    if (context?.route) {
      if (context.attachRef) this.attach(context.attachRef, context.route);
      else this.activateWith(context.route, context.injector);
    }
  }

  ngOnDestroy(): void {
    if (this.parentContexts.getContext(this.name)?.outlet === this) this.parentContexts.onChildOutletDestroyed(this.name);
    this.subs.unsubscribe();
    for (const view of this.byEl.values()) view.inputs?.unsubscribe();
    this.stack?.destroy();
  }

  // -------------------------------------------------------- outlet contract
  get isActivated(): boolean {
    return !!this.activated;
  }
  get component(): object {
    if (!this.activated) throw new Error('Outlet is not activated');
    return this.activated.instance as object;
  }
  get activatedComponentRef(): ComponentRef<unknown> | null {
    return this.activated;
  }
  get activatedRoute(): ActivatedRoute {
    if (!this.activated) throw new Error('Outlet is not activated');
    return this._activatedRoute!;
  }
  get activatedRouteData(): Record<string, unknown> {
    return this._activatedRoute ? this._activatedRoute.snapshot.data : {};
  }

  /** Pages currently kept, bottom to top. The last one is on screen. */
  get pages(): readonly StackNavView[] {
    return this.views;
  }
  /** Whether a swipe has a kept page to reveal. */
  get canPop(): boolean {
    return this.views.length > 1;
  }

  activateWith(activatedRoute: ActivatedRoute, environmentInjector: EnvironmentInjector): void {
    if (this.activated) throw new Error('Cannot activate an already activated outlet');
    const snapshot = activatedRoute.snapshot;
    const key = this.config.keyOf(snapshot);
    const leaving = this.takeLeaving();
    let existing = this.views.find((v) => v.key === key) ?? null;
    if (existing === leaving) existing = null;
    const view = existing ?? this.createView(snapshot.component!, activatedRoute, environmentInjector, key);
    this.show(view, activatedRoute, leaving, !!existing);
  }

  deactivate(): void {
    if (!this.activated) return;
    const view = this.activeView!;
    this.unbindInputs(view);
    const context = this.parentContexts.getContext(this.name);
    if (context) view.savedContexts = (context.children as unknown as { contexts: Map<string, OutletContext> }).contexts;
    this.activated = null;
    this._activatedRoute = null;
    this.activeView = null;
    if (view.pendingRemoval) {
      this.destroyView(view);
      return;
    }
    // The router deactivates before it activates, synchronously. If nothing
    // follows, the outlet is genuinely empty.
    this.leaving = view;
    queueMicrotask(() => {
      if (this.leaving !== view) return;
      this.leaving = null;
      this.views = [];
      void this.stack.reset([]);
    });
  }

  detach(): ComponentRef<unknown> {
    if (!this.activated) throw new Error('Outlet is not activated');
    const view = this.activeView!;
    const ref = view.ref;
    this.unbindInputs(view);
    this.activated = null;
    this._activatedRoute = null;
    this.activeView = null;
    this.byEl.delete(view.el);
    this.views = this.views.filter((v) => v !== view);
    this.detached.set(ref, view);
    void this.stack.remove(view.el);
    const i = this.location.indexOf(ref.hostView);
    if (i >= 0) this.location.detach(i);
    this.detachEvents.emit(ref.instance);
    return ref;
  }

  attach(ref: ComponentRef<unknown>, activatedRoute: ActivatedRoute): void {
    const key = this.config.keyOf(activatedRoute.snapshot);
    let view = this.detached.get(ref) ?? null;
    this.detached.delete(ref);
    if (!view) view = this.wrap(ref, activatedRoute, key, null);
    this.location.insert(ref.hostView);
    this.park(view.el);
    this.byEl.set(view.el, view);
    const leaving = this.takeLeaving();
    this.show(view, activatedRoute, leaving, true);
  }

  // -------------------------------------------------------------- internals
  private takeLeaving(): View | null {
    const leaving = this.leaving;
    this.leaving = null;
    return leaving;
  }

  /** Decide the direction, place the page in the stack, make it the active one. */
  private show(view: View, activatedRoute: ActivatedRoute, leaving: View | null, reused: boolean): void {
    const nav = this.history.current;
    const from = leaving ?? this.views[this.views.length - 1] ?? null;
    // Resolvers may have rerun and a custom keyOf may group several snapshots: never trust the old one.
    view.routeRef = this.routeRefOf(activatedRoute.snapshot, view.key);
    const alreadyOnScreen = reused && !this.stack.busy && this.stack.top?.el === view.el;
    let direction = this.config.resolve({
      from: from?.routeRef ?? null,
      to: view.routeRef,
      trigger: nav?.trigger ?? 'imperative',
      historyDelta: nav?.historyDelta,
      hint: nav?.hint,
      stack: this.views.map((v) => v.key),
    });
    // After a swipe the page beneath is already showing and the one that left
    // is gone. A pop onto anything else has nothing to pop; just show the page.
    if (!leaving && this.stack.top && direction === 'pop' && !reused) direction = 'replace';
    const animated = this.config.animated && (nav?.animated ?? true) && (this.views.length > 0 || !!leaving);

    view.route = activatedRoute;
    view.proxy?.swap(activatedRoute);
    const current = this.router.getCurrentNavigation();
    view.url = current ? this.router.serializeUrl(current.finalUrl ?? current.extractedUrl) : this.router.url;
    if (view.savedContexts) {
      this.parentContexts.getOrCreateContext(this.name).children.onOutletReAttached(view.savedContexts);
      view.savedContexts = null;
    }

    this.activated = view.ref;
    this._activatedRoute = activatedRoute;
    this.activeView = view;
    this.lastDirection = direction;
    this.place(view, direction, leaving);
    if (!alreadyOnScreen) {
      void this.stack.present(view.el, direction, { key: view.key, animated, source: sourceOf(nav?.trigger) });
    }
    this.changeDetector.markForCheck();
    this.bindInputs(view);
    // An animated page renders during its first frames off screen. One that
    // appears at once (no animation, or a replace, which the stack never
    // animates) would otherwise be blank until the next scheduled tick.
    if ((!animated || direction === 'replace') && !alreadyOnScreen) view.ref.changeDetectorRef.detectChanges();
    (reused ? this.attachEvents : this.activateEvents).emit(view.ref.instance);
    this.navigatedEvents.emit({ view, direction, animated, reused });
  }

  /** Mirror what the stack will do, synchronously, so `pages` and the next direction are right. */
  private place(view: View, direction: Direction, leaving: View | null): void {
    const views = this.views;
    const drop = (v: View | null) => {
      const i = v ? views.indexOf(v) : -1;
      if (i >= 0) views.splice(i, 1);
    };
    if (direction === 'pop' && views.includes(view)) {
      views.splice(views.indexOf(view) + 1);
      return;
    }
    if (direction !== 'push') drop(leaving);
    drop(view);
    views.push(view);
  }

  private createView(component: Type<unknown>, route: ActivatedRoute, environmentInjector: EnvironmentInjector, key: string): View {
    const childContexts = this.parentContexts.getOrCreateContext(this.name).children;
    const proxy = new StackNavActivatedRoute(route);
    const injector = Injector.create({
      providers: [
        { provide: ActivatedRoute, useValue: proxy },
        { provide: ChildrenOutletContexts, useValue: childContexts },
        { provide: ROUTER_OUTLET_DATA, useValue: this.routerOutletData },
      ],
      parent: this.location.injector,
    });
    const ref = this.location.createComponent(component, { index: this.location.length, injector, environmentInjector });
    const view = this.wrap(ref, route, key, proxy);
    this.park(view.el);
    this.byEl.set(view.el, view);
    return view;
  }

  private wrap(ref: ComponentRef<unknown>, route: ActivatedRoute, key: string, proxy: StackNavActivatedRoute | null): View {
    const el = ref.location.nativeElement as HTMLElement;
    return { ref, el, key, routeRef: this.routeRefOf(route.snapshot, key), url: '', route, proxy, savedContexts: null, pendingRemoval: false, inputs: null };
  }

  /** Hidden inside the container until the stack shows it; never a visible sibling of the outlet. */
  private park(el: HTMLElement): void {
    el.classList.add(this.stack.pageClass);
    if (el.parentElement !== this.host) this.host.append(el);
  }

  private routeRefOf(snapshot: ActivatedRouteSnapshot, key: string): StackNavRouteRef {
    return { key, segments: segmentsOf(key), level: this.config.levelOf(snapshot), data: snapshot.data, snapshot };
  }

  private onStackRemoved(removed: StackEntry[], source: NavigationSource): void {
    for (const entry of removed) {
      const view = this.byEl.get(entry.el);
      if (!view) continue;
      if (source === 'gesture') {
        view.pendingRemoval = true;
        this.views = this.views.filter((v) => v !== view);
        this.navigateBackAfterGesture();
      } else {
        this.destroyView(view);
      }
    }
  }

  /** The swipe already revealed the page beneath; now make the router agree. */
  private navigateBackAfterGesture(): void {
    const lower = this.views[this.views.length - 1];
    if (!lower) return;
    const previous = this.history.previousUrl;
    if (previous != null && this.sameUrl(previous, lower.url)) {
      this.browserLocation.back();
    } else {
      void this.router.navigateByUrl(lower.url, { info: { [this.config.infoKey]: { direction: 'pop', animated: false } } });
    }
  }

  private sameUrl(a: string, b: string): boolean {
    const norm = (u: string) => this.router.serializeUrl(this.router.parseUrl(u));
    return norm(a) === norm(b);
  }

  /** The router refused the navigation the swipe asked for: put the page back. */
  private restorePending(): void {
    for (const view of this.byEl.values()) {
      if (!view.pendingRemoval) continue;
      view.pendingRemoval = false;
      this.views.push(view);
      void this.stack.push(view.el, { animated: false, key: view.key, source: 'restore' });
    }
  }

  private destroyView(view: View): void {
    this.byEl.delete(view.el);
    this.views = this.views.filter((v) => v !== view);
    this.unbindInputs(view);
    if (this.activeView === view) {
      this.activeView = null;
      this.activated = null;
      this._activatedRoute = null;
    }
    const instance = view.ref.instance;
    view.ref.destroy();
    this.deactivateEvents.emit(instance);
  }

  private bindInputs(view: View): void {
    if (!this.router.componentInputBindingEnabled) return;
    const mirror = reflectComponentType(view.ref.componentType);
    if (!mirror) return;
    const route = view.route;
    view.inputs = combineLatest([route.queryParams, route.params, route.data])
      .pipe(switchMap(([queryParams, params, data], i) => (i === 0 ? of({ ...queryParams, ...params, ...data }) : from(Promise.resolve({ ...queryParams, ...params, ...data })))))
      .subscribe((data) => {
        if (this.activeView !== view) return;
        for (const { templateName } of mirror.inputs) view.ref.setInput(templateName, data[templateName]);
      });
  }
  private unbindInputs(view: View): void {
    view.inputs?.unsubscribe();
    view.inputs = null;
  }

  private syncChangeDetection(): void {
    const top = this.stack.top?.el;
    for (const view of this.byEl.values()) {
      if (view.el === top || view.pendingRemoval) view.ref.changeDetectorRef.reattach();
      else view.ref.changeDetectorRef.detach();
    }
  }
}

function sourceOf(trigger: 'imperative' | 'history' | undefined): NavigationSource {
  return trigger === 'history' ? 'history' : 'api';
}
