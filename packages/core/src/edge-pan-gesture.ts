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
  /** px/s toward the trailing edge: completes regardless of distance */
  completeVelocity: number;
  /** px/s back toward the leading edge: cancels regardless of distance */
  cancelVelocity: number;
  velocitySamples: number;
}

export interface EdgePanGesture {
  readonly options: EdgePanGestureOptions;
  /** Re-read options at runtime (edge width, `anywhere`). */
  refresh(): void;
  attach(stack: NavigationStack): EdgePanGesture;
  detach(): void;
}

interface Drag {
  id: number;
  target: EventTarget & { setPointerCapture?(id: number): void };
  x0: number;
  y0: number;
  handle: InteractivePopHandle | null;
  p: number;
  samples: Array<[number, number]>;
}

/**
 * Recognizes a leading-edge horizontal drag and drives the stack's
 * interactive pop from it. Works with pointer events, so mouse and touch
 * both count. Vertical movement early in the touch hands it back to
 * native scrolling.
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
  let drag: Drag | null = null;
  let suppressClick = false;
  let offs: Array<() => void> = [];

  const onDown = (ev: PointerEvent) => {
    if (drag || !stack.canPop()) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.currentTarget === stack.container && !o.anywhere) return;
    drag = { id: ev.pointerId, target: ev.currentTarget as Drag['target'], x0: ev.clientX, y0: ev.clientY, handle: null, p: 1, samples: [[ev.clientX, performance.now()]] };
  };

  const onMove = (ev: PointerEvent) => {
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x0;
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
    const velocity = t2 > t1 ? ((x2 - x1) / (t2 - t1)) * 1000 : 0;
    const cancelled = ev.type === 'pointercancel';
    const complete = !cancelled && (velocity > o.completeVelocity || (d.p < 1 - o.completeThreshold && velocity > o.cancelVelocity));
    // The click that follows a drag release must not activate whatever is under the finger.
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

  const refresh = () => {
    if (!strip) return;
    strip.style.width = o.edgeWidth + 'px';
    strip.style.display = o.anywhere || stack.entries.length < 2 ? 'none' : '';
  };

  const gesture: EdgePanGesture = {
    options: o,
    refresh,
    attach(s) {
      stack = s;
      strip = document.createElement('div');
      strip.setAttribute('aria-hidden', 'true');
      Object.assign(strip.style, { position: 'absolute', left: '0', top: '0', bottom: '0', zIndex: '10', touchAction: 'none' });
      stack.container.append(strip);
      listen(strip);
      listen(stack.container);
      stack.container.addEventListener('click', onClick, true);
      offs = (['push', 'pop', 'replace', 'reset'] as const).map((e) => stack.on(e, refresh));
      refresh();
      return gesture;
    },
    detach() {
      if (!strip) return;
      offs.forEach((f) => f());
      unlisten(strip);
      unlisten(stack.container);
      stack.container.removeEventListener('click', onClick, true);
      strip.remove();
      strip = null;
    },
  };
  return gesture;
}
