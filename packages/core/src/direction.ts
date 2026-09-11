/**
 * Direction resolution: given where the app is and where it is going, decide
 * whether the new page should push over the current one, pop back to it, or
 * replace it. The engine does not decide this on its own. A host supplies an
 * ordered list of strategies, and the first one with an answer wins.
 *
 * Strategies are plain functions, so a host can add its own (a numbering
 * scheme, a route-tree walk, a per-navigation hint) without changing the rest.
 */

export type Direction = 'push' | 'pop' | 'replace';

/** What a strategy may return: a direction, or no answer (`'auto'`, `undefined`, `null`). */
export type DirectionOpinion = Direction | 'auto' | undefined | null | void;

/** The minimum a strategy needs to know about a page. Hosts may attach more. */
export interface RouteRef {
  /** stable identity of the page: its URL, a route id, anything unique */
  key: string;
  /** the page's position in the route tree, e.g. URL segments (`['items', '42']`) */
  segments?: readonly string[];
  /** an explicit number when the app numbers its screens: bigger is deeper */
  level?: number | null;
  /** anything the host wants strategies to see (route data, params) */
  data?: Record<string, unknown>;
}

export type NavigationTrigger = 'imperative' | 'history';

export interface NavigationContext {
  /** the page on screen, or null when the stack is empty */
  from: RouteRef | null;
  to: RouteRef;
  /** `imperative`: the app navigated. `history`: the browser's back/forward. */
  trigger?: NavigationTrigger;
  /** for history triggers, when known: negative = back, positive = forward */
  historyDelta?: number;
  /** an explicit direction from the caller, if any */
  hint?: DirectionOpinion;
  /** keys of the pages currently kept alive, bottom to top */
  stack?: readonly string[];
}

export type DirectionStrategy = (ctx: NavigationContext) => DirectionOpinion;

export interface DirectionResolver {
  (ctx: NavigationContext): Direction;
  readonly strategies: readonly DirectionStrategy[];
  readonly fallback: Direction;
}

const isDirection = (v: DirectionOpinion): v is Direction => v === 'push' || v === 'pop' || v === 'replace';

/** Calls each strategy in turn. The first direction returned wins, else `fallback`. */
export function resolveDirection(strategies: readonly DirectionStrategy[], ctx: NavigationContext, fallback: Direction = 'push'): Direction {
  for (const s of strategies) {
    const d = s(ctx);
    if (isDirection(d)) return d;
  }
  return fallback;
}

/** Bundles strategies and a fallback into a single resolver function. */
export function createDirectionResolver(strategies: readonly DirectionStrategy[] = defaultStrategies(), fallback: Direction = 'push'): DirectionResolver {
  const resolver = ((ctx: NavigationContext) => resolveDirection(strategies, ctx, fallback)) as DirectionResolver;
  Object.defineProperty(resolver, 'strategies', { value: strategies.slice(), enumerable: true });
  Object.defineProperty(resolver, 'fallback', { value: fallback, enumerable: true });
  return resolver;
}

// ------------------------------------------------------------------ strategies

/** Honors an explicit per-navigation hint, e.g. `{ state: { stacknav: 'pop' } }` in a router. */
export const fromHint = (): DirectionStrategy => (ctx) => ctx.hint;

/** Browser back is a pop, browser forward is a push. No answer for imperative navigations. */
export const fromHistory = (): DirectionStrategy => (ctx) => {
  if (ctx.trigger !== 'history' || !ctx.historyDelta) return undefined;
  return ctx.historyDelta < 0 ? 'pop' : 'push';
};

/** Navigating to a page still kept beneath the current one is a pop back to it. */
export const fromStack = (): DirectionStrategy => (ctx) => {
  const stack = ctx.stack;
  if (!stack || stack.length < 2) return undefined;
  const i = stack.lastIndexOf(ctx.to.key);
  if (i < 0 || i === stack.length - 1) return undefined;
  return 'pop';
};

export interface LevelOptions {
  /** the direction when both pages carry the same number (default `replace`) */
  sameLevel?: DirectionOpinion;
}

/**
 * For apps that number their screens (`level: 1`, `level: 2`, …): a higher
 * number pushes, a lower one pops. No answer unless both pages carry a number.
 */
export const fromLevel = ({ sameLevel = 'replace' }: LevelOptions = {}): DirectionStrategy => (ctx) => {
  const a = ctx.from?.level;
  const b = ctx.to.level;
  if (typeof a !== 'number' || typeof b !== 'number') return undefined;
  if (b > a) return 'push';
  if (b < a) return 'pop';
  return sameLevel;
};

export interface TreeOptions {
  /** the direction for two unrelated pages at the same depth, e.g. siblings (default `replace`) */
  sameDepth?: DirectionOpinion;
}

/**
 * Reads the route tree: a descendant of the current page pushes, an ancestor
 * pops. Otherwise a deeper page pushes and a shallower one pops. Requires
 * `segments` on both pages.
 */
export const fromTree = ({ sameDepth = 'replace' }: TreeOptions = {}): DirectionStrategy => (ctx) => {
  const a = ctx.from?.segments;
  const b = ctx.to.segments;
  if (!a || !b) return undefined;
  if (isPrefix(a, b)) return b.length > a.length ? 'push' : sameDepth;
  if (isPrefix(b, a)) return 'pop';
  if (b.length > a.length) return 'push';
  if (b.length < a.length) return 'pop';
  return sameDepth;
};

/** Always returns the same direction. Useful as the last entry in a list. */
export const always = (direction: Direction): DirectionStrategy => () => direction;

/** The default order: an explicit hint, then browser history, then the kept stack, then numbering, then the tree. */
export const defaultStrategies = (): DirectionStrategy[] => [fromHint(), fromHistory(), fromStack(), fromLevel(), fromTree()];

function isPrefix(prefix: readonly string[], of: readonly string[]): boolean {
  if (prefix.length > of.length) return false;
  for (let i = 0; i < prefix.length; i++) if (prefix[i] !== of[i]) return false;
  return true;
}

/** Split a URL path into segments, ignoring the query, fragment and empty parts. */
export function segmentsOf(url: string): string[] {
  const path = url.split(/[?#]/, 1)[0];
  return path.split('/').filter(Boolean);
}
