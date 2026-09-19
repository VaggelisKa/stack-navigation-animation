import {
  InjectionToken,
  type EnvironmentProviders,
  type Provider,
  makeEnvironmentProviders,
} from '@angular/core';
import { RouteReuseStrategy, type ActivatedRouteSnapshot } from '@angular/router';
import {
  createDirectionResolver,
  defaultStrategies,
  isTouchPrimary,
  type Direction,
  type DirectionResolver,
  type DirectionStrategy,
  type NativeTransitionOptions,
  type NavigationTrigger,
  type RouteRef,
  type ScrollMode,
  type ScrollRestorationMode,
  type SwipeBackMode,
} from '@stacknav/core';
import { StackNavRouteReuseStrategy } from './route-reuse-strategy';

/**
 * What the `animated` predicate is told about the navigation it is asked
 * about. Kept to what the stack knows for certain before it decides, so the
 * answer can depend on the navigation rather than only on the device: a
 * back-button pop and a push to the same page are different questions.
 */
export interface StackNavAnimationContext {
  /** `imperative`: the app navigated. `history`: the browser's back or forward. */
  trigger: NavigationTrigger;
  /** the page being left, null when the stack is empty */
  from: RouteRef | null;
  /** the page arriving */
  to: RouteRef;
}

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
  /**
   * Installs `StackNavRouteReuseStrategy`, which is how the router keeps a
   * page alive beneath the top one instead of destroying it, and how a
   * navigation that only changes params -- `/items/1` to `/items/2` -- becomes
   * a page of its own rather than the same component with new inputs. Default
   * true. Routes opt out of the second part with `data: { reuseRoute: true }`.
   *
   * Turn it off only to provide a strategy of your own that extends it, after
   * `provideStackNav()`; without the strategy `stackNav` has nothing to keep or
   * animate out.
   */
  routeReuse?: boolean;
  /** Defaults for every stack's transition. A stack's `stackNavTransition` input overrides these per key. */
  transition?: Partial<NativeTransitionOptions>;
  /** Default browser. `disabled` requests document-wide browser gesture suppression where supported. */
  swipeBack?: SwipeBackMode;
  /** Inserts the engine's stylesheet at runtime. Default true. Turn it off if you import `stacknav.css`. */
  injectStyles?: boolean;
  /**
   * Moves focus with the pages, the way a native stack does: into the page
   * arriving on top, and back to whatever had focus inside a page when that
   * page is revealed again. Default false, because a page that manages its own
   * focus should keep doing so.
   */
  manageFocus?: boolean;
  /**
   * Whether to animate at all. Default true. `prefers-reduced-motion` is
   * honoured either way.
   *
   * `'touch'` animates only where the primary pointer is coarse — a phone or a
   * tablet — and navigates instantly on a desktop, which is the usual reason to
   * ask. A function is asked again before every navigation, so it can decide on
   * whatever the app knows: a user setting, the window's width, a route. It is
   * handed that navigation's `{ trigger, from, to }`; a function that takes no
   * arguments, which is all this option used to accept, still works.
   *
   * ```ts
   * provideStackNav({ animated: 'touch' });
   * provideStackNav({ animated: () => settings.pageTransitions() });
   * provideStackNav({ animated: ({ to }) => !to.data?.['instant'] });
   * ```
   *
   * This is asked last, and only narrows: it cannot animate a navigation an
   * explicit `info: { stacknav: { animated: false } }` hint has already ruled
   * out. Knowing the trigger is what lets an app turn off the transitions the
   * browser is already drawing for itself -- iOS Safari animates a snapshot of
   * the previous page during its edge swipe, and a pop on top of that plays
   * twice:
   *
   * ```ts
   * import { isIOSBrowser } from '@stacknav/core';
   * provideStackNav({ animated: ({ trigger }) => !(trigger === 'history' && isIOSBrowser()) });
   * ```
   *
   * That is a decision only the app can make, because `popstate` does not say
   * what moved history: the swipe, the toolbar button and the app's own
   * `location.back()` all arrive the same way, and only the first of them has
   * anything animating underneath it.
   */
  animated?: boolean | 'touch' | ((ctx: StackNavAnimationContext) => boolean);
  /**
   * Who scrolls the pages. Default `'page'`: each page is a scroll container
   * of its own inside the outlet's parent, which needs a height.
   *
   * `'document'` is for an app embedded in a shell whose header follows
   * `window.scrollY` -- a collapsing large title that lives outside the app.
   * The page on top then sits in the normal flow and the document scrolls it,
   * so the outlet's parent needs no height and the shell's scroll listeners
   * see the page. The stack records each page's document offset and switches
   * to the destination's *before* a transition starts, so the shell shows the
   * destination's header state throughout the slide rather than catching up
   * after it. Pages kept beneath add nothing to the document's height.
   *
   * `history.scrollRestoration` is left to whoever the app gave it to: the
   * browser, or the router under `withInMemoryScrolling()`, which takes it to
   * `manual` itself. See `scrollRestoration`. One document-scrolling stack
   * per document.
   */
  scroll?: ScrollMode;
  /**
   * Only read in `scroll: 'document'`. The stack always records each page's
   * document offset and puts it back itself -- a page returning from a refused
   * pop or a released swipe has no history entry to be restored from. This is
   * about `history.scrollRestoration` alone, the one switch the whole document
   * shares.
   *
   * Default `'browser'`: untouched, so `withInMemoryScrolling()` or the
   * browser keeps doing what the app asked of it. `'manual'` takes it, for an
   * engine that restores a same-document entry before the app hears the pop --
   * neither Chromium nor WebKit does, measured behind a route that resolves
   * ten painted frames late.
   */
  scrollRestoration?: ScrollRestorationMode;
}

