import { afterRenderEffect, Component, input, signal, viewChild } from '@angular/core';
import { RouterLink, RouterOutlet, type Routes } from '@angular/router';
import { StackNav, StackNavFillViewport } from '@stacknav/angular';

/** Content pages belong to the microfrontend; the application header does not. */
@Component({
  selector: 'embedded-home',
  imports: [RouterLink],
  template: `
    <div class="page body">
      <h2>Items</h2>
      <p>Open an item to see the content animate beneath the application header.</p>
      <div class="counter item">
        <span>Kept page state</span><b>{{ count() }}</b>
        <button type="button" (click)="count.set(count() + 1)">+</button>
      </div>
      @for (id of items; track id) {
        <a class="item" [routerLink]="['/items', id]" [queryParams]="{ shell: '' }">
          <span>Item {{ id }}</span><i>›</i>
        </a>
      }
    </div>
  `,
})
class EmbeddedHome {
  readonly count = signal(0);
  readonly items = Array.from({ length: 40 }, (_, i) => i + 1);
}

@Component({
  selector: 'embedded-item',
  imports: [RouterLink],
  template: `
    <div class="page body">
      <a routerLink="/" [queryParams]="{ shell: '' }">‹ All items</a>
      <h2>Item {{ id() }}</h2>
      <p>This detail page belongs to the microfrontend. The application header stays in the shell.</p>
    </div>
  `,
})
class EmbeddedItem {
  readonly id = input.required<string>();
}

export const SHELL_DEMO_ROUTES: Routes = [
  { path: '', component: EmbeddedHome },
  { path: 'items/:id', component: EmbeddedItem },
  { path: '**', redirectTo: '' },
];

/** The independently mounted microfrontend owns its outlet and sizing helper. */
@Component({
  selector: 'shell-microfrontend',
  imports: [RouterOutlet, StackNav, StackNavFillViewport],
  styles: ':host { display: block; }',
  template: `
    <div class="embedded-stack" stackNavFillViewport style="height: 123px; box-sizing: content-box">
      <router-outlet stackNav />
    </div>
  `,
})
class ShellMicrofrontend {
  private readonly outlet = viewChild(StackNav);

  constructor() {
    afterRenderEffect(() => {
      const outlet = this.outlet();
      if (outlet) (globalThis as { __snStack?: typeof outlet.stack }).__snStack = outlet.stack;
    });
  }
}

/** Open /?shell to try an auto-height microfrontend slot below a shell header. */
@Component({
  selector: 'app-root',
  host: { 'data-shell-demo': '' },
  imports: [ShellMicrofrontend],
  styles: `
    :host { display: block; width: 100%; height: auto; }
    .shell-header { height: 80px; padding: 8px 16px; background: #dde8ff; color: #111; }
    .shell-header h1 { font-size: 18px; margin: 0 0 6px; }
    .shell-controls { display: flex; gap: 8px; }
    .shell-header.expanded { height: 140px; }
    .microfrontend { display: block; }
  `,
  template: `
    <header class="shell-header" [class.expanded]="expanded()">
      <h1>stacknav</h1>
      <div class="shell-controls">
        <button (click)="expanded.set(!expanded())">Resize header</button>
        <button (click)="mounted.set(!mounted())">Toggle microfrontend</button>
      </div>
    </header>
    <main class="microfrontend">
      @if (mounted()) {
        <shell-microfrontend />
      }
    </main>
  `,
})
export class ShellDemo {
  readonly expanded = signal(false);
  readonly mounted = signal(true);
}
