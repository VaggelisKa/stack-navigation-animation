import { afterNextRender, DestroyRef, Directive, ElementRef, inject, NgZone } from '@angular/core';

/**
 * Sizes a local stack from its top edge to the visible viewport's bottom.
 * Useful when a shell places a microfrontend below its header without giving
 * the content slot a height. Apply to the parent of `<router-outlet stackNav>`.
 * The wrapper must participate in normal block layout; its top must not depend
 * on its own height (for example through vertical centering).
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
    const win = el.ownerDocument.defaultView;
    if (!win || this.destroyRef.destroyed) return;
    const original = ['height', 'box-sizing'].map((name) => ({
      name,
      value: el.style.getPropertyValue(name),
      priority: el.style.getPropertyPriority(name),
    }));
    el.style.setProperty('box-sizing', 'border-box');
    let frame = 0;
    let previousHeight = '';
    const update = () => {
      // Position can change without this element (or any ancestor) resizing:
      // sibling banners, margins and CSS animations all occur outside our app.
      // A frame sample catches those shifts without observing the shell's DOM.
      if (el.isConnected && el.getClientRects().length) {
        const viewport = win.visualViewport;
        const bottom = viewport ? viewport.offsetTop + viewport.height : win.innerHeight;
        const height = `${Math.max(0, bottom - el.getBoundingClientRect().top)}px`;
        if (height !== previousHeight) {
          el.style.setProperty('height', height);
          previousHeight = height;
        }
      }
      frame = win.requestAnimationFrame(update);
    };
    update();
    this.destroyRef.onDestroy(() => {
      win.cancelAnimationFrame(frame);
      for (const { name, value, priority } of original) {
        if (value) el.style.setProperty(name, value, priority);
        else el.style.removeProperty(name);
      }
    });
  }
}