export interface ResolvedStackNavConfig {
  resolve: DirectionResolver;
  levelOf: (snapshot: ActivatedRouteSnapshot) => number | null | undefined;
  keyOf: (snapshot: ActivatedRouteSnapshot) => string;
  infoKey: string;
  transition: Partial<NativeTransitionOptions>;
  swipeBack: SwipeBackMode;
  injectStyles: boolean;
  manageFocus: boolean;
  /** Asked before every navigation, with that navigation's context. */
  animated: (ctx: StackNavAnimationContext) => boolean;
  scroll: ScrollMode;
  scrollRestoration: ScrollRestorationMode;
}

export const STACKNAV_CONFIG = /*#__PURE__*/ new InjectionToken<ResolvedStackNavConfig>(
  'STACKNAV_CONFIG',
  {
    providedIn: 'root',
    factory: () => resolveConfig({}),
  },
);

export function defaultLevelOf(snapshot: ActivatedRouteSnapshot): number | null | undefined {
  const v = snapshot.data?.['stackLevel'];
  return typeof v === 'number' ? v : undefined;
}

/** The route's URL path from the root down to and including this route, e.g. `items/42;view=full`. */
export function defaultKeyOf(snapshot: ActivatedRouteSnapshot): string {
  return snapshot.pathFromRoot.flatMap((s) => s.url.map((u) => u.toString())).join('/');
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
      createDirectionResolver(
        defaultStrategies({ direction: c.direction, siblings: c.siblings }),
        c.fallbackDirection ?? 'push',
      ),
    levelOf: c.levelOf ?? defaultLevelOf,
    keyOf: c.keyOf ?? defaultKeyOf,
    infoKey: c.infoKey ?? 'stacknav',
    transition: c.transition ?? {},
    swipeBack: c.swipeBack ?? 'browser',
    injectStyles: c.injectStyles ?? true,
    manageFocus: c.manageFocus ?? false,
    animated: resolveAnimated(c.animated),
    scroll: c.scroll ?? 'page',
    scrollRestoration: c.scrollRestoration ?? 'browser',
  };
}

function resolveAnimated(
  animated: StackNavConfig['animated'],
): (ctx: StackNavAnimationContext) => boolean {
  // A predicate written before this option took a context is a zero-argument
  // function, which ignores the one it is now passed: both shapes call the same.
  if (typeof animated === 'function') return animated;
  if (animated === 'touch') return isTouchPrimary;
  const on = animated ?? true;
  return () => on;
}

/**
 * Configures every `stackNav` outlet. Add it next to `provideRouter()`, with no options
 * for the usual app. It changes no router configuration; the one provider it
 * adds besides its own is `RouteReuseStrategy`, which is how pages stay alive
 * beneath the top one and how sibling routes become separate pages (see
 * `routeReuse`).
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideRouter(routes), provideStackNav()] });
 * ```
 */
export function provideStackNav(config: StackNavConfig = {}): EnvironmentProviders {
  const providers: Provider[] = [{ provide: STACKNAV_CONFIG, useValue: resolveConfig(config) }];
  // The router's own strategy destroys a page the moment its route is left,
  // and reuses the component when only params change, so nothing would ever
  // animate out. An app that provides a strategy after this one still wins.
  if (config.routeReuse !== false)
    providers.push({ provide: RouteReuseStrategy, useClass: StackNavRouteReuseStrategy });
  return makeEnvironmentProviders(providers);
}
