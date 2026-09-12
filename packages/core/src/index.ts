export type { SwipeBackMode } from './swipe-back.ts';
export { NavigationStack } from './navigation-stack.ts';
export type {
  StackEntry,
  Transition,
  TransitionKind,
  NavigationSource,
  MountOptions,
  NavigationStackOptions,
  InteractivePopHandle,
  SettleInput,
  StackEvents,
  PushEvent,
  PopEvent,
  ReplaceEvent,
  ResetEvent,
  TransitionEvent,
  ProgressEvent,
} from './navigation-stack.ts';
export { createIOSTransition, IOS_TRANSITION_CSS_VARS } from './ios-transition.ts';
export type { IOSTransition, IOSTransitionOptions } from './ios-transition.ts';
export { cssVars, parseTime, parseNumber, parseRatio, parseEasing } from './css-vars.ts';
export type { CSSVarReader } from './css-vars.ts';
export { createEdgePanGesture } from './edge-pan-gesture.ts';
export type { EdgePanGesture, EdgePanGestureOptions } from './edge-pan-gesture.ts';
export { attachBrowserHistory, isIOSBrowser } from './history-adapter.ts';
export type { BrowserHistoryOptions } from './history-adapter.ts';
export { cubicBezier, easings, cssEasing, cssDuration, tween, commitStyles, animationsFinished, prefersReducedMotion } from './animate.ts';
export type { Easing, TweenOptions, CancellableTween } from './animate.ts';
export {
  resolveDirection,
  createDirectionResolver,
  defaultStrategies,
  fromHint,
  fromHistory,
  fromStack,
  fromLevel,
  fromTree,
  always,
  segmentsOf,
} from './direction.ts';
export type {
  Direction,
  DirectionOpinion,
  DirectionStrategy,
  DirectionResolver,
  NavigationContext,
  NavigationTrigger,
  RouteRef,
  LevelOptions,
  TreeOptions,
} from './direction.ts';
export { STACKNAV_CSS, STACKNAV_STYLE_ID, injectStyles } from './styles.ts';

import { NavigationStack } from './navigation-stack.ts';
import { createIOSTransition, type IOSTransition, type IOSTransitionOptions } from './ios-transition.ts';
import { createEdgePanGesture, type EdgePanGesture, type EdgePanGestureOptions } from './edge-pan-gesture.ts';

import { suppressBrowserSwipe, type SwipeBackMode } from './swipe-back.ts';

export interface IOSStackOptions {
  container: HTMLElement;
  transition?: Partial<IOSTransitionOptions>;
  gesture?: Partial<EdgePanGestureOptions>;
  /** Default browser. Custom and disabled request document-wide browser swipe suppression. */
  swipeBack?: SwipeBackMode;
}

export interface IOSStack extends NavigationStack {
  transition: IOSTransition;
  gesture: EdgePanGesture;
  readonly swipeBack: SwipeBackMode;
  /** Changes gesture policy without replacing pages or changing browser history. */
  setSwipeBack(mode: SwipeBackMode): void;
}

/**
 * Wires the three pieces together in one call: a stack in `container`, the iOS
 * transition, and an optional edge-pan gesture. Browser mode is the default.
 * The gesture is exposed as `stack.gesture`; destroying releases its policy.
 */
export function createIOSStack({ container, transition = {}, gesture = {}, swipeBack = 'browser' }: IOSStackOptions): IOSStack {
  const t = createIOSTransition(transition);
  const g = createEdgePanGesture(gesture);
  const stack = new NavigationStack({ container, transition: t }) as IOSStack;
  stack.gesture = g;
  let mode: SwipeBackMode | undefined;
  let release: (() => void) | undefined;
  let destroyed = false;
  Object.defineProperty(stack, 'swipeBack', { get: () => mode });
  stack.setSwipeBack = (next) => {
    if (destroyed || next === mode) return;
    if (next !== 'custom' && next !== 'browser' && next !== 'disabled') throw new TypeError('Invalid swipeBack mode');
    g.detach();
    if (next === 'browser') {
      release?.();
      release = undefined;
    } else {
      release ??= suppressBrowserSwipe(container);
    }
    mode = next;
    if (mode === 'custom') g.attach(stack);
  };
  stack.setSwipeBack(swipeBack);
  const destroy = stack.destroy.bind(stack);
  stack.destroy = () => {
    destroyed = true;
    g.detach();
    release?.();
    release = undefined;
    destroy();
  };
  return stack;
}
