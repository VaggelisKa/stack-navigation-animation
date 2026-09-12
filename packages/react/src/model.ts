import type { Direction, DirectionOpinion, DirectionResolver, NavigationTrigger, RouteRef } from '@stacknav/core';
import type { ReactNode } from 'react';

/**
 * What the app knows about how it arrived at the current page. Every field is
 * optional; a router adapter fills in what it can and the direction strategies
 * use what is there.
 */
export interface StackNavigation {
  /** `imperative`: the app navigated. `history`: the browser's back/forward. */
  trigger?: NavigationTrigger;
  /** for history triggers, when known: negative = back, positive = forward */
  historyDelta?: number;
  /** an explicit direction for this navigation */
  hint?: DirectionOpinion;
  /** `false` shows the page without animating */
  animated?: boolean;
}

/** A page the stack keeps alive. */
export interface StackPage<TRoute extends RouteRef = RouteRef> {
  /** identity, as given by `route.key` when the page was created */
  readonly key: string;
  /** the element the page renders into, owned by the stack */
  readonly el: HTMLElement;
  /** what the page was last shown as */
  route: TRoute;
}

export interface PageModel<TRoute extends RouteRef = RouteRef> extends StackPage<TRoute> {
  /** unique per page instance, so two pages with the same key never share a React key */
  readonly id: number;
  /** what to render while the page is beneath the top */
  node: ReactNode;
  /** popped by the swipe gesture, waiting for the router to catch up */
  pendingRemoval: boolean;
}

export interface Activation<TRoute extends RouteRef = RouteRef> {
  page: PageModel<TRoute>;
  direction: Direction;
  animated: boolean;
  /** the page was kept and is being shown again */
  reused: boolean;
  /** whether the core stack still has to move it: false when the swipe already left it on screen */
  present: boolean;
}

export interface StackModel<TRoute extends RouteRef = RouteRef> {
  /** the kept pages, bottom to top; the last one is (or is about to be) on screen */
  views: PageModel<TRoute>[];
  /** everything rendered: the kept pages plus those still animating out or popped by a swipe */
  mounted: PageModel<TRoute>[];
  /** the last `route.key` that was activated */
  lastKey: string | null;
  lastDirection: Direction | null;
  nextId: number;
}

export function createModel<TRoute extends RouteRef = RouteRef>(): StackModel<TRoute> {
  return { views: [], mounted: [], lastKey: null, lastDirection: null, nextId: 1 };
}

export interface ActivateOptions<TRoute extends RouteRef> {
  resolve: DirectionResolver;
  /** whether the outlet animates at all */
  animated: boolean;
  /** the node that renders the page */
  node: ReactNode;
  createElement(): HTMLElement;
  /** whether the core stack shows this element on top right now and is idle */
  isOnScreen(el: HTMLElement): boolean;
}

/**
 * Decides what to do about `route` being the page the app wants on screen:
 * resolves the direction, finds or creates the page, and mirrors what the core
 * stack will do to `views` so that `pages` and the next resolution are correct
 * before the transition has run. Returns null when `route.key` is what was
 * activated last.
 *
 * Pure apart from `createElement`, and idempotent per key: calling it twice in
 * a row with the same key does nothing the second time, which is what a
 * doubled render needs.
 */
