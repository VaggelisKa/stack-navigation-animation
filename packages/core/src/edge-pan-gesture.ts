import type { InteractivePopHandle, NavigationStack } from './navigation-stack.ts';

export interface EdgePanGestureOptions {
  /** px strip on the leading edge that starts the gesture */
  edgeWidth: number;
  /** recognize the drag from anywhere on the page */
  anywhere: boolean;
  /** px of horizontal movement before the drag begins */
  startSlop: number;
  /** px of vertical movement that hands the touch back to scrolling */
  verticalCancelSlop: number;
  /** fraction of the width dragged that completes without velocity */
  completeThreshold: number;
  /** px/s toward the trailing edge that completes the pop regardless of distance */
  completeVelocity: number;
  /** px/s back toward the leading edge that cancels the pop regardless of distance */
  cancelVelocity: number;
  velocitySamples: number;
}

export interface EdgePanGesture {
  readonly options: EdgePanGestureOptions;
  /** Re-reads options changed at runtime, such as `edgeWidth` and `anywhere`. */
  refresh(): void;
  attach(stack: NavigationStack): EdgePanGesture;
  detach(): void;
}

interface Drag {
  id: number;
  target: EventTarget & { setPointerCapture?(id: number): void };
  x0: number;
  y0: number;
  /** +1 when back is a drag to the right, -1 when the container reads right-to-left */
  dir: number;
  handle: InteractivePopHandle | null;
  p: number;
  samples: Array<[number, number]>;
}

/**
 * Recognizes a horizontal drag from the leading edge and drives the stack's
 * interactive pop from it. Built on pointer events, so it handles both mouse
 * and touch. Vertical movement early in the gesture hands the touch back to
 * native scrolling.
 *
 * "Leading" is whichever edge the container reads from, so in a right-to-left
 * container the strip sits on the right and back is a drag to the left.
 */
export function createEdgePanGesture(options: Partial<EdgePanGestureOptions> = {}): EdgePanGesture {
  const o: EdgePanGestureOptions = {
    edgeWidth: 28,
    anywhere: false,
    startSlop: 6,
    verticalCancelSlop: 10,
    completeThreshold: 0.5,
    completeVelocity: 500,
    cancelVelocity: -500,
    velocitySamples: 6,
    ...options,
  };

  let stack: NavigationStack;
  let strip: HTMLElement | null = null;

  /**
   * Which way forward is, read the same way the pages read it: `--sn-dir` when
   * the stylesheet sets it, the container's reading direction otherwise. Taking
   * it from one place is what keeps the drag and the transition from disagreeing
   * about which edge is the back edge.
   */
  const direction = (): number => {
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(stack.container) : null;
    const declared = Number(style?.getPropertyValue('--sn-dir'));
    if (declared < 0) return -1;
    if (declared > 0) return 1;
    return style?.direction === 'rtl' ? -1 : 1;
  };
  let drag: Drag | null = null;
  let suppressClick = false;
  let offs: Array<() => void> = [];

  const onDown = (ev: PointerEvent) => {
    if (drag || !stack.canPop()) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (!o.anywhere && ev.target !== strip) return;
    drag = { id: ev.pointerId, target: ev.currentTarget as Drag['target'], x0: ev.clientX, y0: ev.clientY, dir: direction(), handle: null, p: 1, samples: [[ev.clientX, performance.now()]] };
  };

  const onMove = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.id) return;
    // Signed so that "forward along the drag" is always positive, whichever
    // edge the container calls leading.
    const dx = (ev.clientX - drag.x0) * drag.dir;
    const dy = ev.clientY - drag.y0;
    if (!drag.handle) {
      if (Math.abs(dy) > o.verticalCancelSlop && Math.abs(dy) > Math.abs(dx)) {
        drag = null;
        return;
      }
      if (dx < o.startSlop) return;
      const handle = stack.beginInteractivePop();
      if (!handle) {
        drag = null;
        return;
      }
      drag.handle = handle;
      try {
        drag.target.setPointerCapture?.(ev.pointerId);
      } catch {
        /* capture is best-effort */
      }
    }
    drag.samples.push([ev.clientX, performance.now()]);
    if (drag.samples.length > o.velocitySamples) drag.samples.shift();
    drag.p = 1 - Math.min(1, Math.max(0, (dx - o.startSlop) / stack.width()));
    drag.handle.update(drag.p);
  };

  const onUp = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.handle) return;
    const s = d.samples;
    const [x1, t1] = s[0];
    const [x2, t2] = s[s.length - 1];
    const velocity = (t2 > t1 ? ((x2 - x1) / (t2 - t1)) * 1000 : 0) * d.dir;
    const cancelled = ev.type === 'pointercancel';
    const complete = !cancelled && (velocity > o.completeVelocity || (d.p < 1 - o.completeThreshold && velocity > o.cancelVelocity));
    // The click that follows a drag release must not activate whatever is under the pointer.
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 0);
    void d.handle.finish({ complete, velocity });
  };

  const onClick = (ev: Event) => {
    if (suppressClick) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  const EVENTS: Record<string, (ev: PointerEvent) => void> = { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onUp };
  const listen = (el: HTMLElement) => Object.entries(EVENTS).forEach(([k, f]) => el.addEventListener(k, f as EventListener));
  const unlisten = (el: HTMLElement) => Object.entries(EVENTS).forEach(([k, f]) => el.removeEventListener(k, f as EventListener));

  /**
   * Whether the strip is shown at all is a CSS question — the stylesheet hides
   * it when there is nothing to go back to, or when the whole page is the
   * target — so this only has to say what is true.
   */
  const refresh = () => {
    if (!strip) return;
    strip.style.width = o.edgeWidth + 'px';
    stack.container.classList.toggle('sn-anywhere', o.anywhere);
    stack.container.classList.toggle('sn-can-pop', stack.entries.length > 1);
  };

  const gesture: EdgePanGesture = {
    options: o,
    refresh,
    attach(s) {
      gesture.detach();
      stack = s;
      stack.container.classList.add('sn-swipe-custom');
      strip = document.createElement('div');
      strip.className = 'sn-edge';
      strip.setAttribute('aria-hidden', 'true');
      stack.container.append(strip);
      // Pointer events from the strip bubble here; one listener per event
      // avoids applying each move and recording its velocity sample twice.
      listen(stack.container);
      stack.container.addEventListener('click', onClick, true);
      offs = (['push', 'pop', 'replace', 'reset'] as const).map((e) => stack.on(e, refresh));
      refresh();
      return gesture;
    },
    detach() {
      if (!strip) return;
      const handle = drag?.handle;
      drag = null;
      if (handle) void handle.finish({ complete: false, velocity: 0 });
      offs.forEach((f) => f());
      unlisten(stack.container);
      stack.container.removeEventListener('click', onClick, true);
      stack.container.classList.remove('sn-anywhere', 'sn-can-pop', 'sn-swipe-custom');
      strip.remove();
      strip = null;
    },
  };
  return gesture;
}
