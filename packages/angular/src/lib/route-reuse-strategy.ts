import { Injectable } from '@angular/core';
import {
  BaseRouteReuseStrategy,
  destroyDetachedRouteHandle,
  type ActivatedRouteSnapshot,
  type DetachedRouteHandle,
} from '@angular/router';

/**
 * What a stack tells the strategy about the pages it keeps. `StackNav`
 * implements it; the strategy never holds a page itself.
 * @internal
 */
export interface PageKeeper {
  /** The stack's outlet is showing this route right now. */
  showing(snapshot: ActivatedRouteSnapshot): boolean;
  /** The router detached a page; take its handle if the page is yours. */
  keep(snapshot: ActivatedRouteSnapshot, handle: DetachedRouteHandle): boolean;
  /** A page for this route is kept and can be re-attached. */
  has(snapshot: ActivatedRouteSnapshot): boolean;
  retrieve(snapshot: ActivatedRouteSnapshot): DetachedRouteHandle | null;
  /** The router is re-attaching the page for this route. */
  release(snapshot: ActivatedRouteSnapshot): boolean;
  /** Every handle still held. */
  handles(): DetachedRouteHandle[];
}

/**
 * The `RouteReuseStrategy` behind `stackNav`. It does two things a navigation
 * stack needs from the router.
 *
 * It keeps pages alive. When the router leaves a route a stack is showing, it
 * detaches the page instead of destroying it, and re-attaches that page when
 * the route is reached again. This is the router's own mechanism, so the
 * page's `ActivatedRoute` observables, nested outlets and bound inputs all
 * come back as the router left them. The stack decides when a kept page is
 * dropped for good (after a pop, or a replace) and destroys it then.
 *
 * It makes sibling routes separate pages. The router's default strategy
 * reuses a component when only the params change (`/items/1` → `/items/2`),
 * so no outlet activation happens and no transition can run. This strategy
 * asks for a fresh page whenever the URL of the matched route differs. Routes
 * opt out of that with `data: { reuseRoute: true }`.
 *
 * `provideStackNav()` installs it. An app that provides a strategy of its own
 * must extend this one, or `stackNav` has nothing to animate out. A subclass
 * that keeps handles of its own must not pass them to `super.store()`, which
 * destroys any handle no stack claims.
 */
@Injectable()
export class StackNavRouteReuseStrategy extends BaseRouteReuseStrategy {
  private readonly stacks = new Set<PageKeeper>();

  /** @internal */
  register(stack: PageKeeper): () => void {
    this.stacks.add(stack);
    return () => {
      this.stacks.delete(stack);
    };
  }

  override shouldDetach(route: ActivatedRouteSnapshot): boolean {
    for (const stack of this.stacks) if (stack.showing(route)) return true;
    return false;
  }

  override store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (handle) {
      for (const stack of this.stacks) if (stack.keep(route, handle)) return;
      // Nobody claimed it, so nobody would ever destroy it.
      destroyDetachedRouteHandle(handle);
    } else {
      for (const stack of this.stacks) if (stack.release(route)) return;
    }
  }

  override shouldAttach(route: ActivatedRouteSnapshot): boolean {
    if (!route.component) return false;
    for (const stack of this.stacks) if (stack.has(route)) return true;
    return false;
  }

  override retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    if (!route.component) return null;
    for (const stack of this.stacks) {
      const handle = stack.retrieve(route);
      if (handle) return handle;
    }
    return null;
  }

  /**
   * The router's experimental injector cleanup
   * (`withExperimentalAutoCleanupInjectors`) asks for these so that the lazy
   * injectors behind kept pages are not destroyed under them. The router
   * calls it optionally and `BaseRouteReuseStrategy` does not declare it, so
   * it is not an override.
   */
  retrieveStoredRouteHandles(): DetachedRouteHandle[] {
    const handles: DetachedRouteHandle[] = [];
    for (const stack of this.stacks) handles.push(...stack.handles());
    return handles;
  }

  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) return false;
    if (future.data?.['reuseRoute'] === true) return true;
    return urlOf(future) === urlOf(curr);
  }
}

function urlOf(s: ActivatedRouteSnapshot): string {
  return s.url.map((u) => u.toString()).join('/');
}
