import { Injectable } from '@angular/core';
import { BaseRouteReuseStrategy, type ActivatedRouteSnapshot } from '@angular/router';

/**
 * The router's default strategy reuses a component when only the params change
 * (`/items/1` → `/items/2`), so no outlet activation happens and no transition
 * can run. This strategy asks for a fresh page whenever the URL of the matched
 * route differs, which is what a navigation stack expects. Routes opt out with
 * `data: { reuseRoute: true }`.
 *
 * It is not installed automatically. Provide it like any other strategy to get
 * this behaviour:
 *
 * ```ts
 * { provide: RouteReuseStrategy, useClass: StackNavRouteReuseStrategy }
 * ```
 */
@Injectable()
export class StackNavRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) return false;
    if (future.data?.['reuseRoute'] === true) return true;
    return urlOf(future) === urlOf(curr);
  }
}

function urlOf(s: ActivatedRouteSnapshot): string {
  return s.url.map((u) => u.toString()).join('/');
}
