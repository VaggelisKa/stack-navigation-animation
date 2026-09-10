export { NavigationStack } from './navigation-stack.js';
export { createIOSTransition } from './ios-transition.js';
export { createEdgePanGesture } from './edge-pan-gesture.js';
export { attachBrowserHistory, isIOSBrowser } from './history-adapter.js';
export { cubicBezier, easings, tween, prefersReducedMotion } from './animate.js';

import { NavigationStack } from './navigation-stack.js';
import { createIOSTransition } from './ios-transition.js';
import { createEdgePanGesture } from './edge-pan-gesture.js';

/**
 * One call that wires the three pieces together: a stack in `container`,
 * the iOS transition, and the edge-pan gesture. The gesture is exposed as
 * `stack.gesture`; destroying the stack detaches it.
 */
export function createIOSStack({ container, transition = {}, gesture = {} } = {}) {
  const t = createIOSTransition(transition);
  const g = createEdgePanGesture(gesture);
  const stack = new NavigationStack({ container, transition: t });
  g.attach(stack);
  stack.gesture = g;
  const destroy = stack.destroy.bind(stack);
  stack.destroy = () => {
    g.detach();
    destroy();
  };
  return stack;
}
