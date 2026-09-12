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

import { suppressBrowserSwipe, type SwipeBackMode } from './swipe-back.ts';

export interface NativeStackOptions {
  container: HTMLElement;
  transition?: Partial<NativeTransitionOptions>;
  /** Default browser. Disabled requests document-wide browser swipe suppression. */
  swipeBack?: SwipeBackMode;
}

export interface NativeStack extends NavigationStack {
  transition: NativeTransition;
  readonly swipeBack: SwipeBackMode;
  /** Changes the policy without replacing pages or changing browser history. */
  setSwipeBack(mode: SwipeBackMode): void;
}

/**
 * Wires the two pieces together in one call: a stack in `container` and the
 * platform's native transition. The browser keeps the back gesture unless
 * `disabled` asks for suppression; destroying releases that request.
 *
 * There is no gesture recognizer here on purpose. In a browser tab the browser
 * already owns the edge and will not give it up, so a second recognizer reads
 * as two backs at once. Apps that own the edge -- an installed PWA, a native
 * webview -- can drive `beginInteractivePop()` from their own pointer handling.
 */
export function createNativeStack({ container, transition = {}, swipeBack = 'browser' }: NativeStackOptions): NativeStack {
  const t = createNativeTransition(transition);
  const stack = new NavigationStack({ container, transition: t }) as NativeStack;
  let mode: SwipeBackMode | undefined;
  let release: (() => void) | undefined;
  let destroyed = false;
  Object.defineProperty(stack, 'swipeBack', { get: () => mode });
  stack.setSwipeBack = (next) => {
    if (destroyed || next === mode) return;
    if (next !== 'browser' && next !== 'disabled') throw new TypeError('Invalid swipeBack mode');
    if (next === 'browser') {
      release?.();
      release = undefined;
    } else {
      release ??= suppressBrowserSwipe(container);
    }
    mode = next;
  };
  stack.setSwipeBack(swipeBack);
  const destroy = stack.destroy.bind(stack);
  stack.destroy = () => {
    destroyed = true;
    release?.();
    release = undefined;
    destroy();
  };
  return stack;
}
