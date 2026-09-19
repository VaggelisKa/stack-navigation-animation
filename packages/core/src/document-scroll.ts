import type { StackEntry } from './navigation-stack.ts';

/**
 * Layout for a stack whose pages scroll with the document instead of inside
 * themselves: `scroll: 'document'`.
 *
 * A stack scrolling its own pages lets each keep its offset for free, but the
 * document never moves, and a shell built around `window.scrollY` -- an
 * iOS-style large title that collapses as the page goes up -- sees nothing.
 * Here the page on top is in the normal flow at rest, so the document's offset
 * is that page's. The stylesheet does the layout, keyed on
 * `sn-scroll-document`; this is the part CSS cannot do: giving each page its
 * own offset back, at the cost of two forced layouts per navigation.
 *
 * Two pages sharing one scroller cannot both be where they belong, so a
 * transition runs inside a frame: a container tall enough for both offsets,
 * the document moved to the destination's, and the page leaving offset by
 * exactly what that move shifted the container, so nothing the user was
 * looking at jumps. The switch comes before the motion rather than after it,
 * or a shell reading `scrollY` catches up once the slide is over, which reads
 * as a second animation.
 *
 * Offsets are kept by element, so a page that comes back -- after a refused
 * pop, or with its stack -- is shown where it was left. A page never seen
 * starts at the top, except the first page of an empty stack, which keeps the
 * document where the app already has it.
 */
export class DocumentScroll {
  private readonly offsets = new WeakMap<HTMLElement, number>();
  private phase: {
    leaving: StackEntry | null;
    arriving: StackEntry;
    /** Where the container sat once the document was at the arriving page's offset. */
    arrivingTop: number;
  } | null = null;

  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    // On a history pop the browser puts the document back where that entry
    // left it before the app hears of the navigation: the page still on top
    // would jump, and the stack would record the jump as its offset. Restoring
    // offsets is the stack's job, so the browser is told not to -- and not
    // told otherwise on destroy, since a next stack here wants the same.
    const history = this.window?.history;
    if (history && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  }

  private get window(): Window | null {
    return this.container.ownerDocument.defaultView;
  }

  private scrollTo(win: Window, top: number): void {
    // `instant`, or a `scroll-behavior: smooth` on the root would animate the
    // switch and leave the compensation measured against a moving document.
    win.scrollTo({ top, behavior: 'instant' });
  }

  /** Records the document's offset as the page on top's, before that page leaves without a transition. */
  save(top: StackEntry | null): void {
    const win = this.window;
    if (top && win) this.offsets.set(top.el, win.scrollY);
  }

  /**
   * Opens the frame for a transition from `leaving` to `arriving`, which has
   * to happen while the leaving page is still in the flow, at rest.
   */
  begin(leaving: StackEntry | null, arriving: StackEntry): void {
    const win = this.window;
    if (!win) return;
    const from = win.scrollY;
    if (leaving) this.offsets.set(leaving.el, from);
    const to = this.offsets.get(arriving.el) ?? (leaving ? 0 : from);
    this.offsets.set(arriving.el, to);
    const leavingTop = leaving ? leaving.el.getBoundingClientRect().top : 0;
    // Both offsets have to survive the pages leaving the flow: the
    // destination's, which the document takes now, and the leaving page's,
    // which an interactive pop let go goes back to.
    this.container.style.height = `${Math.max(from, to) + win.innerHeight}px`;
    this.scrollTo(win, to);
    const arrivingTop = this.container.getBoundingClientRect().top;
    // The arriving page is at the container's top, its resting place at this
    // offset; the leaving page is held where the user last saw it.
    if (leaving) leaving.el.style.top = `${leavingTop - arrivingTop}px`;
    this.phase = { leaving, arriving, arrivingTop };
  }

  /**
   * An interactive pop let go short of completing: the document goes back to
   * the leaving page's offset for the settle, and it is now the arriving page
   * that is held where the user saw it.
   */
  revert(): void {
    const { phase } = this;
    const win = this.window;
    if (!phase?.leaving || !win) return;
    this.scrollTo(win, this.offsets.get(phase.leaving.el) ?? 0);
    const containerTop = this.container.getBoundingClientRect().top;
    phase.leaving.el.style.top = '';
    phase.arriving.el.style.top = `${phase.arrivingTop - containerTop}px`;
  }

  /**
   * The stack is at rest with `top` in the flow: closes the frame and puts the
   * document at that page's offset, or where the browser clamps it if the page
   * is shorter than it was.
   */
  settle(top: StackEntry | null): void {
    this.release();
    const win = this.window;
    if (top && win) this.scrollTo(win, this.offsets.get(top.el) ?? 0);
  }

  /** Closes the frame, leaving the document where it is. */
  release(): void {
    const { phase } = this;
    this.phase = null;
    if (phase) {
      if (phase.leaving) phase.leaving.el.style.top = '';
      phase.arriving.el.style.top = '';
    }
    this.container.style.height = '';
  }
}
