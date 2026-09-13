import { InjectionToken, type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { ActivatedRouteSnapshot } from '@angular/router';
import {
  createDirectionResolver,
  defaultStrategies,
  isTouchPrimary,
  type Direction,
  type DirectionResolver,
  type DirectionStrategy,
  type NativeTransitionOptions,
  type SwipeBackMode,
} from '@stacknav/core';

/** Everything `provideStackNav()` accepts. All optional. */
export interface StackNavConfig {
  /**
   * One rule of your own for deciding push / pop / replace, asked before the
   * library guesses from route numbers or the route tree. Return nothing --
   * `undefined`, or `'auto'` -- to let it guess after all.
   *
   * It is asked *after* the three things the library is sure about, which
   * always win: an explicit hint on the navigation, the browser's back and
   * forward buttons, and a page still kept alive beneath this one. To outrank
   * those as well, replace the mechanism with `resolveDirection`.
   *
   * ```ts
   * provideStackNav({ direction: ({ to }) => (to.data?.['tab'] ? 'replace' : undefined) });
   * ```
   */
  direction?: DirectionStrategy;
  /**
   * What a tie means: two pages carrying the same `stackLevel`, or sitting at
   * the same depth in the route tree, like `/items/1` and `/items/2`. Default
   * `replace`.
   */
  siblings?: Direction;
  /**
   * Replaces direction resolution entirely, ignoring `direction` and
   * `siblings`. For the rare app that needs to outrank even an explicit hint.
   * Compose one from the strategies `@stacknav/core` exports:
   *
   * ```ts
   * import { createDirectionResolver, byHint, byRouteTree } from '@stacknav/core';
   * provideStackNav({ resolveDirection: createDirectionResolver([byHint(), byRouteTree()], 'push') });
   * ```
   */
  resolveDirection?: DirectionResolver;
  /** The direction to use when no strategy has an answer. Default `push`. */
  fallbackDirection?: Direction;
  /**
   * Where a route's number comes from, for the numbering strategy.
   * Default: `snapshot.data['stackLevel']`.
   */
  levelOf?: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  /**
   * What identifies a page, so that a later navigation to the same key pops
   * back to the kept page. Default: the route's full URL path, including matrix
   * params.
   */
  keyOf?: (snapshot: ActivatedRouteSnapshot) => string;
  /**
   * The key under which a navigation's `info` carries a hint for this library:
   * `router.navigate(cmds, { info: { stacknav: 'pop' } })`. Default `stacknav`.
   */
  infoKey?: string;
  /** Defaults for every outlet's transition. An outlet's `transition` input overrides these per key. */
  transition?: Partial<NativeTransitionOptions>;
  /** Default browser. `disabled` requests document-wide browser gesture suppression where supported. */
  swipeBack?: SwipeBackMode;
  /**
   * Detaches change detection from pages hidden beneath the top and reattaches
   * it when they are shown again. Saves work on deep stacks. Off by default.
   */
  detachInactiveViews?: boolean;
  /** Inserts the engine's stylesheet at runtime. Default true. Turn it off if you import `stacknav.css`. */
  injectStyles?: boolean;
  /**
   * Whether to animate at all. Default true. `prefers-reduced-motion` is
   * honoured either way.
   *
   * `'touch'` animates only where the primary pointer is coarse — a phone or a
   * tablet — and navigates instantly on a desktop, which is the usual reason to
   * ask. A function is asked again before every navigation, so it can decide on
   * whatever the app knows: a user setting, the window's width, a route.
   *
   * ```ts
   * provideStackNav({ animated: 'touch' });
   * provideStackNav({ animated: () => settings.pageTransitions() });
   * ```
   */
  animated?: boolean | 'touch' | (() => boolean);
}

export interface ResolvedStackNavConfig {
  resolve: DirectionResolver;
  levelOf: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  keyOf: (snapshot: ActivatedRouteSnapshot) => string;
  infoKey: string;
  transition: Partial<NativeTransitionOptions>;
  swipeBack: SwipeBackMode;
  detachInactiveViews: boolean;
  injectStyles: boolean;
  /** Asked before every navigation. */
  animated: () => boolean;
}

export const STACKNAV_CONFIG = /*#__PURE__*/ new InjectionToken<ResolvedStackNavConfig>('STACKNAV_CONFIG', {
  providedIn: 'root',
  factory: () => resolveConfig({}),
});

export function defaultLevelOf(snapshot: ActivatedRouteSnapshot): number | null | undefined {
  const v = snapshot.data?.['stackLevel'];
  return typeof v === 'number' ? v : undefined;
}

/** The route's URL path from the root down to and including this route, e.g. `items/42;view=full`. */
export function defaultKeyOf(snapshot: ActivatedRouteSnapshot): string {
  return snapshot.pathFromRoot
    .flatMap((s) => s.url.map((u) => u.toString()))
    .join('/');
}

export function resolveConfig(c: StackNavConfig): ResolvedStackNavConfig {
  // `direction` used to take the whole mechanism. Both of those now have their
  // own spellings, and silently demoting one to a rule asked fourth would
  // change an app's behaviour without a word.
  if (Array.isArray(c.direction) || (c.direction && 'strategies' in c.direction)) {
    throw new TypeError(
      'provideStackNav({ direction }) is one rule of your own, asked before the route number and route tree guesses. ' +
        'It no longer takes a list of strategies or a whole resolver: pass those as `resolveDirection`, ' +
        'and use `siblings` to change what a tie means.',
    );
  }
  return {
    resolve:
      c.resolveDirection ??
      createDirectionResolver(defaultStrategies({ direction: c.direction, siblings: c.siblings }), c.fallbackDirection ?? 'push'),
    levelOf: c.levelOf ?? defaultLevelOf,
    keyOf: c.keyOf ?? defaultKeyOf,
    infoKey: c.infoKey ?? 'stacknav',
    transition: c.transition ?? {},
    swipeBack: c.swipeBack ?? 'browser',
    detachInactiveViews: c.detachInactiveViews ?? false,
    injectStyles: c.injectStyles ?? true,
    animated: resolveAnimated(c.animated),
  };
}

function resolveAnimated(animated: StackNavConfig['animated']): () => boolean {
  if (typeof animated === 'function') return animated;
  if (animated === 'touch') return isTouchPrimary;
  const on = animated ?? true;
  return () => on;
}

/**
 * Configures the outlets. Add it next to `provideRouter()`. It changes no
 * router configuration.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideRouter(routes), provideStackNav()] });
 * ```
 */
export function provideStackNav(config: StackNavConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: STACKNAV_CONFIG, useValue: resolveConfig(config) }]);
}
