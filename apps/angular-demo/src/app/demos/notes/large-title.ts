import { Component, DestroyRef, ElementRef, afterNextRender, inject, input } from '@angular/core';
import { BackButton } from '../shared';

/**
 * The header iOS puts on the first screen of an app: a large title at the top
 * of the page, and the usual 52px bar it collapses into once the page is
 * scrolled. At rest the header is two rows tall; scrolled, it is one, with the
 * title in the middle of the bar where every pushed page keeps it.
 *
 * The host is `display: contents`, so the bar and the large title are children
 * of the page itself: the bar's `position: sticky` is then measured against the
 * whole page rather than against this header, which is what lets the large
 * title scroll out from under a bar that stays.
 *
 * Nothing here is a signal and nothing is re-rendered. A scroll writes three
 * custom properties on the host and CSS spends them, so a collapsing header
 * costs no change detection, and the style invalidation stays inside the
 * header rather than reaching the list beneath it.
 */
@Component({
  selector: 'demo-large-title',
  imports: [BackButton],
  template: `
    <header class="hdr lt-bar">
      @if (back(); as b) {
        <button type="button" class="back" [snBack]="b">‹ {{ backLabel() }}</button>
      } @else {
        <span class="spacer"></span>
      }
      <!-- The heading lives in the large title below; this is the same words, painted where the bar wants them. -->
      <span class="lt-compact" aria-hidden="true">{{ title() }}</span>
      <span class="lt-action"><ng-content /></span>
    </header>
    <div class="lt-large"><h1>{{ title() }}</h1></div>
  `,
  host: { class: 'lt' },
})
export class LargeTitle {
  readonly title = input.required<string>();
  /** Where the back button goes when there is no history behind this page. No `back`, no button. */
  readonly back = input<string | null>(null);
  readonly backLabel = input('Back');

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const large = host.querySelector('.lt-large') as HTMLElement;
      const scroller = scrollerOf(host);
      // The root scroller's scroll events are fired at the document, every other one at the element.
      const target: EventTarget = scroller === host.ownerDocument.documentElement ? host.ownerDocument : scroller;
      /** How far the page scrolls before the large title has passed under the bar. A wrapped title makes it taller. */
      let travel = Math.max(1, large.offsetHeight);
      let frame = 0;
      let last = '';
      const paint = () => {
        frame = 0;
        const top = scroller.scrollTop;
        const p = Math.min(1, Math.max(0, top / travel));
        // The two titles cross over in the second half of the travel: the large
        // one is under the bar's blur by then, and the bar's hairline arrives with it.
        const inBar = Math.min(1, Math.max(0, (p - 0.5) / 0.4));
        // Dragging a page past its top (the rubber band on iOS) stretches the large title, as it does natively.
        const scale = 1 + Math.min(60, Math.max(0, -top)) / 500;
        const next = `${inBar.toFixed(3)} ${(1 - inBar).toFixed(3)} ${scale.toFixed(3)}`;
        if (next === last) return; // scrolling on past the collapse changes nothing
        last = next;
        host.style.setProperty('--lt-in', inBar.toFixed(3));
        host.style.setProperty('--lt-out', (1 - inBar).toFixed(3));
        host.style.setProperty('--lt-scale', scale.toFixed(3));
      };
      const onScroll = () => (frame ||= requestAnimationFrame(paint));
      // The measurement is a layout read, so it is taken here, where layout is already settled,
      // rather than in the scroll handler, which has just written to the style of these elements.
      const resize = new ResizeObserver(() => {
        travel = Math.max(1, large.offsetHeight);
        paint();
      });
      resize.observe(large);
      target.addEventListener('scroll', onScroll, { passive: true });
      paint(); // a deep link can land on a page the browser has already restored the scroll of
      destroyRef.onDestroy(() => {
        target.removeEventListener('scroll', onScroll);
        resize.disconnect();
        cancelAnimationFrame(frame);
      });
    });
  }
}

/**
 * The page the stack mounts is its own scroll container, so in this app the
 * answer is always the `.sn-page` above. Outside a stack, the nearest
 * scrollable ancestor is what a sticky header would stick to anyway.
 */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.classList.contains('sn-page') || /auto|scroll/.test(getComputedStyle(p).overflowY)) return p;
  }
  return el.ownerDocument.documentElement;
}
