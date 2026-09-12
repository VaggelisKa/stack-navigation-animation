import type { Direction, DirectionOpinion } from '@stacknav/core';

/**
 * What a navigation can say to the stack through the router's own navigation
 * state, under the configured key (default `stacknav`):
 *
 * ```tsx
 * navigate('/items/2', { state: { stacknav: 'push' } });
 * <Link to="/login" state={{ stacknav: { direction: 'replace', animated: false } }} />
 * ```
 */
export type StackNavHint = Direction | { direction?: DirectionOpinion; animated?: boolean };

/** Reads a hint out of an object such as `location.state`. `undefined` when there is none. */
export function readHint(state: unknown, key: string): { direction?: DirectionOpinion; animated?: boolean } | undefined {
  if (state == null || typeof state !== 'object') return undefined;
  const v = (state as Record<string, unknown>)[key] as StackNavHint | undefined;
  if (v == null) return undefined;
  return typeof v === 'string' ? { direction: v } : v;
}
