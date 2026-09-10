/**
 * Recognizes a leading-edge horizontal drag and drives the stack's
 * interactive pop from it. Works with pointer events, so mouse and touch
 * both count. Vertical movement early in the touch hands it back to
 * native scrolling.
 */
export function createEdgePanGesture(options = {}) {
  const o = {
    edgeWidth: 28, // px
    anywhere: false,
    startSlop: 6, // px of horizontal movement before the drag begins
    verticalCancelSlop: 10, // px of vertical movement that hands the touch back to scrolling
    completeThreshold: 0.5, // fraction of the width dragged that completes without velocity
    completeVelocity: 500, // px/s toward the trailing edge: completes regardless of distance
    cancelVelocity: -500, // px/s back toward the leading edge: cancels regardless of distance
    velocitySamples: 6,
    ...options,
  };

  let stack;
  let strip;
  let drag = null;
  let suppressClick = false;
  let offs = [];

  const onDown = (ev) => {
    if (drag || !stack.canPop()) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (ev.currentTarget === stack.container && !o.anywhere) return;
    drag = { id: ev.pointerId, target: ev.currentTarget, x0: ev.clientX, y0: ev.clientY, handle: null, p: 1, samples: [[ev.clientX, performance.now()]] };
  };

  const onMove = (ev) => {
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
        drag.target.setPointerCapture(ev.pointerId);
      } catch (e) {
        /* capture is best-effort */
      }
    }
    drag.samples.push([ev.clientX, performance.now()]);
    if (drag.samples.length > o.velocitySamples) drag.samples.shift();
    drag.p = 1 - Math.min(1, Math.max(0, (dx - o.startSlop) / stack.width()));
    drag.handle.update(drag.p);
  };

  const onUp = (ev) => {
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
    d.handle.finish({ complete, velocity });
  };

  const onClick = (ev) => {
    if (suppressClick) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  };

  const EVENTS = { pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onUp };
  const listen = (el) => Object.entries(EVENTS).forEach(([k, f]) => el.addEventListener(k, f));
  const unlisten = (el) => Object.entries(EVENTS).forEach(([k, f]) => el.removeEventListener(k, f));

  const refresh = () => {
    if (!strip) return;
    strip.style.width = o.edgeWidth + 'px';
    strip.style.display = o.anywhere || stack.entries.length < 2 ? 'none' : '';
  };

  return {
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
      offs = ['push', 'pop', 'reset'].map((e) => stack.on(e, refresh));
      refresh();
      return this;
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
}
