import {
  afterNextRender,
  afterRenderEffect,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet, type Routes } from '@angular/router';
import { filter, map } from 'rxjs';
import { StackNav } from '@stacknav/angular';

/**
 * `/?shell=document`: a stack the document scrolls, under a shell header that
 * reads `window.scrollY` -- an iOS-style large title collapsing into the bar
 * as the page goes up. The header knows nothing about the stack;
 * `provideStackNav({ scroll: 'document' })` is the whole integration.
 *
 * The header is fixed and the app root pads for it, so the stack's position in
 * the document does not depend on how far it has collapsed.
 */

/** How far the document scrolls before the large title is gone. */
const COLLAPSE = 60;
/** The fixed header's full height: the bar plus the large title. */
const HEADER = 52 + COLLAPSE;

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

/** A long list, so the document has somewhere to scroll to. */
@Component({
  selector: 'doc-home',
  imports: [RouterLink],
  template: `
    <div class="page body">
      <h2>Items</h2>
      <p class="lede">The title above collapses on <code>window.scrollY</code>. Scroll, open an item, and come back: the header is already collapsed while the list slides in.</p>
      <div class="counter item" id="doc-marker">
        <span>Kept page state</span><b>{{ count() }}</b>
        <button type="button" (click)="count.set(count() + 1)">+</button>
      </div>
      @for (id of items; track id) {
        <a class="item" [routerLink]="['/items', id]" [queryParams]="{ shell: 'document' }">
          <span>Item {{ id }}</span><i>›</i>
        </a>
      }
    </div>
  `,
})
class DocHome {
  readonly count = signal(0);
  readonly items = Array.from({ length: 40 }, (_, i) => i + 1);
}

/** As many paragraphs as its number: item 3 fits the screen, item 30 does not. */
@Component({
  selector: 'doc-item',
  template: `
    <div class="page body">
      <h2>Item {{ id() }}</h2>
      @for (p of paragraphs(); track p) {
        <p class="lede">{{ p }}. {{ lorem }}</p>
      }
    </div>
  `,
})
class DocItem {
  readonly id = input.required<string>();
  readonly lorem = LOREM;
  paragraphs(): number[] {
    return Array.from({ length: Math.max(1, Number(this.id()) || 1) }, (_, i) => i + 1);
  }
}

export const DOCUMENT_SHELL_ROUTES: Routes = [
  { path: '', component: DocHome },
  { path: 'items/:id', component: DocItem },
  { path: '**', redirectTo: '' },
];

@Component({
  selector: 'app-root',
  host: { 'data-shell-demo': '' },
  imports: [RouterOutlet, StackNav, RouterLink],
  styles: `
    :host { display: block; width: 100%; height: auto; padding-top: ${HEADER}px; }
    .doc-header { position: fixed; top: 0; left: 0; right: 0; z-index: 2; height: ${HEADER}px; background: #dde8ff; color: #111; overflow: hidden; }
    .doc-bar { display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 16px; }
    .doc-bar .doc-compact { flex: 1; text-align: center; font-weight: 600; opacity: var(--doc-p, 0); }
    .doc-bar .doc-back { width: 64px; background: none; border: 0; color: #0a84ff; font: inherit; padding: 0; text-align: left; cursor: pointer; }
    .doc-bar .doc-spacer { width: 64px; }
    .doc-large { margin: 0; padding: 0 16px; font-size: 34px; line-height: ${COLLAPSE}px; opacity: calc(1 - var(--doc-p, 0)); transform: translateY(calc(var(--doc-p, 0) * -${COLLAPSE}px)); }
    .doc-header.collapsed { height: 52px; }
    .doc-stack { display: block; }
  `,
  template: `
    <header class="doc-header">
      <div class="doc-bar">
        @if (detail()) {
          <button type="button" class="doc-back" routerLink="/" [queryParams]="{ shell: 'document' }" aria-label="Back to items">‹ Back</button>
        } @else {
          <span class="doc-spacer"></span>
        }
        <span class="doc-compact" aria-hidden="true">stacknav</span>
        <span class="doc-spacer"></span>
      </div>
      <h1 class="doc-large">stacknav</h1>
    </header>
    <main class="doc-stack">
      <router-outlet stackNav />
    </main>
  `,
})
export class DocumentShellDemo {
  private readonly router = inject(Router);
  private readonly outlet = viewChild(StackNav);
  readonly detail = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.split('?')[0] !== '/'),
    ),
    { initialValue: this.router.url.split('?')[0] !== '/' },
  );

  constructor() {
    const host = inject(ElementRef).nativeElement as HTMLElement;
    const destroyRef = inject(DestroyRef);
    // The shell's own scroll listener, reading the document's offset and
    // nothing else. Written straight to the DOM, so the header is in the right
    // state on the frame the offset changes.
    afterNextRender(() => {
      const header = host.querySelector('.doc-header') as HTMLElement;
      const paint = () => {
        const p = Math.min(1, Math.max(0, window.scrollY / COLLAPSE));
        header.style.setProperty('--doc-p', p.toFixed(3));
        header.classList.toggle('collapsed', p === 1);
      };
      window.addEventListener('scroll', paint, { passive: true });
      paint();
      destroyRef.onDestroy(() => window.removeEventListener('scroll', paint));
    });
    afterRenderEffect(() => {
      const outlet = this.outlet();
      if (outlet) (globalThis as { __snStack?: typeof outlet.stack }).__snStack = outlet.stack;
    });
  }
}