export function activate<TRoute extends RouteRef>(model: StackModel<TRoute>, route: TRoute, navigation: StackNavigation | undefined, o: ActivateOptions<TRoute>): Activation<TRoute> | null {
  if (model.lastKey === route.key) return null;
  const views = model.views;
  const from = views[views.length - 1] ?? null;
  const waiting = pending(model);
  const leftByGesture = waiting != null;

  // A swipe already took this page off; the router either refused to leave it
  // or came straight back. Put it back where it was, without animating.
  if (waiting && waiting.key === route.key) {
    waiting.pendingRemoval = false;
    waiting.route = route;
    waiting.node = o.node;
    views.push(waiting);
    model.lastKey = route.key;
    model.lastDirection = 'push';
    return { page: waiting, direction: 'push', animated: false, reused: true, present: true };
  }

  const existing = views.find((v) => v.key === route.key) ?? null;
  let direction = o.resolve({
    from: from?.route ?? null,
    to: route,
    trigger: navigation?.trigger ?? 'imperative',
    historyDelta: navigation?.historyDelta,
    hint: navigation?.hint,
    stack: views.map((v) => v.key),
  });
  // After a swipe the page beneath is already showing and the one that left is
  // gone. A pop onto anything else has nothing to pop, so just show the page.
  if (leftByGesture && from && direction === 'pop' && !existing) direction = 'replace';
  const animated = o.animated && (navigation?.animated ?? true) && views.length > 0;

  // The page that is leaving keeps the node it was last rendered with: the
  // component refreshes the top page's node on every render, so it is current.
  const page = existing ?? createPage(model, route, o.createElement());
  page.route = route;
  page.node = o.node;
  const reused = existing != null;
  const present = !(reused && o.isOnScreen(page.el));
  place(views, page, direction, from);
  if (!existing) model.mounted.push(page);
  model.lastKey = route.key;
  model.lastDirection = direction;
  return { page, direction, animated, reused, present };
}

function createPage<TRoute extends RouteRef>(model: StackModel<TRoute>, route: TRoute, el: HTMLElement): PageModel<TRoute> {
  return { id: model.nextId++, key: route.key, el, route, node: null, pendingRemoval: false };
}

/** Mirrors what the core stack will do, synchronously. */
function place<TRoute extends RouteRef>(views: PageModel<TRoute>[], page: PageModel<TRoute>, direction: Direction, from: PageModel<TRoute> | null): void {
  const drop = (v: PageModel<TRoute> | null) => {
    const i = v ? views.indexOf(v) : -1;
    if (i >= 0) views.splice(i, 1);
  };
  if (direction === 'pop' && views.includes(page)) {
    // popping back to a kept page drops everything above it
    views.splice(views.indexOf(page) + 1);
    return;
  }
  if (direction !== 'push') drop(from);
  drop(page);
  views.push(page);
}

/**
 * The core stack dropped these elements. Pages popped by the swipe gesture are
 * kept rendered until the router catches up; everything else is unmounted.
 * Returns the pages that were unmounted.
 */
export function removed<TRoute extends RouteRef>(model: StackModel<TRoute>, els: readonly HTMLElement[], byGesture: boolean): PageModel<TRoute>[] {
  const gone: PageModel<TRoute>[] = [];
  // A new swipe supersedes any page an earlier swipe left waiting: the router never came for it.
  if (byGesture) gone.push(...dropPending(model));
  for (const el of els) {
    const page = model.mounted.find((p) => p.el === el);
    if (!page) continue;
    model.views = model.views.filter((v) => v !== page);
    if (byGesture) {
      page.pendingRemoval = true;
    } else {
      model.mounted = model.mounted.filter((p) => p !== page);
      gone.push(page);
    }
  }
  return gone;
}

/** The page a swipe popped that is still waiting for the router, if any. */
export function pending<TRoute extends RouteRef>(model: StackModel<TRoute>): PageModel<TRoute> | null {
  return model.mounted.find((p) => p.pendingRemoval) ?? null;
}

/** The page a swipe revealed: the top of the kept stack. */
export function top<TRoute extends RouteRef>(model: StackModel<TRoute>): PageModel<TRoute> | null {
  return model.views[model.views.length - 1] ?? null;
}

/** Unmounts every page popped by a swipe. Called once the router has moved on. */
export function dropPending<TRoute extends RouteRef>(model: StackModel<TRoute>): PageModel<TRoute>[] {
  const gone = model.mounted.filter((p) => p.pendingRemoval);
  if (gone.length) model.mounted = model.mounted.filter((p) => !p.pendingRemoval);
  return gone;
}

/** Puts a page a swipe popped back on top, because the router refused to leave it. */
export function restore<TRoute extends RouteRef>(model: StackModel<TRoute>, page: PageModel<TRoute>): boolean {
  if (!page.pendingRemoval || !model.mounted.includes(page)) return false;
  page.pendingRemoval = false;
  model.views.push(page);
  return true;
}
