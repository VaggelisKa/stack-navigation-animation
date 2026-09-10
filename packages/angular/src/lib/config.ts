import { InjectionToken, type EnvironmentProviders, type Provider, makeEnvironmentProviders } from '@angular/core';
import { RouteReuseStrategy, type ActivatedRouteSnapshot } from '@angular/router';
import {
  createDirectionResolver,
  defaultStrategies,
  type Direction,
  type DirectionResolver,
  type DirectionStrategy,
  type EdgePanGestureOptions,
  type IOSTransitionOptions,
} from '@stacknav/core';
import { StackNavRouteReuseStrategy } from './route-reuse-strategy';

/** Everything `provideStackNav()` accepts. All optional. */
export interface StackNavConfig {
  /**
   * How to decide push / pop / replace for a navigation, in the order you
   * trust them. Defaults to the core's `defaultStrategies()`: an explicit
   * hint, then browser history, then the kept stack, then route numbering
   * (`data.stackLevel`), then the route tree. Pass a resolver function to
   * take over completely.
   */
  direction?: readonly DirectionStrategy[] | DirectionResolver;
  /** What to do when no strategy has an opinion. Default `push`. */
  fallbackDirection?: Direction;
  /**
   * Where a route's number comes from, for the numbering strategy.
   * Default: `snapshot.data['stackLevel']`.
   */
  levelOf?: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  /**
   * What identifies a page, so a later navigation to the same key pops back
   * to the kept page. Default: the route's full URL path (with matrix params).
   */
  keyOf?: (snapshot: ActivatedRouteSnapshot) => string;
  /** `history.state` key carrying a per-navigation hint. Default `stacknav`. */
  stateKey?: string;
  /** Defaults for every outlet's transition; an outlet's `transition` input overrides per key. */
  transition?: Partial<IOSTransitionOptions>;
  /** Defaults for every outlet's swipe-back gesture; `false` disables it. */
  gesture?: Partial<EdgePanGestureOptions> | false;
  /**
   * Set component inputs from route params, query params and data, like
   * `withComponentInputBinding()`. Off by default, like the router.
   */
  bindToComponentInputs?: boolean;
  /**
   * Detach change detection from pages hidden beneath the top and reattach
   * when they show again. Saves work on deep stacks. Off by default.
   */
  detachInactiveViews?: boolean;
  /** Insert the engine's stylesheet at runtime. Default true; turn off if you import `stacknav.css`. */
  injectStyles?: boolean;
  /**
   * Provide a `RouteReuseStrategy` that treats `/items/1` → `/items/2` as a
   * new page (so it gets a transition) instead of reusing the component.
   * Default true.
   */
  reuseStrategy?: boolean;
  /** Animate at all. Default true. `prefers-reduced-motion` is honoured regardless. */
  animated?: boolean;
}

export interface ResolvedStackNavConfig {
  resolve: DirectionResolver;
  levelOf: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  keyOf: (snapshot: ActivatedRouteSnapshot) => string;
  stateKey: string;
  transition: Partial<IOSTransitionOptions>;
  gesture: Partial<EdgePanGestureOptions> | false;
  bindToComponentInputs: boolean;
  detachInactiveViews: boolean;
  injectStyles: boolean;
  animated: boolean;
}

export const STACKNAV_CONFIG = new InjectionToken<ResolvedStackNavConfig>('STACKNAV_CONFIG', {
  providedIn: 'root',
  factory: () => resolveConfig({}),
});

export function defaultLevelOf(snapshot: ActivatedRouteSnapshot): number | null | undefined {
  const v = snapshot.data?.['stackLevel'];
  return typeof v === 'number' ? v : undefined;
}

/** The route's URL path from the root down to (and including) this route, e.g. `items/42;view=full`. */
export function defaultKeyOf(snapshot: ActivatedRouteSnapshot): string {
  return snapshot.pathFromRoot
    .flatMap((s) => s.url.map((u) => u.toString()))
    .join('/');
}

export function resolveConfig(c: StackNavConfig): ResolvedStackNavConfig {
  const resolve =
    typeof c.direction === 'function'
      ? c.direction
      : createDirectionResolver(c.direction ?? defaultStrategies(), c.fallbackDirection ?? 'push');
  return {
    resolve,
    levelOf: c.levelOf ?? defaultLevelOf,
    keyOf: c.keyOf ?? defaultKeyOf,
    stateKey: c.stateKey ?? 'stacknav',
    transition: c.transition ?? {},
    gesture: c.gesture ?? {},
    bindToComponentInputs: c.bindToComponentInputs ?? false,
    detachInactiveViews: c.detachInactiveViews ?? false,
    injectStyles: c.injectStyles ?? true,
    animated: c.animated ?? true,
  };
}

/**
 * Configures stacknav for the application. Add it next to `provideRouter()`.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideRouter(routes), provideStackNav()] });
 * ```
 */
export function provideStackNav(config: StackNavConfig = {}): EnvironmentProviders {
  const providers: Provider[] = [{ provide: STACKNAV_CONFIG, useValue: resolveConfig(config) }];
  if (config.reuseStrategy ?? true) providers.push({ provide: RouteReuseStrategy, useClass: StackNavRouteReuseStrategy });
  return makeEnvironmentProviders(providers);
}
