/** Browser suppression is best effort; browser buttons and OS gestures remain available. */
export type SwipeBackMode = 'browser' | 'disabled';

interface Suppression {
  count: number;
  value: string;
  priority: string;
}

// Several outlets can share one viewport. Restore it only after the last
// suppression request is released, including when stacks are destroyed.
const suppressions = /*#__PURE__*/ new WeakMap<HTMLElement, Suppression>();

export function suppressBrowserSwipe(container: HTMLElement): () => void {
  const root = container.ownerDocument.documentElement;
  const property = 'overscroll-behavior-x';
  let state = suppressions.get(root);
  if (!state) {
    state = { count: 0, value: root.style.getPropertyValue(property), priority: root.style.getPropertyPriority(property) };
    suppressions.set(root, state);
    root.style.setProperty(property, 'contain', 'important');
  }
  state.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--state.count) return;
    suppressions.delete(root);
    // Do not overwrite a newer declaration installed by the application.
    if (root.style.getPropertyValue(property) !== 'contain' || root.style.getPropertyPriority(property) !== 'important') return;
    if (state.value) root.style.setProperty(property, state.value, state.priority);
    else root.style.removeProperty(property);
  };
}
