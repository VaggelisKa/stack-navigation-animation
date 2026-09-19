import { afterNextRender, DestroyRef, Directive, ElementRef, inject, NgZone } from '@angular/core';

/** Frames sampled after a trigger, to follow a change that is still settling. */
const BURST_FRAMES = 10;
/** Frames without a height change that end a burst early. */
const STABLE_FRAMES = 3;
/** How often the slow fallback samples while the document is visible. */
const FALLBACK_MS = 500;

/**
 * Sizes a local stack from its top edge to the visible viewport's bottom.
 * Useful when a shell places a microfrontend below its header without giving
 * the content slot a height. Apply to the parent of `<router-outlet stackNav>`.
 * The wrapper must participate in normal block layout; its top must not depend
 * on its own height (for example through vertical centering).
 *
 * Measuring is event driven rather than a permanent frame loop, so an idle page
 * costs nothing: resize observers on the element and the document element,
 * `visualViewport` resize/scroll, window resize/scroll, and transition/animation
 * ends bubbling to the document each start a short burst of frame samples that
 * stops as soon as the height settles. Because the element's top can still move
 * without any of those firing (a sibling banner growing, say), a slow 500ms
 * sample runs as a backstop, paused while the document is hidden.
 */
@Directive({ selector: '[stackNavFillViewport]', standalone: true })
export class StackNavFillViewport {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Render callbacks do not run on the server. Use the element's own window
    // so an application embedded in an iframe measures that iframe's viewport.
    afterNextRender(() => this.zone.runOutsideAngular(() => this.start()));
  }

  private start(): void {
    const el = this.element;
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    if (!win || this.destroyRef.destroyed) return;
    const original = ['height', 'box-sizing'].map((name) => ({
      name,
      value: el.style.getPropertyValue(name),
      priority: el.style.getPropertyPriority(name),
    }));
    el.style.setProperty('box-sizing', 'border-box');

    let previousHeight = '';
    let frame = 0;
    let timer: number | undefined;
    let burst = 0;
    let stable = 0;

    /** Writes the height the visible viewport leaves below the element's top. */
    const measure = (): boolean => {
      if (!el.isConnected || !el.getClientRects().length) return false;
      // Read the live `visualViewport`: a page can swap or remove it.
      const viewport = win.visualViewport;
      const bottom = viewport ? viewport.offsetTop + viewport.height : win.innerHeight;
      const height = `${Math.max(0, bottom - el.getBoundingClientRect().top)}px`;
      if (height === previousHeight) return false;
      el.style.setProperty('height', height);
      previousHeight = height;
      return true;
    };

    const sample = () => {
      frame = 0;
      stable = measure() ? 0 : stable + 1;
      if (--burst > 0 && stable < STABLE_FRAMES) frame = win.requestAnimationFrame(sample);
    };

    /**
     * Something that may have moved the element happened. Sample the next few
     * frames: the change that fired the trigger is often still animating, and
     * the element's position can keep drifting for a frame or two after it.
     */
    const trigger = () => {
      burst = BURST_FRAMES;
      stable = 0;
      if (!frame) frame = win.requestAnimationFrame(sample);
    };

    /** The backstop for shifts no observer or event reports. */
    const scheduleFallback = () => {
      if (timer !== undefined || doc.visibilityState === 'hidden') return;
      timer = win.setTimeout(() => {
        timer = undefined;
        measure();
        scheduleFallback();
      }, FALLBACK_MS);
    };

    const onVisibility = () => {
      if (doc.visibilityState === 'hidden') {
        if (timer !== undefined) win.clearTimeout(timer);
        timer = undefined;
      } else {
        trigger();
        scheduleFallback();
      }
    };

    const passive = { passive: true } as const;
    // The shell may scroll a container rather than the window, and a scrolled
    // container moves our top edge without resizing anything.
    win.addEventListener('resize', trigger, passive);
    win.addEventListener('scroll', trigger, passive);
    const viewport = win.visualViewport;
    viewport?.addEventListener('resize', trigger, passive);
    viewport?.addEventListener('scroll', trigger, passive);
    // Cheap, and catches the shell animations that move us the most.
    doc.addEventListener('transitionend', trigger, passive);
    doc.addEventListener('animationend', trigger, passive);
    doc.addEventListener('visibilitychange', onVisibility);

    // Absent in older browsers and in some test environments; the slow sample
    // alone keeps the element sized there.
    const Observer = win.ResizeObserver as typeof ResizeObserver | undefined;
    const observer = Observer ? new Observer(trigger) : undefined;
    observer?.observe(el);
    observer?.observe(doc.documentElement);

    measure();
    scheduleFallback();

    this.destroyRef.onDestroy(() => {
      if (frame) win.cancelAnimationFrame(frame);
      if (timer !== undefined) win.clearTimeout(timer);
      observer?.disconnect();
      win.removeEventListener('resize', trigger);
      win.removeEventListener('scroll', trigger);
      viewport?.removeEventListener('resize', trigger);
      viewport?.removeEventListener('scroll', trigger);
      doc.removeEventListener('transitionend', trigger);
      doc.removeEventListener('animationend', trigger);
      doc.removeEventListener('visibilitychange', onVisibility);
      for (const { name, value, priority } of original) {
        if (value) el.style.setProperty(name, value, priority);
        else el.style.removeProperty(name);
      }
    });
  }
}
