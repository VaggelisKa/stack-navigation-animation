export { StackNav } from './lib/stack';
export { StackNavFillViewport } from './lib/fill-viewport';
export type { StackNavPage, StackNavRouteRef, StackNavActivation } from './lib/stack';
export type { StackNavHint } from './lib/history';
export {
  provideStackNav,
  STACKNAV_CONFIG,
  defaultKeyOf,
  defaultLevelOf,
  resolveConfig,
} from './lib/config';
export type {
  StackNavConfig,
  ResolvedStackNavConfig,
  StackNavAnimationContext,
} from './lib/config';
export { StackNavRouteReuseStrategy } from './lib/route-reuse-strategy';

export type { ScrollMode, SwipeBackMode } from '@stacknav/core';
