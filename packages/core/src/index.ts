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
export { cubicBezier, linearEasing, easings, cssEasing, cssDuration, tween, commitStyles, animationsFinished, prefersReducedMotion } from './animate.ts';
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

export interface NativeStackOptions {
  container: HTMLElement;
  transition?: Partial<NativeTransitionOptions>;
  gesture?: Partial<EdgePanGestureOptions>;
}

export interface NativeStack extends NavigationStack {
  transition: NativeTransition;
  gesture: EdgePanGesture;
}

/**
 * Wires the three pieces together in one call: a stack in `container`, the
 * platform's native transition, and the edge-pan gesture. The gesture is
 * exposed as `stack.gesture`, and destroying the stack detaches it.
 */
export function createNativeStack({ container, transition = {}, gesture = {} }: NativeStackOptions): NativeStack {
  const t = createNativeTransition(transition);
  const g = createEdgePanGesture(gesture);
  const stack = new NavigationStack({ container, transition: t }) as NativeStack;
  g.attach(stack);
  stack.gesture = g;
  const destroy = stack.destroy.bind(stack);
  stack.destroy = () => {
    g.detach();
    destroy();
  };
  return stack;
}
