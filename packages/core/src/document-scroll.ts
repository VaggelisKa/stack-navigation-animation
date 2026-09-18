import type { StackEntry } from './navigation-stack.ts';

/**
 * Layout for a stack whose pages scroll with the document instead of inside
 * themselves: `scroll: 'document'`.
 *
 * A stack of its own is a scroll container, and each page in it another one.
 * That is what lets a page beneath keep its offset for free, but it also means
 * the document never scrolls, and a shell built around `window.scrollY` -- an
 * iOS-style large title that collapses as the page goes up -- sees nothing.
 * In this mode the page on top sits in the normal flow at rest, so its content
 * is the document's, and the document's offset is the page's. Everything the
 * stylesheet does for that is keyed on `sn-scroll-document`; what is here is
 * the part CSS cannot do: give each page its own offset back.
 *
 * Two pages sharing one scroller cannot both be where they belong, so a
 * transition is run inside a frame. Before the pages leave the flow, the page
 * leaving is measured where it rests and its offset is recorded; the container
 * is given a height that keeps both offsets reachable -- the destination's and
 * the leaving page's, which an interactive pop let go goes back to; the document
 * is put at the destination's offset; and the leaving page is moved up or
 * down by exactly what that switch moved the container, so nothing the user
 * was looking at shifts. The switch happens before the motion, not after it:
 * a shell reading `scrollY` shows the destination's header from the first
 * frame of the slide instead of catching up once it is over, which reads as a
 * second animation. When the top page is back in the flow the frame is
 * released and the document is put at that page's offset once more, which is
 * where the browser clamps it if the page turned out shorter than it was.
 *
 * The two measurements are forced layouts inside the navigation task, one
 * before the switch and one after, which the default mode goes to some length
 * to avoid; they are the price of asking the document where things are.
 *
 * Offsets are kept by element, so a page that comes back -- put back after a
 * refused pop, or resumed with its stack -- is shown where it was left. A page
 * never seen starts at the top, except the first page of an empty stack, which
 * keeps the document where the app already has it.
 */
export class DocumentScroll {
  private readonly offsets = new WeakMap<HTMLElement, number>();
  private phase: {
    leaving: StackEntry | null;
    arriving: StackEntry;
    /** Where the container sat in the viewport once the document was at the arriving page's offset. */
    arrivingTop: number;
  } | null = null;

  private readonly container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    // On a history pop the browser puts the document back where that entry
    // left it, before the app hears of the navigation: the page still on top
    // would jump, and the stack would then record that jump as its offset. The
    // stack restores offsets itself, so the browser is told not to. This is
    // what a router that owns scrolling does too, and it is not undone on
    // destroy, since a next stack in the same document wants the same.
    const history = this.window?.history;
    if (history && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
  }

  private get window(): Window | null {
    return this.container.ownerDocument.defaultView;
  }

  private scrollTo(win: Window, top: number): void {
    // `instant`, or a `scroll-behavior: smooth` on the root would animate the
    // switch and the compensation would be measured against a document in motion.
    win.scrollTo({ top, behavior: 'instant' });
  }

  /** Records the document's offset as the page on top's, before that page leaves without a transition. */
  save(top: StackEntry | null): void {
    const win = this.window;
    if (top && win) this.offsets.set(top.el, win.scrollY);
  }

  /**
   * Opens the frame for a transition from `leaving` to `arriving`. Called
   * before the pages get their transition classes, while the leaving page is
   * still in the flow and can be measured at rest.
   */
  begin(leaving: StackEntry | null, arriving: StackEntry): void {
    const win = this.window;
    if (!win) return;
    const from = win.scrollY;
    if (leaving) this.offsets.set(leaving.el, from);
    const to = this.offsets.get(arriving.el) ?? (leaving ? 0 : from);
    this.offsets.set(arriving.el, to);
    const leavingTop = leaving ? leaving.el.getBoundingClientRect().top : 0;
    // The frame: enough for both offsets to exist once both pages are out of
    // the flow, whatever is above the container. The destination's is the one
    // the document takes now; the leaving page's has to stay reachable too, or
    // an interactive pop let go has nowhere to put the document back.
    this.container.style.height = `${Math.max(from, to) + win.innerHeight}px`;
    this.scrollTo(win, to);
    const arrivingTop = this.container.getBoundingClientRect().top;
    // The arriving page sits at the container's top, which is its resting
    // place at this offset. The leaving page is held where it was.
    if (leaving) leaving.el.style.top = `${leavingTop - arrivingTop}px`;
    this.phase = { leaving, arriving, arrivingTop };
  }

  /**
   * An interactive pop was let go short of completing: the document goes
   * back to the leaving page's offset for the settle, and now it is the
   * arriving page that is held where the user saw it.
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

  /** The stack is at rest with `top` in the flow: closes the frame and puts the document at that page's offset. */
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
