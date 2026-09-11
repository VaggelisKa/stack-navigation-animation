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
export { createIOSTransition } from './ios-transition.ts';
export type { IOSTransition, IOSTransitionOptions } from './ios-transition.ts';
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

export interface IOSStackOptions {
  container: HTMLElement;
  transition?: Partial<IOSTransitionOptions>;
  gesture?: Partial<EdgePanGestureOptions>;
}

export interface IOSStack extends NavigationStack {
  transition: IOSTransition;
  gesture: EdgePanGesture;
}

/**
 * One call that wires the three pieces together: a stack in `container`,
 * the iOS transition, and the edge-pan gesture. The gesture is exposed as
 * `stack.gesture`; destroying the stack detaches it.
 */
export function createIOSStack({ container, transition = {}, gesture = {} }: IOSStackOptions): IOSStack {
  const t = createIOSTransition(transition);
  const g = createEdgePanGesture(gesture);
  const stack = new NavigationStack({ container, transition: t }) as IOSStack;
  g.attach(stack);
  stack.gesture = g;
  const destroy = stack.destroy.bind(stack);
  stack.destroy = () => {
    g.detach();
    destroy();
  };
  return stack;
}
