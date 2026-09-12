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
export { createNativeTransition, nativeTransitionPreset, NATIVE_TRANSITION_CSS_VARS } from './native-transition.ts';
export type { NativeTransition, NativeTransitionOptions, NativeTransitionPreset } from './native-transition.ts';
export { cssVars, parseTime, parseNumber, parseRatio, parseEasing } from './css-vars.ts';
export type { CSSVarReader } from './css-vars.ts';
export { createEdgePanGesture } from './edge-pan-gesture.ts';
export type { EdgePanGesture, EdgePanGestureOptions } from './edge-pan-gesture.ts';
export { attachBrowserHistory } from './history-adapter.ts';
export type { BrowserHistoryOptions } from './history-adapter.ts';
export { detectPlatform, isIOSBrowser, isAndroidBrowser } from './platform.ts';
export type { Platform } from './platform.ts';
export { cubicBezier, linearEasing, easings, cssEasing, cssDuration, tween, commitStyles, animationsFinished, prefersReducedMotion, matchesMedia, isTouchPrimary } from './animate.ts';
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
import { createNativeTransition, type NativeTransition, type NativeTransitionOptions } from './native-transition.ts';
import { createEdgePanGesture, type EdgePanGesture, type EdgePanGestureOptions } from './edge-pan-gesture.ts';

import { suppressBrowserSwipe, type SwipeBackMode } from './swipe-back.ts';

export interface NativeStackOptions {
  container: HTMLElement;
  transition?: Partial<NativeTransitionOptions>;
  gesture?: Partial<EdgePanGestureOptions>;
  /** Default browser. Custom and disabled request document-wide browser swipe suppression. */
  swipeBack?: SwipeBackMode;
}

export interface NativeStack extends NavigationStack {
  transition: NativeTransition;
  gesture: EdgePanGesture;
  readonly swipeBack: SwipeBackMode;
  /** Changes gesture policy without replacing pages or changing browser history. */
  setSwipeBack(mode: SwipeBackMode): void;
}

/**
 * Wires the three pieces together in one call: a stack in `container`, the
 * platform's native transition, and an optional edge-pan gesture. Browser mode
 * is the default. The gesture is exposed as `stack.gesture`; destroying
 * releases its policy.
 */
export function createNativeStack({ container, transition = {}, gesture = {}, swipeBack = 'browser' }: NativeStackOptions): NativeStack {
  const t = createNativeTransition(transition);
  const g = createEdgePanGesture(gesture);
  const stack = new NavigationStack({ container, transition: t }) as NativeStack;
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
